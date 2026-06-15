# Agent: Realtime (Socket.IO → Redis → SignalR)

Handles server-side live updates. Browsers **must not** connect to Ambient Socket.IO.

---

## Pipeline

```
rt2.ambientweather.net (Socket.IO)
        │
        ▼
RealtimeSubscriberService   ← BackgroundService in Infrastructure
        │ parse "data" event
        ▼
Redis PUBLISH ambient:readings:{userId}
        │ + SET ambient:latest:{userId} (5-min TTL)
        ▼
WeatherHub (SignalR)          ← AmbientWeather.Api/Hubs/
        │ group: user:{userId}
        ▼
React useWeatherHub()         ← invalidate TanStack Query keys
```

See also **api-client** agent for the low-level Socket.IO client; this agent owns orchestration.

---

## Components

```
Infrastructure/Ambient/
├── AmbientSocketIoClient.cs       Low-level connect/subscribe/receive
└── RealtimeSubscriberService.cs   BackgroundService; manages subscribe set

Infrastructure/Redis/
└── ReadingPubSubPublisher.cs      PUBLISH + cache latest reading

Api/Hubs/
└── WeatherHub.cs                  Authorize; OnConnected → join user:{id}
```

---

## RealtimeSubscriberService

| Concern | Detail |
|---|---|
| Connection | One Socket.IO connection per app instance |
| App key | From configuration (User Secrets / env) — identifies the developer app |
| Subscribe | `{ apiKeys: ["user-api-key", ...] }` after user saves credentials or opens dashboard |
| Unsubscribe | On credential delete |
| Reconnect | Exponential backoff: 1s, 2s, 4s … max 30s |
| Event | Parse `data` event → map to `ReadingUpdatedMessage` → publish to Redis |

---

## Redis channels and cache

| Key / channel | Purpose | TTL |
|---|---|---|
| `ambient:readings:{userId}` | Pub/sub channel | — |
| `ambient:latest:{userId}` | Latest reading JSON for REST fallback | 5 min |

`GET /api/dashboard/current` reads Redis first → fallback to PostgreSQL → last resort Ambient REST.

---

## SignalR WeatherHub

```csharp
[Authorize]
public sealed class WeatherHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User!.GetUserId();
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        await base.OnConnectedAsync();
    }
}
```

Events pushed to clients:

| Event | Payload |
|---|---|
| `ReadingUpdated` | `{ macAddress, recordedAt, metrics... }` |
| `DashboardRefresh` | `{ reason }` — e.g. neighbour cache refreshed |

---

## Frontend hook

```typescript
// hooks/useWeatherHub.ts
export function useWeatherHub(token: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/weather', { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();
    connection.on('ReadingUpdated', () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    });
    connection.start();
    return () => { connection.stop(); };
  }, [token, queryClient]);
}
```

---

## Fallback when Socket.IO is down

If the server subscriber cannot connect for > 60s:

- `HistorySyncWorker` or a lightweight poll job calls `/v1/devices` every 60s per active user.
- Respect `RateLimitedApiClient` — poll is server-side only.
- Surface `StatusTile` connection state: live | polling | offline.

---

## Testing (required)

| Target | Tool |
|---|---|
| Message parsing | xUnit: sample Socket.IO payload → DTO |
| Redis publish | Integration: publish → subscriber receives |
| SignalR hub | `WebApplicationFactory`: authenticated connection joins correct group |
| `useWeatherHub` | Vitest: mock SignalR client, assert query invalidation |

---

## Must NOT do

- Expose Ambient Socket.IO URL or application key to the React app.
- Open one Socket.IO connection per browser tab.
- Push raw Ambient payloads to clients without mapping to BFF DTO shape.
- Skip `[Authorize]` on the hub.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name anywhere — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
