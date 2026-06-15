# Agent: Security

Implements `docs/SECURITY.md` across `AmbientWeather.Api/`, `AmbientWeather.Application/`,
and `AmbientWeather.Infrastructure/`.

---

## Principles (non-negotiable)

- Ambient `apiKey` and `applicationKey` **never** reach the browser.
- All Ambient HTTP calls go through `RateLimitedApiClient` in Infrastructure.
- Credentials encrypted at rest with ASP.NET Core Data Protection.
- Every handler scoped to the authenticated user's `user_id`.
- Redact secrets in all logs and error responses.
- Treat every user input, route value, query parameter, and external API payload as untrusted.
- Review against OWASP Top 10 concerns: broken access control, cryptographic failures,
  injection, insecure design, security misconfiguration, vulnerable dependencies,
  authentication failures, integrity failures, logging/monitoring gaps, and SSRF.

---

## Authentication

| Item | Implementation |
|---|---|
| Provider | Auth0 Free Tier (default) or OpenIddict |
| Scheme | JWT Bearer |
| Subject | `sub` claim → `users.auth_provider_sub` |
| Protected | All `/api/*` except `GET /api/health` |
| SignalR | `[Authorize]` on hub; join only `user:{ownId}` group |

Frontend: JWT in memory or httpOnly cookie — avoid localStorage when possible.

---

## Credential storage

```
POST /api/settings/credentials
  → Validate (FluentValidation)
  → Test GET /v1/devices via RateLimitedApiClient
  → 401 → return 400, do not save
  → Protect both keys → upsert user_ambient_credentials
  → Return 204 (never echo keys)
```

| Component | Location |
|---|---|
| `IAmbientCredentialProtector` | Infrastructure |
| `AmbientCredentialStore` | Infrastructure (encrypt/decrypt + DB) |
| `SaveCredentialsCommandHandler` | Application |

Purpose string: `"AmbientWeather.Credentials.V1"`. See `docs/SECURITY.md` for key ring persistence.

---

## Authorization checklist

Every MediatR handler must:

1. Inject `ICurrentUserService` (or `IHttpContextAccessor` wrapper).
2. Filter all DB queries by `user_id`.
3. Reject cross-user access with 404 (not 403, to avoid leaking existence).

Integration tests **required**: user A cannot read user B credentials, layout, or preferences.

---

## BFF rate limiting

`Microsoft.AspNetCore.RateLimiting` with Redis partition keys:

| Route class | Limit |
|---|---|
| Dashboard GET | 60/min per user |
| History GET | 30/min per user |
| POST credentials | 5/hour per user |
| POST neighbours/refresh | 6/hour per user |

---

## Logging

- Never log Ambient request URLs with query strings (keys in query params).
- Destructure credential commands with `[REDACTED]` placeholders.
- Log MAC addresses and HTTP status codes at Information; key material never.

---

## Data Protection edge case

On `CryptographicException` during `Unprotect`:

- Delete unreadable credential row.
- Return a settings prompt: keys must be re-entered.
- Do not crash the request pipeline.

---

## CORS and transport

- HTTPS required outside local dev.
- CORS: allow only the configured frontend origin.
- Disable or protect Swagger in production.

---

## Testing (required)

| Test | Assertion |
|---|---|
| Save credentials | 204; keys not in any GET response |
| Invalid Ambient key | 400 on save |
| User isolation | User A → user B resource returns 404 |
| Credential form (frontend) | Saved keys never rendered in UI |
| Rate limit spam | 429 on credential endpoint |

---

## Must NOT do

- Return decrypted keys in API responses.
- Accept `userId` from request body for authorization.
- Log `apiKey`, `applicationKey`, or JWT contents at Information level.
- Connect browsers directly to Ambient Socket.IO.
- Store keys in plain text PostgreSQL columns or `appsettings.json`.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name anywhere — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
