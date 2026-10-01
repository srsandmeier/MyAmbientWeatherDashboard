# Backend rules

Loaded when Claude works on files under `backend/`. Repo-wide rules (privacy, licences, secrets,
phase closeout, shell safety, test tooling, commit format) are in the root `CLAUDE.md`.

---

## Commands

Run from the repo root. Commands for all stacks (`npm run lint`, `test:quiet`, `start:all`) are in the
root `CLAUDE.md`.

```bash
# Backend
npm run api           # dotnet run — http://localhost:5080
npm run api:watch     # dotnet watch — hot reload
npm run lint:backend  # dotnet format whitespace (verify no changes)
npm run test:backend  # dotnet test all backend projects (Release)

# Run a single backend test class or method
dotnet test backend/AmbientWeather.slnx -c Release --filter "FullyQualifiedName~ClassName"

# Database migrations
npm run db:update                         # apply pending migrations
npm run db:migrate -- AddMigrationName    # add new migration
# Troubleshooting: if a newly added endpoint returns 500 locally after pulling, run db:update first
```

---

## Rules

### Respect the Ambient API rate limit
All HTTP calls to Ambient Weather go through `RateLimitedApiClient` in the backend
Infrastructure layer — never call `HttpClient` directly. The queue enforces 1 req/s per
API key and 3 req/s per application key.

### Schema changes require EF migrations
Every entity property addition, new entity, column rename, index change, or relationship change must be accompanied by an EF Core migration. Scaffold it with `npm run db:migrate -- AddDescriptiveMigrationName`, review the generated file, then commit it alongside the entity change. Never modify the database schema with raw DDL. Integration tests (Testcontainers) auto-apply all pending migrations on startup, so a missing migration will surface as a test failure there.

### Backend architecture
- Controllers stay thin; business logic lives in MediatR handlers.
- Use FluentValidation for all input validation. `ValidationBehavior` (`Application/Common/Behaviours/`) is a MediatR pipeline behavior — it runs FluentValidation automatically before every handler. Never call validators manually from handlers.
- `GlobalExceptionHandlerMiddleware` (`Api/Middleware/`) maps domain exceptions to HTTP codes: `AuthenticatedUserRequiredException` → 401 (`"authenticated-user-required"`), `AmbientApiAuthException` → 401, `UnauthorizedAccessException` → 403, `AmbientApiNotFoundException` → 404, `ValidationException` → 400 (`"validation-error"`), `AmbientApiRateLimitException` → 429, `AmbientCircuitOpenException` → 503, `AmbientCredentialsRequiredException` → 428 (`"ambient-credentials-required"`), `AmbientStationsRequiredException` → 428 (`"ambient-stations-required"`), `NeighborsUnavailableException` → 428 (`"neighbors-unavailable"`). The 428 codes are intentionally distinct so the frontend can show the correct prompt.
- EF Core read-only queries must use `.AsNoTracking()`.
- Every public C# member gets an XML doc comment.
- Logging: Serilog is wired in `Program.cs`. `SensitivePropertyRedactor` (enricher) automatically
  redacts any structured-logging property whose name is on the deny-list (apiKey, applicationKey,
  password, authorization, etc.) — name log properties descriptively; never pass raw credentials.
- Testing environment auth: when `ASPNETCORE_ENVIRONMENT=Testing`, `TestAuthHandler` is registered as the default authentication scheme. Integration tests do not need real JWTs — include the scheme header or use `WebApplicationFactory` helpers.
- `AmbientJsonOptions.Default` (`Infrastructure/Ambient/AmbientJsonOptions.cs`) is the shared `JsonSerializerOptions` with `AllowReadingFromString`. Use it for **all** JSON serialization/deserialization in the Infrastructure layer — Ambient API responses, Redis pub/sub payloads, and distributed cache entries. Never create ad-hoc `new JsonSerializerOptions(...)` instances in Infrastructure services.
- Telemetry: Azure Monitor OpenTelemetry is optional (disabled without `AzureMonitor:ConnectionString`).
  `AmbientUrlRedactionProcessor` strips Ambient API query strings from HTTP spans before export.
- **Rate limiting**: four named policies are registered — `per-user`, `credential-save`, `metric-history`, `neighbor-refresh`. Apply `[EnableRateLimiting("per-user")]` at the controller class level; override at the action level when a stricter policy applies (e.g. `POST /api/neighbors/refresh` uses `neighbor-refresh`). Never leave a controller without a class-level attribute — a missing attribute means future actions added to that controller will be unprotected (Program.cs defines no global fallback policy).
- **Feature flag**: `Features:AmbientOpenApiEnabled` (bool, `appsettings.json`) gates the Ambient Open API neighbor provider. `NeighborsController` reads it via `IConfiguration` and embeds `isAmbientOpenAvailable` in every `NeighborConfigDto` response so the frontend can show or hide that checkbox without a separate call.
- **Credential architecture**: Ambient `apiKey`/`applicationKey` must not cross the Application→Infrastructure boundary as raw strings. Infrastructure services (e.g. `AmbientHistoryService`) resolve credentials internally via the injected `IAmbientCredentialStore`. Application-layer handlers receive the user `subject` and pass it to Infrastructure; they do not hold or forward raw credential strings.
- **Authenticated subject**: call `ICurrentUserService.RequireAuthenticatedUser()` (injected) at the top of every handler to get the user's auth-provider subject string. Do not read claims directly from `IHttpContextAccessor`.
- **Dev bypass entry point**: `HttpContextCurrentUserService.IsDevBypassActive(IHostEnvironment, IConfiguration)` is the single `internal static` method for evaluating the Development auth bypass. `WeatherHub` delegates to it. Any new code that needs to check bypass state must call this method — do not copy the config-key logic.

### Realtime pipeline
Browsers must **not** connect directly to Ambient Socket.IO. The pipeline is:

```
Ambient Socket.IO (rt2.ambientweather.net)
  └─ RealtimeSubscriberService (BackgroundService, one conn per application key)
       └─ IRealtimeReadingPublisher
            ├─ RedisRealtimeReadingPublisher  [prod]  → Redis pub/sub + DistributedLatestReadingCache
            └─ LocalRealtimeReadingPublisher  [dev]   → DistributedLatestReadingCache only
Redis pub/sub channel "ambient:readings:{userHash}"
  └─ RedisRealtimeReadingSubscriber  (manages per-user ref-counts; one channel per user hash)
       └─ WeatherHub (SignalR) → browser client
```

Key contracts:
- `IRealtimeSubscriptionRegistry` — queried on startup and on credential changes to rebuild the MAC→users routing table. `DatabaseRealtimeSubscriptionRegistry` (prod) or `NullRealtimeSubscriptionRegistry` (no-Redis dev).
- The routing table maps each normalized MAC to a **list** of `(UserHash, StationName)` tuples so multiple users sharing a physical station each receive events.
- `ILatestReadingCache` (`DistributedLatestReadingCache`) stores the last reading per `(userHash, normalizedMac)` for the REST fallback path (`GET /api/dashboard/current`).
- `IAmbientSensorFields` (`DTOs/AmbientApi/`) is implemented by both `WeatherReadingDto` and `DeviceDataDto`. `CurrentReadingMapper.FromWeatherReading` and `FromDeviceData` delegate to a single private `MapSensorFields(IAmbientSensorFields, WeatherStation)` helper — add new sensor fields to the interface and all three DTOs to keep them in sync.

See the **realtime** agent for connection lifecycle, backoff, and teardown details.

Multiple users can each configure the same physical MAC address — the routing table fans out to all of them. One user owning multiple API/application key pairs simultaneously is out of scope for v1.

### Backend tests
**xUnit test method naming — no underscores (CA1707 is enforced).** Use PascalCase: `FormatCloudLayersWithNullInputReturnsNull`, not `FormatCloudLayers_NullInput_ReturnsNull`. This applies to both `[Fact]` and `[Theory]` methods.

Integration test factories (`WebApplicationFactory` subclasses like `MetricsTestFactory`, `DashboardTestFactory`) mock individual services via `ConfigureTestServices`. When a handler gains a new injected dependency (e.g. `IUserPreferencesStore`), the corresponding test factory must also register a mock for it — otherwise the handler resolves from the real DI graph, hits a missing DB, and returns 500 instead of the expected status.

---

## Folder responsibilities

```
backend/src/
├── AmbientWeather.Api/
│   ├── Controllers/                 One controller per BFF route group; stays thin
│   ├── Middleware/                  GlobalExceptionHandlerMiddleware
│   ├── Logging/                     SensitivePropertyRedactor (Serilog enricher)
│   └── Telemetry/                   AmbientUrlRedactionProcessor (OTel processor)
├── AmbientWeather.Application/
│   ├── Features/
│   │   ├── Alerts/                  GET /api/alerts/active (Weather.gov)
│   │   ├── Dashboard/               current, rainfall, layout, daily-extremes
│   │   ├── Metrics/                 history query + HistoryMetricMap
│   │   ├── Neighbors/               config, refresh, pinned-station current
│   │   ├── PublicSources/           CRUD + discover + current (WeatherGov, OpenMeteo)
│   │   ├── Realtime/                CurrentReadingMapper (Socket.IO → DTO)
│   │   └── Settings/                credentials, devices, preferences
│   ├── Common/Behaviours/           ValidationBehavior (MediatR pipeline)
│   ├── DTOs/                        Typed DTOs mirrored by frontend TypeScript types
│   └── Interfaces/                  Cross-layer contracts (IAmbientCredentialStore, etc.)
├── AmbientWeather.Domain/           Entities, MetricDefinition, domain exceptions, neighbor types
├── AmbientWeather.Infrastructure/
│   ├── Ambient/                     Rate-limited Ambient REST client, shared JSON options, circuit breaker
│   ├── Data/                        EF Core DbContext, migrations
│   ├── Neighbors/                   AmbientOpenWeatherProvider, WeatherGovNearbyObservationProvider,
│   │                                OpenMeteoNearbyBaselineProvider, discovery/aggregation services
│   ├── Repositories/                EF Core repository implementations
│   └── Services/                    Credential store, history, preferences, realtime pub/sub, cache
└── AmbientWeather.Workers/          HistorySyncWorker background service

backend/tests/
├── AmbientWeather.UnitTests/        Handler, validator, service unit tests
└── AmbientWeather.IntegrationTests/ WebApplicationFactory integration tests
```

---

## Where the route table lives

The BFF route table (method, route, and per-route notes on rate limiting, caching and query
parameters) and the Swagger and health endpoint notes are in `backend/src/AmbientWeather.Api/CLAUDE.md`.
It loads automatically for work under `AmbientWeather.Api/`. From anywhere else, read it before adding
or changing a route, the handler behind one, or its DTO. The generated contract is `docs/openapi.json`.

---

## Key external references

| Resource | URL |
|---|---|
| Ambient REST API | `https://rt.ambientweather.net/v1` |
| Ambient Realtime | `https://rt2.ambientweather.net` |
| Ambient Open API (neighbors) | `https://lightning.ambientweather.net` |
| Apiary docs + helper libraries | https://ambientweather.docs.apiary.io/ |
| Device data field reference | `docs/API_REFERENCE.md` |
| Full field spec | https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs |
| Open-Meteo Forecast API | https://open-meteo.com/en/docs |
