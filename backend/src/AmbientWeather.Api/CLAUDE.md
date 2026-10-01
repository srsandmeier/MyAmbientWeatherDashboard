# API project rules (BFF routes)

Loaded when Claude works on files under `backend/src/AmbientWeather.Api/`, after the root and
`backend/CLAUDE.md`. Keep the table in step with the controllers and `docs/openapi.json`.

---

## BFF API surface

All routes require `Authorization: Bearer <token>` (Auth0 JWT) unless noted.

| Method | Route | Notes |
|---|---|---|
| GET | `/api/health` | Unauthenticated |
| GET | `/api/health/live` | Unauthenticated |
| GET | `/api/health/ready` | Unauthenticated |
| GET | `/api/settings/credentials` | Returns safe status (no decrypted values) |
| POST | `/api/settings/credentials` | Rate-limited `credential-save`; validates against Ambient |
| DELETE | `/api/settings/credentials` | |
| GET | `/api/settings/preferences` | Units, theme, date format, timezone |
| PUT | `/api/settings/preferences` | |
| GET | `/api/settings/devices` | Owned stations with user-managed settings |
| POST | `/api/settings/devices/sync` | Pulls stations from Ambient, upserts locally |
| PUT | `/api/settings/devices/{mac}` | Patch-semantics; fields omitted → unchanged |
| GET | `/api/dashboard/current` | `?source=neighbors` for aggregated neighbor reading |
| GET | `/api/dashboard/rainfall` | Cache-first, falls back to Ambient REST |
| GET | `/api/dashboard/layout` | Seeds a default layout on first access |
| PUT | `/api/dashboard/layout` | Validates tile structure + metric keys |
| GET | `/api/dashboard/daily-extremes` | High/low temps from stored readings (current UTC day) |
| GET | `/api/metrics/{key}/history` | Rate-limited `metric-history` |
| GET | `/api/neighbors/config` | Includes `isAmbientOpenAvailable` from feature flag |
| PUT | `/api/neighbors/config` | |
| POST | `/api/neighbors/refresh` | Rate-limited `neighbor-refresh`; clears cache + re-discovers |
| GET | `/api/neighbors/stations/current` | `?provider=&sourceId=` pinned station reading |
| GET | `/api/alerts/active` | `?area=` optional Weather.gov area/zone/state code |
| GET | `/api/public-sources` | User's saved public sources |
| POST | `/api/public-sources` | Add a public source (providers: `WeatherGov`, `OpenMeteo`) |
| PUT | `/api/public-sources/{id}` | Update label / enabled flag |
| DELETE | `/api/public-sources/{id}` | |
| GET | `/api/public-sources/discover` | `?q=` zip or "City, State"; max 128 chars |
| GET | `/api/public-sources/{id}/current` | Latest reading for a saved source |

Full historical notes and deferred work: `docs/DEVELOPMENT_PLAN.md`.

---

## Swagger and health endpoints

Swagger UI (dev only): `http://localhost:5080/swagger`

OpenAPI JSON is served at `/swagger/v1/swagger.json` in Development and Testing for local docs
and contract tests. Swagger UI is served only in Development; Swagger is disabled outside
Development/Testing.

Health endpoints (all unauthenticated): `GET /api/health` · `/api/health/live` · `/api/health/ready`
