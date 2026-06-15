# Agent: Backend (ASP.NET Core)

Handles `backend/src/AmbientWeather.Api/`, `AmbientWeather.Application/`, and
`AmbientWeather.Workers/`.

---

## Stack

| Package | Licence | Purpose |
|---|---|---|
| ASP.NET Core 10 | MIT | Web API, SignalR, middleware |
| MediatR | Apache 2.0 | Command/query handlers |
| FluentValidation | Apache 2.0 | Input validation |
| EF Core | MIT | Persistence (via Infrastructure) |
| Serilog | Apache 2.0 | Structured logging |
| Meziantou.Analyzer | MIT | Backend code quality analyzer |
| Roslynator.Analyzers | Apache 2.0 | C# analyzer rules |

No paid packages. No deprecated ASP.NET APIs.

---

## Layer responsibilities

```
AmbientWeather.Api/
├── Controllers/           Thin — delegate to IMediator only
├── Hubs/WeatherHub.cs    SignalR; user joins group user:{id}
├── Middleware/            Exception handling, correlation IDs
└── Program.cs             DI registration, auth, rate limiting, Swagger UI

AmbientWeather.Application/
├── Dashboard/             Queries for current readings, rainfall, layout
├── Metrics/               History queries, metric catalog
├── Neighbours/            Config + aggregation commands/queries
├── Settings/              Credentials, preferences
├── Common/                MetricDefinition registry, mappers, interfaces
└── Validators/            FluentValidation for all commands

AmbientWeather.Workers/
├── HistorySyncWorker.cs   Background sync → weather_readings
└── RollupWorker.cs        Hourly reading_aggregates
```

Infrastructure concerns (Ambient clients, EF, Redis) live in `AmbientWeather.Infrastructure` —
see the **api-client**, **data**, **realtime**, and **security** agents.

---

## Core directives

- Controllers and hubs stay thin: `return Ok(await mediator.Send(query, ct))`.
- One MediatR handler per use case; no business logic in controllers.
- All commands have a FluentValidation validator; fail fast before I/O.
- Resolve the current user from JWT claims — never trust `userId` from the request body.
- User-facing handlers read from PostgreSQL or Redis. Live Ambient calls only for sync,
  credential validation, and explicit refresh actions.
- All I/O is `async`/`await`. Every public member has an XML doc comment.
- File-scoped namespaces, primary constructors, implicit usings.

---

## BFF endpoints (implement via MediatR)

| Area | Routes |
|---|---|
| Dashboard | `GET /api/dashboard/current`, `/rainfall`, `/layout`; `PUT /layout` |
| Metrics | `GET /api/metrics`, `/metrics/{key}/history`, `/metrics/{key}/current` |
| Neighbours | `GET/PUT /api/neighbours/config`, `GET /neighbours`, `POST /refresh` |
| Settings | `GET/PUT /api/settings/preferences`, `POST/DELETE /credentials` |
| Health | `GET /api/health` (anonymous) |

Full contract: `docs/DEVELOPMENT_PLAN.md`.

---

## Metric registry (DRY)

Define metrics once in `MetricDefinition` (Domain/Application). Each entry includes:
`key`, label, Ambient field name, unit, and whether neighbour averaging applies.
Mirror the same keys in frontend TypeScript types — do not duplicate field mappings
in individual handlers.

---

## Neighbour aggregation

`NeighbourAggregationService` in Application. Provider calls stay behind Infrastructure
implementations of `INearbyWeatherProvider`:

- Load config from `user_preferences.neighbour_config_json`.
- Use cached provider candidates from `neighbour_station_cache` / Redis.
- Apply mean or median; skip nulls when `excludeMissingSensor` is true.
- Enforce `minimumStationsRequired`; return warning metadata when unmet.
- Indoor metrics (`indoor_temp`, `indoor_humidity`) are never aggregated from neighbours.
- Treat Ambient's public Open API as experimental; support provider fallback such as Weather.gov/NWS
  or Open-Meteo when configured.

---

## Workers

| Worker | Schedule | Responsibility |
|---|---|---|
| `HistorySyncWorker` | Every 5 min | Latest page from Ambient history → upsert `weather_readings` |
| Backfill | On credential save + nightly | Page backwards until 1 year or empty |
| `RollupWorker` | Hourly | Compute `reading_aggregates` |

Workers inject `IAmbientRestClient` and `IWeatherReadingRepository` — not `HttpClient` directly.

---

## Error handling

Map domain exceptions to RFC 7807 ProblemDetails:

| Exception | HTTP |
|---|---|
| Validation failure | 400 |
| Ambient 401 (invalid keys) | 400 on save; 503 with message on dashboard if keys revoked |
| Not found | 404 |
| Rate limit (BFF) | 429 |

Never include Ambient keys or decrypted credentials in error responses or logs.

---

## Registration pattern

```csharp
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(GetDashboardCurrentQuery).Assembly));
builder.Services.AddValidatorsFromAssembly(typeof(SaveCredentialsCommandValidator).Assembly);
builder.Services.AddRateLimiter(/* Redis-backed policies per route class */);
```

### Swagger UI (Development)

- Package: `Swashbuckle.AspNetCore` (MIT)
- UI: `http://localhost:5080/swagger` when `ASPNETCORE_ENVIRONMENT=Development`
- OpenAPI JSON: `/swagger/v1/swagger.json`
- Disabled in Production (per `docs/SECURITY.md`)
- Phase 2: add JWT Bearer security definition for authenticated endpoint testing

---

## Testing (required)

| Target | Tool |
|---|---|
| Handlers | xUnit + mocks for repositories/clients |
| Validators | xUnit theory tests |
| Controllers | `WebApplicationFactory` integration tests |
| Workers | xUnit with in-memory DB or test containers |

Every handler and validator gets tests before its phase is complete.

## Linting

- Backend analyzer packages are registered centrally in `backend/Directory.Build.props`.
- Run `dotnet format whitespace backend/AmbientWeather.slnx --verify-no-changes` before handing off backend changes.
- Analyzer warnings from .NET SDK analyzers, Meziantou.Analyzer, and Roslynator.Analyzers should be fixed when touching related code.

---

## Must NOT do

- Call Ambient HTTP directly (use Infrastructure clients).
- Return Ambient keys in any response DTO.
- Put EF Core queries in controllers.
- Use deprecated APIs (`IHostingEnvironment`, sync-over-async, etc.).

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name in code or tests — not even as an "example."
- C# tests: use `Bogus` (`new Bogus.Faker()`) — `F.Address.Latitude()`, `F.Address.Longitude()`, `F.Address.StreetAddress()`, `F.Address.City()`, `F.Address.StateAbbr()`, `F.Address.ZipCode()`. State output must be real US state abbreviations (Bogus default).
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list — never hardcode a single airport every time.
- Every test run must produce different location values. No hardcoded addresses, coordinates, or station IDs anywhere.
- Never save any address, GPS coordinate, or station ID that a user enters.
