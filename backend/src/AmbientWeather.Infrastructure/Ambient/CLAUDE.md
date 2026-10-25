# Ambient client rules

Loaded when Claude works on files in `Infrastructure/Ambient/`: every outbound call to Ambient Weather's
REST API and its realtime Socket.IO feed. The rate-limit rule and the realtime pipeline are in
`backend/CLAUDE.md`; the shared JSON options are there too (`AmbientJsonOptions.Default`).

---

## Ambient REST and realtime

### Classes
| Class | Role |
|---|---|
| `RateLimitedApiClient` | Every authenticated REST call. Waits on `AmbientRateLimitState` buckets (one interval per API key, one per application key, from `AmbientRateLimitsOptions`), retries transient failures with exponential backoff (`AmbientResilienceOptions`), and records failures in `AmbientCircuitBreakerState` |
| `AmbientRestClient` (`IAmbientRestClient`) | Typed `/devices` and `/devices/{mac}` calls over `RateLimitedApiClient` |
| `AmbientCircuitBreakerState` | Opens per application-key bucket after repeated failures, so one bad credential does not block other users; an open circuit throws `AmbientCircuitOpenException` (503) |
| `AmbientSocketClient`, `AmbientSocketClientFactory` | The low-level realtime connection, owned by `RealtimeSubscriberService` (`Services/`) |
| `AmbientApiOptions` | Base URL and keys configuration; the REST base URL comes from here, never a literal |

### Rules
- Keys are resolved per user through `IAmbientCredentialStore` inside Infrastructure; no client class
  holds a key, and Application code never passes one in (`backend/CLAUDE.md`, credential architecture).
- The query string carries both keys, so a full Ambient URL is never logged or traced
  (`AmbientUrlRedactionProcessor` strips them from spans).
- 401 is never retried; 429 surfaces as `AmbientApiRateLimitException` after the retries; 404 as
  `AmbientApiNotFoundException`. The middleware maps them (`backend/CLAUDE.md`).
- A retry goes back through the rate-limit wait. Use `/devices` `lastData` for current values; the history
  endpoint can lag by several minutes.
- Realtime reconnects back off exponentially in `RealtimeSubscriberService`; one connection per
  application key, never one per browser or user session.
- Response DTOs are not domain entities; validate shape before mapping and ignore unknown fields.

### Ambient clients: must not
- Call `HttpClient` directly from a handler, worker or service: go through `RateLimitedApiClient`.
- Fan out authenticated history calls on every dashboard load; user-facing endpoints read the database or
  cache.
- Let the browser reach Ambient Socket.IO or see the application key.
