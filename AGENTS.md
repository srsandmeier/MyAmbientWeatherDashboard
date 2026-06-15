# Codex Project Rules — Ambient Weather Dashboard

This file is read by Codex on every task. Agent guidance files live in `.claude/agents/`;
read the relevant one before working in that layer.

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

# Backend
npm run api           # dotnet run — http://localhost:5080
npm run api:watch     # dotnet watch — hot reload
npm run lint:backend  # dotnet format whitespace (verify no changes)
npm run test:backend  # dotnet test all backend projects (Release)

# Run a single backend test class or method
dotnet test backend/AmbientWeather.slnx -c Release --filter "FullyQualifiedName~ClassName"

# Frontend (http://localhost:5173 — proxies /api and /hubs to backend)
npm run dev           # Vite dev server
npm run lint:frontend # ESLint (zero warnings)
npm run test:frontend # Vitest run (all)
cd frontend && npx vitest run src/path/to/Component.test.tsx  # single file

# Both stacks
npm run lint          # backend + frontend lint
npm test              # backend + frontend tests

# E2E (requires app running)
npm run test:e2e      # Playwright TypeScript tests
npm run test:e2e:p0   # P0 Playwright TypeScript tests only
npm run test:e2e:p1   # P1 Playwright TypeScript tests only

# Database migrations
npm run db:update                         # apply pending migrations
npm run db:migrate -- AddMigrationName    # add new migration
```

Swagger UI (dev only): `http://localhost:5080/swagger`

OpenAPI JSON is served at `/swagger/v1/swagger.json` in Development and Testing for local docs
and contract tests. Swagger UI is served only in Development; Swagger is disabled outside
Development/Testing.

Health endpoints (all unauthenticated): `GET /api/health` · `/api/health/live` · `/api/health/ready`

---

## Non-negotiable rules (apply everywhere)

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

### Backend architecture
- Controllers stay thin; business logic lives in MediatR handlers.
- Use FluentValidation for all input validation.
- EF Core read-only queries must use `.AsNoTracking()`.
- Every public C# member gets an XML doc comment.
- Logging: Serilog is wired in `Program.cs`. `SensitivePropertyRedactor` (enricher) automatically
  redacts any structured-logging property whose name is on the deny-list (apiKey, applicationKey,
  password, authorization, etc.) — name log properties descriptively; never pass raw credentials.
- Telemetry: Azure Monitor OpenTelemetry is optional (disabled without `AzureMonitor:ConnectionString`).
  `AmbientUrlRedactionProcessor` strips Ambient API query strings from HTTP spans before export.

### Frontend architecture
- TypeScript strict mode; **never use `any`**. All API responses have matching interfaces.
- Separate presentation components from data hooks (TanStack Query).
- Server state goes through TanStack Query with a centralized query key factory.
- Use shadcn/ui primitives and Tailwind CSS — no hardcoded hex colours outside the theme.
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
- UI changes must verify item visibility in both light and dark themes. Check headings, labels,
  icon-only buttons, form controls, dropdown/menu contents, dashboard tiles, station/source
  headers, and status text for sufficient foreground/background contrast. Prefer theme token
  utilities (`text-foreground`, `text-card-foreground`, `text-muted-foreground`, `bg-card`,
  `bg-background`) over inherited or hardcoded colours, and add focused tests or Playwright
  checks when a component changes visual state.

### Shell commands — platform safety
**Never use `sed -i`** — it silently truncates files on Windows/Git Bash (confirmed data-loss
incident). Use targeted in-place edits instead of bulk stream substitution.

### Realtime pipeline
Browsers must **not** connect directly to Ambient Socket.IO. The server-side
`RealtimeSubscriberService` subscribes to `rt2.ambientweather.net`, publishes to Redis,
and fans out via SignalR. See the **realtime** agent.

### Test everything
Every component, hook, handler, validator, and service gets tests before its phase is complete.
No phase is done until CI passes with new tests included.

| Layer | Tool |
|---|---|
| Backend handlers / validators | xUnit + Shouldly (+ `WebApplicationFactory` for integration) |
| Backend services / workers | xUnit + Moq or Testcontainers |
| Frontend components / hooks | Vitest + React Testing Library + jest-axe |
| E2E critical flows | Playwright Test TypeScript fixtures + focused helpers |
| API contract | OpenAPI snapshot ↔ TypeScript types |
| Backend lint | .NET SDK analyzers + Meziantou.Analyzer + Roslynator.Analyzers |
| Frontend lint | ESLint flat config + React/a11y/test/Vitest plugins |

Playwright: web-first locator assertions first, no fixed sleeps. Use `expect.poll` for non-locator
state that Playwright cannot auto-wait on directly, such as route mock counters,
API/cache/sync status, and captured payloads.
`data-test-id` is the primary locator.
TS Playwright standards: keep config/fixtures/flows/pages/specs separated under the E2E test
folder; tag specs with `@p0`/`@p1`; use `test.step` for multi-action flows; keep route mocks in
fixtures/mock builders; use mocked Auth0 only; avoid duplicate C#+TS coverage after parity passes;
keep TS strict with no `any` or untyped mock payloads; block accidental real external network
calls; set Playwright config for `data-test-id`, env-driven `baseURL`, CI-only retry,
trace/video/screenshot artifacts, and `forbidOnly`; never use arbitrary sleeps, CSS-class
selectors, XPath, or index-based selectors without a documented exception.

### Line endings
All files use **LF** (`\n`) line endings — never CRLF. `.editorconfig` and `.gitattributes` enforce this.

### Commit message format
```
<type>(<scope>): <short description>

feat(api): add rate-limit queue with token bucket
fix(ui): chart range picker not updating series
docs(plan): add Phase 11 neighbour config spec
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
| QA engineer | `.claude/agents/qa-engineer.md` | xUnit, Vitest, Playwright, contract tests, Playwright planner/generator/healer workflow |

---

## Folder responsibilities

```
backend/src/
├── AmbientWeather.Api/              Controllers, DI wiring (Program.cs), middleware
│   ├── Logging/                     SensitiveLogRedactor, SensitivePropertyRedactor
│   └── Telemetry/                   AmbientUrlRedactionProcessor
├── AmbientWeather.Application/      MediatR commands/queries, validators, DTOs, mappers
├── AmbientWeather.Domain/           Entities, MetricDefinition, domain exceptions
├── AmbientWeather.Infrastructure/
│   ├── Ambient/                     RateLimitedApiClient, AmbientRestClient
│   ├── Data/                        AmbientWeatherDbContext, EF Core migrations
│   ├── HealthChecks/                CacheHealthCheck (Redis vs in-memory detection)
│   ├── Repositories/                WeatherReadingRepository, HistorySyncTargetRepository
│   └── Services/                    AmbientCredentialStore, DeviceHistoryService, etc.
└── AmbientWeather.Workers/          HistorySyncWorker

backend/tests/
├── AmbientWeather.UnitTests/        Handler, validator, service unit tests
└── AmbientWeather.IntegrationTests/ WebApplicationFactory integration tests

frontend/src/
├── api/                             apiFetch client, typed BFF endpoint functions
├── auth/                            AppAuthProvider, Auth0 bridge
├── components/                      UI components (*.test.tsx co-located)
│   └── layout/                      AppShell, Navigation
├── config/                          Typed VITE_* env var access (app.ts)
├── hooks/                           TanStack Query hooks, useWeatherHub
├── lib/                             queryKeys factory, utils
├── pages/                           Dashboard, MetricDetail, Settings, etc.
├── providers/                       AppProviders, ThemeProvider
├── telemetry/                       ITelemetry, NullTelemetry, AppInsightsTelemetry, index
└── types/                           Interfaces mirroring backend DTOs

tests/e2e/                           Playwright Test TypeScript — fixtures, flows, page objects, specs
```

---

## BFF API surface (summary)

Full contract in `docs/DEVELOPMENT_PLAN.md`. Routes marked ✅ are implemented; others are planned.

| Area | Routes | Status |
|---|---|---|
| Health | `GET /api/health`, `/api/health/live`, `/api/health/ready` | ✅ |
| Settings | `GET/PUT /api/settings/preferences`, `POST/DELETE /credentials` | ✅ |
| Dashboard | `GET /api/dashboard/current`, `/rainfall`, `/layout`, `PUT /layout` | Planned |
| Metrics | `GET /api/metrics/{key}/history`, `/current` | Planned |
| Neighbours | `GET/PUT /api/neighbours/config`, `POST /refresh` | Planned |
| Realtime | SignalR hub at `/hubs/weather` | Planned |

---

## Key external references

| Resource | URL |
|---|---|
| Ambient REST API | `https://rt.ambientweather.net/v1` |
| Ambient Realtime | `https://rt2.ambientweather.net` |
| Ambient Open API (experimental neighbours) | `https://lightning.ambientweather.net` |
| Neighbour data research | `docs/NEIGHBOUR_DATA_RESEARCH.md` |
| Apiary docs + helper libraries | https://ambientweather.docs.apiary.io/ |
| Device data field reference | `docs/API_REFERENCE.md` |
| Full field spec | https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs |

---

## Out of scope (v1)

- WPF / desktop widget
- Multi-owned-station support (primary MAC only)
- Direct browser connection to Ambient Socket.IO
- Mobile-native apps
