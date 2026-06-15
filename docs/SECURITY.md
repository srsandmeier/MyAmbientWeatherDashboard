# Security — Web Application

This document describes how the Ambient Weather Dashboard protects user identity,
Ambient API credentials, and outbound API traffic.

**Principles**

- Ambient `apiKey` and `applicationKey` never reach the browser.
- All Ambient HTTP calls originate from the backend through `RateLimitedApiClient`.
- Credentials are encrypted at rest in PostgreSQL using ASP.NET Core Data Protection.
- User-facing endpoints read from PostgreSQL or Redis — not live Ambient on every request.

---

## Threat model (v1)

| Asset | Risk | Mitigation |
|---|---|---|
| Ambient API keys | Leak via frontend, logs, or DB | Server-side only; encrypt at rest; redact in logs |
| User sessions | Token theft (XSS, MITM) | HTTPS; short-lived JWT; prefer httpOnly cookie where used |
| BFF abuse | Unauthenticated or excessive calls | JWT on all routes; ASP.NET rate limiting |
| Ambient rate limits | Key ban from outbound flood | Redis token bucket; cache-first reads |
| Multi-tenant isolation | User A reads User B's keys | Credentials keyed by internal `user_id`; authorize every handler |

---

## User authentication

Identity is handled by **Auth0 Free Tier** (default) or **OpenIddict** (fully self-hosted).

| Item | Detail |
|---|---|
| Protocol | OpenID Connect / OAuth 2.0 |
| Token | JWT Bearer on `Authorization` header |
| Subject mapping | Auth0 `sub` → `users.auth_provider_sub` |
| Protected routes | All `/api/*` except `GET /api/health` |
| Realtime | SignalR hub requires authenticated connection; user joins group `user:{id}` only |

The React app stores the JWT in memory or an httpOnly session cookie — never in
`localStorage` if avoidable (XSS surface). Ambient keys are **not** part of the JWT or
any client-side storage.

### Local development secrets

| Secret | Storage |
|---|---|
| Auth0 client ID / secret | .NET User Secrets |
| PostgreSQL connection string | `.env` / User Secrets (not committed) |
| Redis connection string | `.env` / User Secrets |
| ASP.NET Data Protection key ring | See [Data Protection key persistence](#data-protection-key-persistence) |

Never commit `.env`, User Secrets JSON, or key ring files to git.

---

## Ambient credential storage

Ambient keys are stored in `user_ambient_credentials`:

| Column | Content |
|---|---|
| `user_id` | FK to authenticated user (one row per user) |
| `api_key_encrypted` | User's Ambient device API key |
| `application_key_encrypted` | Developer's Ambient application key |
| `updated_at` | Last save timestamp |

Both columns store `text` — the base64-encoded ciphertext string produced by
`IDataProtector.Protect(string)`. Data Protection handles encoding internally; no
explicit byte-array handling is needed in application code.

> **Why `text` and not `bytea`?** `IDataProtector.Protect(string)` returns a base64
> string already. Storing the string directly avoids an unnecessary encode/decode step
> and keeps the column readable in SQL debugging without a hex decoder.

### Approach: ASP.NET Core Data Protection

Data Protection encrypts payloads with an app-specific key ring. Unlike desktop DPAPI,
this runs on the server and supports deployment across instances when the key ring is
shared (Redis, Azure Blob, filesystem mount).

```csharp
// Infrastructure/DependencyInjection.cs — register with stable name + persistent key ring
services.AddDataProtection()
    .SetApplicationName("AmbientWeatherDashboard")
    .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath));

services.AddScoped<ICredentialEncryptionService, CredentialEncryptionService>();
```

```csharp
/// <summary>Encrypts and decrypts Ambient API credentials at rest.</summary>
public sealed class CredentialEncryptionService : ICredentialEncryptionService
{
    private readonly IDataProtector _protector;

    public CredentialEncryptionService(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("AmbientWeather.Credentials.V1");

    /// <summary>Returns the Data Protection ciphertext string for DB storage.</summary>
    public string Encrypt(string plaintext) => _protector.Protect(plaintext);

    /// <summary>Recovers the plaintext key for outbound Ambient calls.</summary>
    public string Decrypt(string ciphertext) => _protector.Unprotect(ciphertext);
}
```

### Save flow

```
User (authenticated)
  → POST /api/settings/credentials  { apiKey, applicationKey }
  → FluentValidation (non-empty, format checks)
  → Test call: GET /v1/devices (via RateLimitedApiClient)
  → On 401: return 400, do not save
  → On success: Protect both keys → upsert user_ambient_credentials
  → Return 204 (never echo keys back)
```

### Delete flow

```
DELETE /api/settings/credentials
  → Delete row from user_ambient_credentials
  → Remove user from RealtimeSubscriberService subscribe set
  → Return 204
```

### Read flow (internal only)

Credentials are decrypted only inside Infrastructure services at the moment of an Ambient
call. They are never mapped to API response DTOs and never logged.

```csharp
// Application handler — credentials loaded from IAmbientCredentialStore by subject, never from request
var subject = _currentUserService.RequireAuthenticatedUser();
var credentials = await _credentialStore.GetAsync(subject, ct)
    ?? throw new AmbientCredentialsRequiredException();

// Keys are passed to RateLimitedApiClient; never returned in handler output or logged
await _restClient.GetDevicesAsync(credentials.ApiKey, credentials.ApplicationKey, ct);
```

---

## Data Protection key persistence

| Environment | Key ring storage |
|---|---|
| Local dev | `%LOCALAPPDATA%/AmbientWeatherDashboard/keys/` (single instance) |
| Docker / single server | Mounted volume at `/var/keys` |
| Multi-instance prod | Redis (`Microsoft.AspNetCore.DataProtection.StackExchangeRedis`) or cloud blob |

If the key ring is lost or rotated without migration, existing ciphertext in PostgreSQL
becomes undecryptable. Handle `CryptographicException` on `Unprotect` by deleting the
credential row and returning a settings prompt:

> "Your saved API keys could not be decrypted. Please re-enter them in Settings."

---

## Transport and browser exposure

| Rule | Detail |
|---|---|
| HTTPS | Required in all non-local environments |
| Ambient keys in React | **Forbidden** — Settings form POSTs to BFF, then clears local form state |
| GET responses | Must never include `apiKey`, `applicationKey`, or decrypted values |
| OpenAPI / Swagger | Disable or protect in production |
| CORS | Allow only the known frontend origin |

---

## Logging and observability

Serilog structured logging is configured in `AmbientWeather.Api`. Development logs are
human-readable console output; Staging/Production uses compact JSON.

**Redaction guarantees** — `SensitiveLogRedactor` (`AmbientWeather.Api/Logging/`) defines
a deny-list of property names that must never appear in logs in plain text:

| Property name | Category |
|---|---|
| `apiKey`, `api_key` | Ambient device key |
| `applicationKey`, `application_key` | Ambient application key |
| `password`, `secret`, `token` | Generic credentials |
| `authorization`, `cookie`, `set-cookie` | HTTP headers |
| `x-api-key`, `x-application-key` | Custom headers |

Any value whose property name matches the deny-list (case-insensitive) is replaced with
`[REDACTED]` by `SensitiveLogRedactor.RedactIfSensitive`.

Additional rules:

- The `System.Net.Http.HttpClient.AmbientWeatherRest` category is set to `Warning` or
  higher in `appsettings.json` so HttpClientFactory does not emit Ambient request URLs
  (which contain keys in query parameters).
- Log Ambient HTTP status codes and MAC addresses only at Debug/Information — never keys.
- SignalR connection IDs are fine to log; JWT contents are not.
- User identity (Auth0 subject) is never logged — not even in hashed form — until a
  future privacy review approves a specific operational need for it.

**Telemetry:** Backend Azure Monitor OpenTelemetry is optional. It is disabled when
`AzureMonitor:ConnectionString` is absent. Frontend Application Insights is disabled when
`VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` is absent. Both default to off in local
development. Neither telemetry path sends Ambient keys, Auth0 tokens, user email, or any
user identity.

---

## Rate limiting

Two layers prevent abuse and Ambient key bans:

### BFF (inbound)

`Microsoft.AspNetCore.RateLimiting` on ASP.NET Core, partitioned by JWT subject
or IP address. Current local/single-instance policies are in-process fixed windows;
Redis-backed shared counters are the planned scale-out upgrade before multi-instance
deployment.

| Endpoint class | Suggested limit |
|---|---|
| `GET /api/dashboard/*` | 60 / min per user |
| `GET /api/metrics/*/history` | 30 / min per user |
| `POST /api/settings/credentials` | 5 / hour per user |
| `POST /api/neighbors/refresh` | 6 / hour per user |

### Ambient (outbound)

`RateLimitedApiClient` enforces **1 request per second per user API key** and
**3 requests per second per application key** using the backend outbound queue. The
current implementation is in-process for single-instance development; Redis-backed
shared buckets remain the scale-out target.

User-facing handlers must read cached data from PostgreSQL/Redis. Live Ambient calls
are limited to:

- Credential validation on save
- Background history sync worker
- Explicit refresh actions (neighbor rediscovery)
- Realtime subscriber (Socket.IO — not REST)

---

## Realtime pipeline security

Browsers must **not** connect directly to `rt2.ambientweather.net`.

```
Ambient Socket.IO  →  RealtimeSubscriberService (BackgroundService)
                     ↓
                   IRealtimeReadingPublisher
                     ↓                       ↓
              Redis PUBLISH            ILatestReadingCache
         ambient:readings:{userHash}   latest-reading:{userHash}:{mac}
                     ↓
         IRealtimeReadingSubscriber
         (RedisRealtimeReadingSubscriber)
                     ↓
          SignalR WeatherHub  →  authenticated browser (group user:{userHash})
```

**Credential isolation:**
- `RealtimeSubscriberService` resolves credentials internally via `IAmbientCredentialStore`.
  Raw `apiKey` / `applicationKey` strings never appear in log messages, metrics, or span
  attributes. `SensitivePropertyRedactor` (Serilog enricher) redacts any property whose name
  matches the deny-list as a second layer.
- Per-user `apiKey` values are passed in the Ambient Socket.IO subscribe payload only;
  one connection is shared per unique `applicationKey` to minimise credential exposure.

**User-hash scoping:**
- Redis pub/sub channels are named `ambient:readings:{sha256(sub)}` — a short hex hash of
  the Auth0 subject. Raw subjects (which include the user's Auth0 ID) never appear in Redis
  key space or channel names.
- SignalR groups are named `user:{sha256(sub)}`. Clients are added to exactly one group on
  connect by `WeatherHub.OnConnectedAsync`; cross-user group membership is impossible because
  the hash is derived from the verified JWT `sub` claim, not from request data.

**SignalR authentication:**
- `WeatherHub` requires `[Authorize(Policy = "AuthenticatedUser")]`. Unauthenticated
  WebSocket upgrade returns HTTP 401 at the negotiate endpoint.
- `accessTokenFactory` injects the Auth0 access token as a query parameter (standard SignalR
  pattern); the token is treated as a Bearer token by `JwtBearerEvents.OnMessageReceived`.

**Latest-reading cache:**
- Cache entries use `IDistributedCache` with a 5-minute absolute TTL.
- Corrupt entries (malformed JSON) are logged and return `null`; they expire naturally within
  the TTL window rather than being evicted immediately (avoids a cache stampede on write errors).
- In Development/Testing (no Redis), `LocalRealtimeReadingPublisher` and
  `NullRealtimeReadingSubscriber` are registered; they update the in-memory cache only so the
  REST fallback path still works locally.

---

## Neighbor / Nearby Public Data

Nearby public station discovery may use the undocumented Ambient Open REST API at
`lightning.ambientweather.net`, or other public weather APIs behind the same provider abstraction.
These calls:

- Do **not** require the user's Ambient keys
- Must be feature-flagged when they use undocumented endpoints
- Should still be rate-limited and cached (Redis TTL from user neighbor config)
- Return only public or model-derived data — treat as untrusted input; validate JSON shape
- Must record the provider/source so data quality and provenance are clear

Do not mix public provider responses into authenticated user credential scopes.

---

## Authorization checklist

Every MediatR handler that touches user data must:

1. Resolve the current user from JWT claims.
2. Load resources filtered by `user_id`.
3. Never accept `userId` from the request body for authorization decisions.

Integration tests must assert that user A cannot read or overwrite user B's credentials,
layout, or preferences.

---

## Rejected approaches

| Option | Problem |
|---|---|
| Ambient keys in React state / localStorage | XSS exposes keys; violates Ambient trust model |
| Plain text in PostgreSQL | DB backup leak exposes all keys |
| Plain text in `appsettings.json` | Committed to repo; shared across users |
| Desktop DPAPI | Windows-only; wrong model for server-side multi-user webapp |
| Browser → Ambient REST directly | Exposes keys; bypasses rate limiting and audit |
| Logging request URLs at Info | Query string contains secrets |

---

## Security testing (required)

| Test | Tool |
|---|---|
| Save credentials → not returned on GET | xUnit integration |
| Invalid Ambient key rejected on save | xUnit integration |
| User A cannot access user B settings | xUnit integration |
| Settings form never renders saved key values | Vitest component |
| Rate limit returns 429 on credential spam | xUnit integration |

See Phase 7 and Phase 12 in [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md).

---

## Related documentation

| Doc | Topic |
|---|---|
| [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) | Full security model, BFF routes, phases |
| [`API_REFERENCE.md`](API_REFERENCE.md) | Ambient endpoints and rate limits |
| [`../CLAUDE.md`](../CLAUDE.md) | Non-negotiable security rules for agents |
