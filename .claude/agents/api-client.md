# Agent: API Client (Ambient Weather)

Handles all Ambient outbound HTTP and Socket.IO in
`backend/src/AmbientWeather.Infrastructure/Ambient/`.

For realtime orchestration (Redis pub/sub, SignalR), see **realtime** agent.
For credential decryption, see **security** agent.

---

## Stack

| Package | Licence | Purpose |
|---|---|---|
| `System.Net.Http.HttpClient` | Built-in | REST calls |
| `System.Text.Json` | Built-in | JSON deserialization |
| `SocketIOClient` | MIT | Ambient rt2 Socket.IO feed |
| `Microsoft.Extensions.Http` | MIT | `IHttpClientFactory` |
| `StackExchange.Redis` | MIT | Redis-backed rate limit buckets (multi-instance) |

No Newtonsoft. No paid SDKs. Prefer custom thin client over heavy third-party wrappers.

---

## Class responsibilities

```
Infrastructure/Ambient/
├── RateLimitedApiClient.cs       All authenticated REST calls pass through here
├── AmbientRestClient.cs          GET /v1/devices, GET /v1/devices/{mac}
├── AmbientOpenApiClient.cs       Experimental GET lightning.ambientweather.net/devices (nearby public data)
├── AmbientSocketIoClient.cs      Low-level rt2 connect/subscribe/receive
├── Dtos/                         JSON response DTOs (not domain entities)
│   ├── DeviceResponse.cs
│   ├── DeviceDataResponse.cs
│   └── LastDataDto.cs
└── Exceptions/
    ├── AmbientApiRateLimitException.cs
    ├── AmbientApiAuthException.cs
    └── AmbientApiNotFoundException.cs
```

---

## Rate limit queue

**Every outbound Ambient REST request must pass through `RateLimitedApiClient`.**

Limits: **1 req/s per user API key**, **3 req/s per application key**.

Use a Redis-backed token bucket for multi-instance deployments; in-process `SemaphoreSlim`
is acceptable for local single-instance dev only.

```csharp
/// <summary>
/// Enforces Ambient Weather rate limits before delegating to HttpClient.
/// </summary>
public sealed class RateLimitedApiClient
{
    public async Task<T> GetAsync<T>(
        string url,
        string apiKey,
        CancellationToken ct = default)
    {
        await _limiter.WaitAsync(apiKey, ct);          // 1 req/s per apiKey
        await _appLimiter.WaitAsync(ct);               // 3 req/s per appKey

        var response = await _http.GetAsync(url, ct);

        if ((int)response.StatusCode == 429)
            throw new AmbientApiRateLimitException("Ambient rate limit exceeded.");

        if (response.StatusCode == HttpStatusCode.Unauthorized)
            throw new AmbientApiAuthException("Invalid Ambient API credentials.");

        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new AmbientApiNotFoundException(url);

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(_json, ct)
            ?? throw new InvalidOperationException("Empty Ambient response.");
    }
}
```

---

## AmbientRestClient (authenticated REST)

Base URL: `https://rt.ambientweather.net/v1`

Keys are resolved per-user from `IAmbientCredentialStore` — never stored on the client class.

```csharp
public sealed class AmbientRestClient(IAmbientRestClientDependencies deps)
{
    /// <summary>GET /v1/devices — current readings for all user devices.</summary>
    public Task<IReadOnlyList<DeviceResponse>> GetDevicesAsync(
        Guid userId, CancellationToken ct);

    /// <summary>GET /v1/devices/{mac} — historical data (max 288 records per page).</summary>
    public Task<IReadOnlyList<DeviceDataResponse>> GetDeviceHistoryAsync(
        Guid userId, string macAddress, DateTime? endDate, int limit, CancellationToken ct);
}
```

Query string (both keys required):
```
?applicationKey={appKey}&apiKey={apiKey}&limit=288&endDate={ms}
```

Use `/devices` `lastData` for live tiles. History endpoint has up to 10-minute lag.

---

## AmbientOpenApiClient (experimental nearby public data)

Base URL: `https://lightning.ambientweather.net`

**Does not require user Ambient keys.** This is an undocumented Ambient web-app API, not part of the
official Ambient REST API contract. Keep it behind an `INearbyWeatherProvider` abstraction and a feature
flag. The product must degrade gracefully if this endpoint changes, blocks access, or returns unexpected
data.

```csharp
public sealed class AmbientOpenApiClient
{
    /// <summary>
    /// Returns public devices in a bounding box. Caller sorts by Haversine distance.
    /// </summary>
    public Task<IReadOnlyList<OpenDeviceResponse>> GetDevicesInBoundingBoxAsync(
        double latMin, double lonMin, double latMax, double lonMax, CancellationToken ct);
}
```

Bounding box params: `$publicBox[0][0]` (lon), `$publicBox[0][1]` (lat), etc. `aioambient` uses
`GET /devices` with `$limit=100` for discovery and `GET /devices/{macAddress}` for public current
detail. Reference: [aioambient OpenAPI](https://github.com/bachya/aioambient).

Treat responses as untrusted input — validate JSON shape before mapping. Do not assume historical
neighbour data is available from this API; current public data is the only confirmed behavior.

---

## Open-Meteo forecast/current API

Base URL: `https://api.open-meteo.com`

Official docs: https://open-meteo.com/en/docs

Use the official Open-Meteo docs when adding or changing Open-Meteo field requests, query
parameters, units, timezone handling, or provider-specific metric support. Keep the Phase 12
Open-Meteo extended-metrics plan in sync when exposing new Open-Meteo fields.

Current project rules:
- Use `timezone=auto` for discovery/timezone resolution, or the saved source timezone for
  current-reading requests.
- Include `models=best_match` unless a phase plan explicitly chooses a specific model.
- Request only fields that the backend maps and the frontend can display or intentionally hide
  behind provider-specific support filtering.
- Do not expose forecast fields as current-observation metrics without clear user-facing labels.
- Add backend mapping tests and frontend picker/render tests for each newly exposed field.

---

## AmbientSocketIoClient (low-level realtime)

Endpoint: `https://rt2.ambientweather.net/?api=1&applicationKey={appKey}`

```csharp
public sealed class AmbientSocketIoClient : IAsyncDisposable
{
    /// <summary>Raised when Ambient emits a "data" event.</summary>
    public event EventHandler<AmbientDataEventArgs>? DataReceived;

    public Task ConnectAsync(CancellationToken ct);
    public Task SubscribeAsync(IReadOnlyList<string> apiKeys, CancellationToken ct);
    public Task UnsubscribeAsync(IReadOnlyList<string> apiKeys, CancellationToken ct);
    public Task DisconnectAsync();
}
```

- Application key from configuration (not per-user DB).
- Reconnect with exponential backoff: 1s → 2s → 4s → max 30s.
- Wrapped by `RealtimeSubscriberService` — see **realtime** agent.

Browsers must **not** use this client.

---

## JSON deserialization

```csharp
private static readonly JsonSerializerOptions Json = new()
{
    PropertyNameCaseInsensitive = true,
    NumberHandling = JsonNumberHandling.AllowReadingFromString,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
};
```

All DTO properties use `[JsonPropertyName("fieldName")]` matching the Ambient spec exactly.
Unknown fields are silently ignored.

Field reference: `docs/API_REFERENCE.md`.

---

## Error handling

| HTTP | Exception | Handler action |
|---|---|---|
| 401 | `AmbientApiAuthException` | Credential save → 400; dashboard → prompt re-entry |
| 404 | `AmbientApiNotFoundException` | Log and surface not-found |
| 429 | `AmbientApiRateLimitException` | Back off 5s; should be rare if limiter works |
| Network | `HttpRequestException` | Use Redis/PostgreSQL cache; mark offline |

Do **not** retry 401. Do **not** log full URLs (query string contains keys).

---

## Registration

```csharp
services.AddHttpClient<RateLimitedApiClient>(client =>
{
    client.BaseAddress = new Uri("https://rt.ambientweather.net/v1/");
    client.DefaultRequestHeaders.Add("User-Agent", "AmbientWeatherDashboard/1.0");
    client.Timeout = TimeSpan.FromSeconds(15);
});

services.AddHttpClient<AmbientOpenApiClient>(client =>
{
    client.BaseAddress = new Uri("https://lightning.ambientweather.net/");
    client.Timeout = TimeSpan.FromSeconds(15);
});

services.AddSingleton<AmbientRestClient>();
services.AddSingleton<AmbientOpenApiClient>();
services.AddSingleton<AmbientSocketIoClient>();
```

---

## Testing (required)

| Target | Tool |
|---|---|
| Rate limiter | xUnit: two rapid calls → second waits ≥ 1s |
| DTO deserialization | xUnit: sample JSON fixtures from Ambient docs |
| URL building | xUnit: keys in query string, never logged |
| Nearby provider mapping | xUnit: bounding box params and provider fallback formatted correctly |

---

## What this layer must NOT do

- Cache readings long-term — that is the **data** agent (`weather_readings`, Redis TTL cache).
- Decrypt credentials — that is the **security** agent.
- Know about controllers, React, or SignalR.
- Call `HttpClient` directly from handlers or workers — always inject `AmbientRestClient`.
- Fan out 10 authenticated history calls on every dashboard load.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name in code or tests — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
