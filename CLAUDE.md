# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Project Rules — Ambient Weather Dashboard

This file is read by Claude on every task. Agents in `.claude/agents/` handle specific
layers. Always read the relevant agent file before working in that area.

---

## Project overview

Decoupled full-stack **web application** for live and historical Ambient Weather station
data. React + TypeScript frontend, .NET 10 ASP.NET Core backend, PostgreSQL, Redis.

Clean Architecture with MediatR handlers. All dependencies are free and open-source
(MIT, Apache 2.0, or BSD-3-Clause). See `docs/DEVELOPMENT_PLAN.md` for the full phased plan.

---

## Commands

All commands run from the repo root unless noted. Requires Docker Desktop running.

```bash
# Start infrastructure (PostgreSQL 5432, Redis 6379)
docker compose up -d

# One-time setup
dotnet tool restore                      # installs dotnet-ef
npm install --prefix frontend            # install frontend dependencies
npm install --prefix tests/e2e           # install TS Playwright dependencies

# Initialize .NET User Secrets (first time only — see README.md for exact values)
dotnet user-secrets init --project backend/src/AmbientWeather.Api
dotnet user-secrets init --project backend/src/AmbientWeather.Workers
dotnet user-secrets set "ConnectionStrings:Postgres" "<value>" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "ConnectionStrings:Redis" "localhost:6379" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "Authentication:Authority" "<auth0-domain>" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "Authentication:Audience" "<auth0-audience>" --project backend/src/AmbientWeather.Api

# Frontend environment — copy once, then edit with Auth0 SPA values
# cp frontend/.env.example frontend/.env.local
# Key VITE_* vars: VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE,
#   VITE_API_BASE_URL (empty locally), VITE_APPLICATIONINSIGHTS_CONNECTION_STRING (empty to disable telemetry)
# Restart Vite after creating or changing .env.local
# If npm install fails with a certificate error: NODE_OPTIONS='--use-system-ca' npm install --prefix frontend

# Auth0 dashboard — add to Allowed Callback URLs: http://localhost:5173/auth/callback
# Add to Allowed Logout URLs and Allowed Web Origins: http://localhost:5173

# Unified dev start (concurrently: api:watch + Vite frontend)
npm run start:all

# Backend
npm run api           # dotnet run — http://localhost:5080
npm run api:watch     # dotnet watch — hot reload
npm run lint:backend  # dotnet format whitespace (verify no changes)
npm run test:backend  # dotnet test all backend projects (Release)

# Run a single backend test class or method
dotnet test backend/AmbientWeather.slnx -c Release --filter "FullyQualifiedName~ClassName"

# Frontend (http://localhost:5173 — proxies /api and /hubs to backend)
npm run dev           # Vite dev server
npm run build         # tsc type-check + Vite production build
npm run lint:frontend # ESLint (zero warnings)
npm run test:frontend # Vitest run (all)
cd frontend && npx vitest run src/path/to/Component.test.tsx  # single file

# Both stacks
npm run lint          # backend + frontend lint
npm test              # backend + frontend tests

# E2E — requires frontend dev server running on port 5173 (npm run dev).
# Backend is NOT required: Auth0 and all BFF calls are mocked by Playwright route handlers.
# Wait for Vite before running: timeout 60 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
# One-time browser install (matches @playwright/test version): cd tests/e2e && npm run install:browsers
# Auth0 domain is read from frontend/.env.local at runtime — keep that file present for E2E to work.
npm run test:e2e      # Playwright TypeScript suite (tests/e2e) — primary CI suite
npm run test:e2e:p0   # P0 smoke tests only
npm run test:e2e:p1   # P1 tests only
npx playwright show-report              # open HTML report (run from repo root after test:e2e)

# Database migrations
npm run db:update                         # apply pending migrations
npm run db:migrate -- AddMigrationName    # add new migration
# Troubleshooting: if a newly added endpoint returns 500 locally after pulling, run db:update first

# Utilities
npm run lint:fix      # ESLint auto-fix (frontend only; not enforced in CI)
cd frontend && npx vitest  # Vitest watch mode for TDD
npm run kill          # Kill background dotnet/node processes (Windows; useful after crashes)
```

**Runtime mock stations (no real hardware needed):** name a device `test.1` in Settings to inject one mock station into the dashboard; `test.2` injects two. Mock stations are local-only and never written to Ambient Weather.

Swagger UI (dev only): `http://localhost:5080/swagger`

OpenAPI JSON is served at `/swagger/v1/swagger.json` in Development and Testing for local docs
and contract tests. Swagger UI is served only in Development; Swagger is disabled outside
Development/Testing.

Health endpoints (all unauthenticated): `GET /api/health` · `/api/health/live` · `/api/health/ready`

---

## Non-negotiable rules (apply everywhere)

### Privacy — never hardcode or persist any address, GPS coordinate, or station ID

- **Never hardcode** any address, GPS coordinate, station ID, zip code, or place name
  anywhere — in code, tests, documentation, plan files, or memory — not even as
  a "placeholder" or "example" value.
- **Test fixtures must use faker libraries** to generate all location fields at runtime:
  - C# tests: `Bogus` (`new Bogus.Faker()`) — use `F.Address.Latitude()`, `F.Address.Longitude()`,
    `F.Address.StreetAddress()`, `F.Address.City()`, `F.Address.StateAbbr()`, `F.Address.ZipCode()`.
  - TypeScript tests: `@faker-js/faker` (`faker.location.*`) — `faker.location.latitude()`,
    `faker.location.longitude()`, `faker.location.buildingNumber()`, `faker.location.street()`,
    `faker.location.city()`, `faker.location.state({ abbreviated: true })`, `faker.location.zipCode()`.
  - Every test run must produce different values — no hardcoded values of any kind.
- **Never save** any address, GPS coordinate, station ID, or place name that a user enters or
  that is associated with a user's real deployment — not in memory, plans, or agent prompts.
  Use `{user-location}`, `{lat}`, `{lon}`, or `KXXX` as placeholders in documentation.
- **Documentation** must use generic placeholder coordinates (e.g. `{swLat}`, `{swLon}`)
  rather than real values, even in API examples or Postman-style test URLs.
- This rule applies to all agents listed in the agent index below.

### Keep it free
Every NuGet and npm package must be MIT, Apache 2.0, or BSD-3-Clause licensed. Check before adding.
Do not add anything else without updating the development plan and getting confirmation.
Prefer free-tier cloud services (Auth0 Free Tier) or self-hosted open-source (OpenIddict).

### No deprecated dependencies or APIs
- Use .NET 10+, React 19, Node 24 LTS, PostgreSQL 16, Redis 7.
- Prefer current Active LTS runtime versions. Supported Maintenance LTS versions are allowed
  only when an existing dependency or host requires them, and never after end-of-life.
- Do not add npm or NuGet packages flagged **deprecated** or end-of-life.
- Do not use deprecated .NET APIs, React class components, or legacy patterns.
- Before adding a dependency, confirm it is actively maintained.

### DRY — reuse before inventing
- Extend existing handlers, hooks, mappers, and components before creating parallel ones.
- Centralize metric definitions (`MetricDefinition`), unit conversion, TanStack Query keys,
  and Ambient field mappings — no copy-paste across layers.
- Extract shared logic only when used in **2+ places**; avoid premature abstraction.
- One typed API client function per BFF endpoint; one ECharts option builder for all charts.

### Best practices
- Smallest correct diff; match surrounding conventions; no unrelated drive-by refactors.
- User-facing BFF endpoints read from PostgreSQL or Redis — not live Ambient on every request.
- Every public API change updates backend DTO + frontend TypeScript type + tests.
- Prefer explicit configuration over magic abstractions.
- All I/O is async (`async`/`await`).

### Phase closeout documentation
When planning or completing any phase, keep the documentation chain in sync:
- Update `README.md` for newly implemented features, commands, setup steps, endpoints, or tooling.
- Update `docs/DEVELOPMENT_PLAN.md` with final status, verification, and deferrals.
- Update the immediately previous phase plan/closeout when carry-in work is completed, moved, or reclassified.
- Update the current phase plan before closeout so its checklist, verification, and deferred-work ledger match the code.
- When adding provider-specific plan items or integrations, include the official provider documentation link
  in the relevant phase plan and related-docs table. For Open-Meteo source fields, reference
  `https://open-meteo.com/en/docs`.
- Sanitize plans as they are created or updated: use placeholders or clearly dummy local-only values for
  tenant domains, client IDs, passwords, tokens, addresses, station IDs, personal paths, and deployment-specific
  identifiers. Do not add real or reusable local values to plans with the intent to clean them later.
- Include a final **Check EF migrations** step in every phase closeout going forward:
  `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.

### No plain-text secrets
Ambient `apiKey` and `applicationKey` are stored **server-side only**, encrypted with
ASP.NET Core Data Protection. Never expose them to the React frontend, never write them
to `appsettings.json` in plain text, and never log them. Use .NET User Secrets locally.
See `docs/SECURITY.md` and the **security** agent.

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

### Frontend architecture
- TypeScript strict mode; **never use `any`**. All API responses have matching interfaces.
- **Type predicate narrowing**: `(k): k is T` is only valid when `T` is assignable to the parameter's type. When filtering a const array whose element type is narrower than the target union, TypeScript rejects the predicate (TS2677). Fix: drop the predicate and cast the result — `array.filter((k) => allowed.includes(k)) as T[]`.
- **`ApiResult` error mocks must include `status`**: the `ok: false` branch of `ApiResult<T>` is `{ readonly ok: false; readonly status: number; readonly error: string }`. Always include `status` when mocking failures — e.g. `{ ok: false, status: 500, error: '...' }`.
- Separate presentation components from data hooks (TanStack Query).
- Server state goes through TanStack Query with a centralized query key factory.
- Use shadcn/ui primitives and Tailwind CSS — no hardcoded hex colours outside the theme. The `no-restricted-syntax` ESLint rule rejects hex literals in JSX `className` strings; use Tailwind semantic tokens (`text-foreground`, `text-destructive`, …) or CSS variables instead. Non-semantic colour utilities (e.g. `text-green-800`) must always be paired with a `dark:` counterpart (e.g. `dark:text-green-300`).
- **React Compiler is active** (`react-hooks/preserve-manual-memoization` is enforced). `useMemo`/`useCallback` dependency arrays must exactly match what the compiler infers. A common pitfall: using `obj.property` as a dep when the compiler tracks the parent object (`obj`). Fix: use the object reference as the dep and access the property inside the callback. `// eslint-disable-next-line react-hooks/exhaustive-deps` suppresses the exhaustive-deps rule but does **not** suppress `preserve-manual-memoization` — the lint error will still fail CI.
- **TanStack Query v5 disabled-query pattern**: when `enabled: false` a query parks at `{ isPending: true, fetchStatus: 'idle' }` without fetching. Any hook that conditionally enables a query must guard its exposed `isPending` as `isPending && fetchStatus !== 'idle'` so callers can distinguish "not yet enabled" from "actively loading". See `useNeighborsConfig.ts` and `useCredentialStatus.ts` for the established pattern.
- `@typescript-eslint/switch-exhaustiveness-check` is enforced. Every `switch` on a discriminated union must be exhaustive — cover all members or add a `default` that throws or narrows to `never`.
- `DevAuthBypass=true` in `appsettings.Development.json` injects a mock user so the backend
  accepts requests without a real Auth0 token. Set to `false` to require real JWT.
- Telemetry: use `ITelemetry` from `src/telemetry/index.ts` — never import
  `@microsoft/applicationinsights-web` or any RUM SDK directly into page/component/hook code.
- Every interactive element (buttons, inputs, selects, toggles, links, form fields) and every
  dynamic/data-driven element (tiles, chart panels, list rows, status indicators) **must** carry
  a `data-test-id` attribute with a stable, kebab-case, human-readable value.
  Use the pattern `<area>-<element>[-<qualifier>]` (e.g. `dashboard-metric-tile`,
  `settings-save-credentials-button`, `chart-range-selector`). Never derive the value from
  dynamic data (indices, IDs, timestamps). Playwright E2E tests and RTL component tests must
  locate interactive/dynamic elements via `data-test-id` — not by CSS class, XPath, or text
  that is likely to change.

### Shell commands — platform safety
**Never use `sed -i`** — it silently truncates files on Windows/Git Bash (confirmed data-loss
incident). Use the `Edit` tool with `replace_all: true` for bulk in-place substitutions.

**On Windows, use `python` not `python3`** — the `python3` command is intercepted by a Windows
app execution alias that redirects to the Microsoft Store instead of the installed interpreter.
A `PreToolUse` hook in `~/.claude/settings.json` blocks this automatically.

**PowerShell via Bash — always use single quotes around the `-Command` argument:**
```bash
powershell -Command 'Write-Output "ok" 2>$null'
```
Double-quoted `-Command` strings cause Bash to expand `$null` (and any other `$var`) before
PowerShell sees them, producing quoting errors. Single quotes prevent Bash expansion entirely.
If a PowerShell string literal inside the command itself needs single quotes, escape the dollar
sign instead: `"... 2>\$null ..."`, but prefer the single-quote outer form.

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

### Test everything
Every component, hook, handler, validator, and service gets tests before its phase is complete.
No phase is done until CI passes with new tests included.

| Layer | Tool |
|---|---|
| Backend handlers / validators | xUnit + Shouldly (+ `WebApplicationFactory` for integration) |
| Backend services / workers | xUnit + Moq or Testcontainers |
| Frontend components / hooks | Vitest + React Testing Library + jest-axe |
| E2E critical flows | Playwright Test TypeScript (`tests/e2e/`) — fixtures, page objects, `expect.poll` |
| API contract | OpenAPI snapshot ↔ TypeScript types |
| Backend lint | .NET SDK analyzers + Meziantou.Analyzer + Roslynator.Analyzers |
| Frontend lint | ESLint flat config + React/a11y/test/Vitest plugins |

Playwright: web-first locator assertions first, no arbitrary sleeps. Use `expect.poll` for
non-locator async state (route mock counters, captured request payloads, PUT/POST capture).
`data-test-id` is the primary locator; `page.getByTestId()` is verified to work reliably in
the TS suite. `BasePage.byTestId()` centralises this in page objects.

**TS Playwright standards** (`tests/e2e/`): config / fixtures / pages / specs are separated;
specs are tagged `@p0` / `@p1`; route mocks live in `fixtures/auth.ts` and `fixtures/bff.ts`;
every spec that touches authenticated pages must use the `homePage`, `settingsPage`, or
`metricDetailPage` fixture — never raw `{ page, context }` — so Auth0 + BFF mocks are wired
before any navigation. Test-specific route overrides are registered on `context` inside the test
body (LIFO: later registration = higher priority). `blockExternalNetwork` is registered first
(lowest priority) to abort unmatched external calls; localhost is always passed through.

**xUnit test method naming — no underscores (CA1707 is enforced).** Use PascalCase: `FormatCloudLayersWithNullInputReturnsNull`, not `FormatCloudLayers_NullInput_ReturnsNull`. This applies to both `[Fact]` and `[Theory]` methods.

Frontend HTTP mocking: use `vi.stubGlobal('fetch', vi.fn())` returning typed `Response` objects. MSW is not installed; do not add it without a deliberate decision.

Integration test factories (`WebApplicationFactory` subclasses like `MetricsTestFactory`, `DashboardTestFactory`) mock individual services via `ConfigureTestServices`. When a handler gains a new injected dependency (e.g. `IUserPreferencesStore`), the corresponding test factory must also register a mock for it — otherwise the handler resolves from the real DI graph, hits a missing DB, and returns 500 instead of the expected status.

See the **qa-engineer** agent.

### Line endings
All files use **LF** (`\n`) line endings — never CRLF. `.editorconfig` and `.gitattributes` enforce this. Git is configured with `core.autocrlf=false` and `core.eol=lf`.

### Commit message format
```
<type>(<scope>): <short description>

feat(api): add rate-limit queue with token bucket
fix(ui): chart range picker not updating series
docs(plan): add Phase 11 neighbor config spec
refactor(sync): extract history pagination into service
test(tiles): add MetricTile render tests
```
Types: feat · fix · docs · refactor · test · chore

---

## Agent index

| Agent | File | When to use |
|---|---|---|
| Architect | `.claude/agents/architect.md` | Cross-cutting design, Clean Architecture, maintainability |
| Backend | `.claude/agents/backend.md` | MediatR handlers, BFF controllers, workers |
| Frontend | `.claude/agents/frontend.md` | React components, hooks, pages, TanStack Query |
| Data | `.claude/agents/data.md` | EF Core, migrations, PostgreSQL schema, sync storage |
| API client | `.claude/agents/api-client.md` | Ambient REST, nearby public providers, rate limiter, Socket.IO client |
| Realtime | `.claude/agents/realtime.md` | Socket.IO → Redis → SignalR pipeline |
| Charts | `.claude/agents/charts.md` | Apache ECharts detail views, chart controls |
| Security | `.claude/agents/security.md` | Auth, credential encryption, authorization, rate limits |
| Performance | `.claude/agents/performance.md` | Runtime efficiency, query shape, caching, memory, scalability |
| Domain UX | `.claude/agents/domain-ux.md` | Ambient Weather product logic, user flows, dashboard/settings UX |
| DevOps | `.claude/agents/devops.md` | Docker, GitHub Actions, deployment |
| QA engineer | `.claude/agents/qa-engineer.md` | xUnit, Vitest, Playwright, contract tests |

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

frontend/src/
├── api/                             Typed BFF endpoint functions (one per route)
├── components/                      UI components with co-located *.test.tsx files
├── hooks/                           TanStack Query hooks, useWeatherHub
├── lib/                             Centralized query key factory, utilities
├── pages/                           Route-level page components
├── telemetry/                       ITelemetry abstraction (never import RUM SDK directly)
└── types/                           TypeScript interfaces mirroring backend DTOs

tests/e2e/                           Playwright TS — playwright.config.ts, fixtures/, pages/, specs/
```

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
