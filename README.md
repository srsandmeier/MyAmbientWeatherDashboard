# Ambient Weather Dashboard

Frontend GitHub Pages deployments use the pattern `https://<github-user>.github.io/<repo-name>/`.
The backend API must be hosted separately and configured with `VITE_API_BASE_URL`.


A full-stack web application for live and historical data from your
[Ambient Weather](https://ambientweather.com) personal weather station or public sources.

While applying for jobs, I have found that many ask for a Git Repo. Since all of my work in the last 10+ years has been private, proprietary, or just local Arduino builds, I did not have anything publicly available.

I decided I needed to direct AI tools in the building of a Full application, including Security and testing. This way, I could demonstrate competency with AI tools and some of the industry's best tools that are free-ish to me.

I figured I have a weather station, and I had played with it's API's before in Postman, why not build on that?

> **Project name:** `AmbientWeatherDashboard` (display: *Ambient Weather Dashboard*).

Built with free, open-source tools — no paid dependencies.

## Features

- **Live dashboard** — indoor/outdoor temperature and humidity, pressure, UV index,
  solar radiation, wind speed, and rainfall summaries
- **Rainfall breakdown** — last event, day, week, month, and year
- **Metric drill-down** — click any tile to open a customizable time-series chart
- **Historical date view** — pick a specific date and inspect that day's metric history
- **Neighbor compare** — toggle between your station and an average of nearby
  public stations (count, radius, and aggregation method are user-configurable)
- **Custom layout** — Settings-managed Default/Custom dashboard blocks; layout saved per user
- **Realtime updates** — server-side Ambient Socket.IO subscriber pushes changes
  to the browser via Redis pub/sub and SignalR
- **Settings** — encrypted Ambient API credentials, units, date format, theme,
  station sync, nicknames, primary station, dashboard visibility, and per-device metrics
- **Runtime mock stations** — name a device `test.1` to inject one mock station into the
  dashboard for preview/development; `test.2` injects two, and so on. Mock stations are
  local-only and never written to Ambient Weather.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | .NET 10 ASP.NET Core Web API, MediatR, FluentValidation, EF Core, Serilog |
| Database | PostgreSQL 16 for app-owned state; Ambient API + Redis cache for v1 history |
| Cache / pub-sub | Redis 7 |
| Auth | Auth0 Free Tier (or OpenIddict) |
| External weather/location APIs | Ambient REST/realtime/Open API, Weather.gov/NWS, Open-Meteo, Nominatim geocoding |
| Frontend | React 19, TypeScript, Vite, React Router v7, shadcn/ui/Radix primitives, Tailwind CSS v4, TanStack Query v5, Lucide icons |
| Realtime | SignalR (browser) ← Redis pub-sub ← server-side Socket.IO subscriber |
| Charts | Apache ECharts via `echarts-for-react` |
| Layout editor | CSS Grid + structured Settings builder *(Phase 10)* |
| Telemetry | Serilog structured logging; optional Azure Monitor OpenTelemetry (backend) + Application Insights React SDK (frontend) |
| API docs / contracts | Swashbuckle OpenAPI, Swagger UI in Development, OpenAPI snapshot tests |
| Testing | xUnit + Shouldly + Moq + Bogus + Testcontainers, Vitest + React Testing Library + jest-axe, Playwright Test TypeScript |
| Code quality | .NET SDK analyzers, Meziantou.Analyzer, Roslynator.Analyzers, ESLint (React, a11y, Testing Library, Vitest plugins), CodeQL |
| CI/CD | GitHub Actions, GitHub Pages, Dependabot, deployment artifact workflows |
| AI/code-assist tools | Claude, Codex, GitHub Copilot |

See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for architecture, data model,
API contract, and phased execution plan.

## Documentation

| Doc | Description |
|---|---|
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | Phased build plan, architecture, data model, BFF API |
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Ambient Weather REST/realtime endpoints and field reference |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Authentication, credential encryption, rate limiting |
| [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) | WCAG 2.2 AA target, current coverage, and known limitations |
| [`docs/PHASE_12_COMPLETION_PLAN.md`](docs/PHASE_12_COMPLETION_PLAN.md) | Metric detail charts, contracts, accessibility, and production hardening |
| [`docs/e2e-specs/e2e-test-flows.md`](docs/e2e-specs/e2e-test-flows.md) | Extracted user journeys and E2E scenario plan across dashboard, settings, layouts, neighbors, public sources, alerts, and charts |
| [`docs/AMBIENT_HISTORY_API_RESEARCH.md`](docs/AMBIENT_HISTORY_API_RESEARCH.md) | Research notes on Ambient REST history API pagination and caching |
| [`docs/NEIGHBOR_DATA_RESEARCH.md`](docs/NEIGHBOR_DATA_RESEARCH.md) | Ambient Open API neighbor research and fallback-provider notes |

Archived phase closeouts remain public build-history artifacts under `docs/archive/phases/`:

| Doc | Description |
|---|---|
| [`docs/archive/phases/PHASE_2_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_2_COMPLETION_PLAN.md) | Auth, Swagger, rate limiting, and API scaffolding closeout |
| [`docs/archive/phases/PHASE_3_FOUNDATION_PLAN.md`](docs/archive/phases/PHASE_3_FOUNDATION_PLAN.md) | React shell, Auth0, routing, and Tailwind foundation plan |
| [`docs/archive/phases/PHASE_3_FIXES_PLAN.md`](docs/archive/phases/PHASE_3_FIXES_PLAN.md) | Phase 3 post-merge fixes and test stabilization |
| [`docs/archive/phases/PHASE_5_OBSERVABILITY_PLAN.md`](docs/archive/phases/PHASE_5_OBSERVABILITY_PLAN.md) | Serilog, health checks, and Azure Monitor OpenTelemetry |
| [`docs/archive/phases/PHASE_6_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_6_COMPLETION_PLAN.md) | Ambient API client, typed exceptions, and history closeout |
| [`docs/archive/phases/PHASE_7_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_7_COMPLETION_PLAN.md) | Settings, credentials, station/device closeout |
| [`docs/archive/phases/PHASE_8_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_8_COMPLETION_PLAN.md) | Ambient history API and Redis cache closeout |
| [`docs/archive/phases/PHASE_9_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_9_COMPLETION_PLAN.md) | Realtime pipeline, SignalR hub, and dashboard current endpoint |
| [`docs/archive/phases/PHASE_10_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_10_COMPLETION_PLAN.md) | Dashboard layout, metric tiles, and Settings-managed custom builder |
| [`docs/archive/phases/PHASE_11_COMPLETION_PLAN.md`](docs/archive/phases/PHASE_11_COMPLETION_PLAN.md) | Nearby public station comparison, provider discovery, and Phase 11 deferrals |
| [`docs/archive/plans/CODEBASE_IMPROVEMENT_PLAN.md`](docs/archive/plans/CODEBASE_IMPROVEMENT_PLAN.md) | Completed production-readiness and maintainability improvement plan |

### Build-process transparency

This repository intentionally keeps its agent guidance and improvement-planning files public
(`AGENTS.md`, `CLAUDE.md`, `.claude/agents/*`, `.cursorrules`, and
`docs/archive/plans/CODEBASE_IMPROVEMENT_PLAN.md`) to show how the project was designed, reviewed, and built.
These files should not contain secrets; public-release readiness includes a final scan of them.

External references:

- [Ambient Weather REST API (Apiary)](https://ambientweather.docs.apiary.io/)
- [Device data field specs](https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs)

## Requirements

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (targets `net10.0`)
- [Node.js 24 LTS](https://nodejs.org/) and npm 11+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (PostgreSQL + Redis)
- Ambient Weather account with API key and application key
  ([get keys here](https://ambientweather.net/account))
- Auth0 tenant (free tier) or local OpenIddict setup

## Local development

### One-time setup

```bash
# Restore local tools (dotnet-ef)
dotnet tool restore

# Install root orchestration dependencies
npm install

# Install frontend and E2E dependencies
npm install --prefix frontend
npm install --prefix tests/e2e

# Initialize .NET User Secrets for the API and Workers projects
dotnet user-secrets init --project backend/src/AmbientWeather.Api
dotnet user-secrets init --project backend/src/AmbientWeather.Workers

# Set required local secrets (use a local-only password and keep it out of source control)
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=AmbientWeatherDB;Username=postgres;Password=change-me-local-only" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "ConnectionStrings:Redis" "localhost:6379" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "Authentication:Authority" "https://<your-auth0-domain>/" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "Authentication:Audience" "https://ambient-weather-dashboard-api" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "UserAgent:Contact" "<your-contact-email-or-url>" --project backend/src/AmbientWeather.Api
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=AmbientWeatherDB;Username=postgres;Password=change-me-local-only" --project backend/src/AmbientWeather.Workers

# Frontend Auth0 SPA values (public, browser-safe)
# Copy to frontend/.env.local for local development (see Frontend environment variables section).
VITE_AUTH0_DOMAIN=<your-auth0-domain>
VITE_AUTH0_CLIENT_ID=<your-auth0-spa-client-id>
VITE_AUTH0_AUDIENCE=https://ambient-weather-dashboard-api
VITE_API_BASE_URL=

# Apply the initial database migration
docker compose up -d
npm run db:update
```

Docker Compose starts PostgreSQL on port 5432 and Redis on port 6379 using local-only defaults.
Use your own Auth0 SPA tenant/app for local development and do not commit tenant-specific values.
The Auth0 API Identifier / Audience should be `https://ambient-weather-dashboard-api`.
The Auth0 login/logout/callback flow is wired in the Phase 3 React frontend shell.
In local development, the SPA uses Auth0 localStorage caching so a normal browser reload does not
force a new authorization prompt; production keeps Auth0's default in-memory cache. If Auth0 still
shows "requesting access" on every reload, check that the API is marked first-party/trusted for the
SPA and that user consent can be skipped for the local API audience.
`UserAgent:Contact` is not a secret, but production deployments should set it to a monitored
email address or support URL for Weather.gov and Nominatim provider-policy compliance.

### Running locally

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Install npm dependencies once if you did not do the one-time setup above
npm install
npm install --prefix frontend
npm install --prefix tests/e2e

# All commands below run from the repo root (package.json)

# Unified dev start — spins up hot-reload backend + Vite frontend concurrently
npm run start:all      # concurrently: api:watch + dev; prints a session summary on exit

# Or start each separately in different terminals:
npm run api            # dotnet run — backend API on http://localhost:5080
npm run api:watch      # dotnet watch — hot-reload for backend development
npm run dev            # Vite dev server — frontend on http://localhost:5173

npm run db:update                   # apply EF Core migrations to local Postgres
npm run db:migrate -- <Name>        # add a new migration (e.g. npm run db:migrate -- AddUserTable)

npm run lint           # backend dotnet format + frontend ESLint
npm run lint:backend   # dotnet format whitespace only
npm run lint:frontend  # ESLint only
npm test               # backend + frontend tests; prints a pass/fail summary (both always run)
npm run test:backend   # dotnet test only
npm run test:frontend  # Vitest only
npm run test:contract  # OpenAPI snapshot/TypeScript contract tests
npm run test:e2e       # Playwright TypeScript tests — see "Running E2E tests" below for prerequisites
npm run test:e2e:p0    # P0 Playwright TypeScript tests only
npm run test:e2e:p1    # P1 Playwright TypeScript tests only
npm run build          # frontend production build
npm run swagger:generate # regenerate docs/openapi.json from backend contract
npm run kill           # stop local dotnet/node dev processes
```

#### Running E2E tests

Auth0 and all BFF calls are mocked by Playwright — the backend is **not** required. Only the
frontend dev server needs to be running.

**One-time browser install** (re-run after updating `@playwright/test`):
```bash
cd tests/e2e && npm run install:browsers
```

**Terminal A:**
```bash
npm run dev
```

**Terminal B** (once the Vite server is ready on port 5173):
```bash
# Optional: wait for Vite before running
timeout 60 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
npm run test:e2e
```

After the run, open the HTML report from the E2E package:
```bash
cd tests/e2e
npx playwright show-report ../../playwright-report
```

Playwright trace, video, and screenshot artifacts are saved on failure for post-mortem debugging.
In CI, the TypeScript E2E suite runs as separate P0 and P1 Playwright jobs, with suite-specific
HTML report and failure artifact uploads.

Swagger UI (Development only): `http://localhost:5080/swagger`

OpenAPI JSON is served at `/swagger/v1/swagger.json` in Development and Testing for local docs
and contract tests. Swagger UI is served only in Development; Swagger is disabled outside
Development/Testing.

Health endpoints (all unauthenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Simple liveness — returns `{"status":"healthy"}` |
| `GET /api/health/live` | Process liveness with JSON check report |
| `GET /api/health/ready` | Dependency readiness (PostgreSQL + cache) |

Phase 7 settings endpoints (authenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/settings/credentials` | Safe credential status; never returns keys |
| `POST /api/settings/credentials` | Validate and save Ambient API/application keys encrypted server-side |
| `DELETE /api/settings/credentials` | Remove stored Ambient credentials |
| `GET /api/settings/preferences` | Units, date format, and theme |
| `PUT /api/settings/preferences` | Save units, date format, and theme |
| `GET /api/settings/devices` | List synced owned Ambient stations/devices |
| `POST /api/settings/devices/sync` | Refresh station metadata from Ambient |
| `PUT /api/settings/devices/{mac}` | Save nickname, primary station, dashboard visibility, and selected metrics |

Phase 8 metric history endpoint (authenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/metrics/{metricKey}/history` | Chart-ready Ambient history for preset ranges, custom `from`/`to`, or `range=date&date=YYYY-MM-DD`; uses the user's default station unless `deviceId` is provided |

Supported Phase 8 history query options:
- `range=24h|7d|30d|90d|1y|custom|date`
- `granularity=auto|raw|hour|day`
- `source=my` only; neighbor history remains deferred

Device history endpoints (authenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/devices/{macAddress}/history` | Direct device history lookup with `limit` and optional `endDate`; capped at 288 readings |
| `DELETE /api/v1/devices/{macAddress}/cache` | Invalidate the server-side history cache for an owned device |

Phase 9 realtime and dashboard endpoints (authenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard/current` | Latest current reading for the primary station — reads the 5-minute latest-reading Redis cache first; falls back to Ambient REST on cache miss |
| `GET /hubs/weather` | SignalR WebSocket hub — authenticated clients receive `ReadingUpdated` events pushed from the server-side Socket.IO subscriber |

**SignalR connection (frontend):** `useWeatherHub` connects to `/hubs/weather` using the Auth0 access token via `accessTokenFactory`. On every `ReadingUpdated` push the hook writes the new `CurrentReadingDto` directly into the TanStack Query `dashboard.current` cache. A 60-second `refetchInterval` on `useDashboardCurrent` acts as a REST fallback when the WebSocket is disconnected.

Phase 10 dashboard layout and rainfall endpoints (authenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard/rainfall` | Rainfall accumulation snapshot (event/day/week/month/year) — same cache path as `/current` |
| `GET /api/dashboard/daily-extremes` | Today's outdoor and indoor temperature highs/lows for the primary station |
| `GET /api/dashboard/layout` | Active dashboard layout (Default or Custom mode); seeds a Default layout on first access |
| `PUT /api/dashboard/layout` | Save Default or Custom layout. Custom items validated: max 12, unique ids, metric keys in shared registry, station ownership, fill-mode constraints |

**Temperature decimal places preference:** `PUT /api/settings/preferences` now accepts `temperatureDecimals: 0 | 1 | 2`. Default is `1`. Set to `0` to round temperatures to the nearest degree.

Phase 11 neighbor comparison endpoints (authenticated):

| Endpoint | Purpose |
|---|---|
| `GET /api/neighbors/config` | Load neighbor comparison settings, including provider availability and pinned stations |
| `PUT /api/neighbors/config` | Save neighbor settings, enabled providers, radius/age limits, and pinned stations |
| `POST /api/neighbors/refresh` | Clear the cached neighbor station list and rediscover nearby public stations |
| `GET /api/neighbors/stations/current?provider={provider}&sourceId={sourceId}` | Current reading for a pinned neighbor station from the user's cache |
| `GET /api/neighbors/comparison-stations?macAddress={mac}` | Ambient stations contributing to neighbor comparison for an owned station; `macAddress` is optional |
| `GET /api/dashboard/current?source=neighbors` | Aggregated neighbor current reading for the dashboard source toggle |
| `GET /api/public-sources/discover?q={query}` | Search by zipcode or city/state for Weather.gov and Open-Meteo source candidates |
| `GET /api/public-sources` | List user-selected Weather.gov/Open-Meteo source stations |
| `POST /api/public-sources` | Add a user-selected Weather.gov/Open-Meteo source station |
| `PUT /api/public-sources/{id}` | Update a saved public source station |
| `DELETE /api/public-sources/{id}` | Delete a saved public source station |
| `GET /api/public-sources/{id}/current` | Current reading for a saved Weather.gov/Open-Meteo public source |
| `GET /api/alerts/active?area={code}` | Active Weather.gov/NWS alerts for the user's default station area, or a selected NWS area/zone/state code |

Phase 11 providers: Weather.gov/NWS observations and Open-Meteo are enabled by default when station coordinates are available. Ambient Open API discovery remains feature-flagged with `Features:AmbientOpenApiEnabled=true`.

If `npm install` fails with a certificate error on your network:
- PowerShell: `$env:NODE_OPTIONS='--use-system-ca'; npm install`
- Git Bash: `NODE_OPTIONS='--use-system-ca' npm install`

API listens on `http://localhost:5080`. The Vite dev server (port 5173) proxies `/api` and `/hubs` to the backend — no CORS setup needed in development.

#### Troubleshooting: API 500 after new backend features

If a newly added endpoint returns `500 Internal Server Error` locally after pulling or switching work,
apply pending EF Core migrations against the local Docker database:

```bash
npm run db:update
```

For example, `GET /api/public-sources` requires the Phase 11 `public_weather_sources` table.

### Frontend environment variables

Copy `frontend/.env.example` to `frontend/.env.local` before starting the frontend dev server,
then replace the placeholder Auth0 values with your local Auth0 SPA application values. The
committed defaults intentionally use `example.auth0.test` for mocked/local examples only; if
`frontend/.env.local` is missing, the app shows a clear missing-config error instead of redirecting
to a placeholder host. Restart Vite after creating or changing `frontend/.env.local` because Vite
reads environment files at startup.

| Variable | Purpose |
|---|---|
| `VITE_AUTH0_DOMAIN` | Auth0 tenant domain (e.g. `dev-xxx.us.auth0.com`) |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA application client ID |
| `VITE_AUTH0_AUDIENCE` | Auth0 API audience — must match backend `Authentication:Audience` |
| `VITE_API_BASE_URL` | Override BFF base URL — leave empty locally (Vite proxy handles it) |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Application Insights connection string — leave empty to disable frontend telemetry |

These are **not secrets** — Auth0 SPA client IDs are public. Never add Ambient `apiKey` or
`applicationKey` to any `VITE_*` variable; those stay server-side only.

#### Troubleshooting: telemetry disabled

If you see `Azure Monitor telemetry is disabled` in backend startup logs, the backend connection
string is not set. Add it to User Secrets:
```bash
dotnet user-secrets set "AzureMonitor:ConnectionString" "<your-connection-string>" --project backend/src/AmbientWeather.Api
```

For frontend telemetry, set `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` in `frontend/.env.local`.
Both default to off in local development — this is intentional.

### Auth0 callback URLs

In your Auth0 dashboard → Application → Settings add to **Allowed Callback URLs**:
```
http://localhost:5173/auth/callback
https://<github-user>.github.io/<repo-name>/auth/callback
```
And to **Allowed Logout URLs** and **Allowed Web Origins**:
```
http://localhost:5173
https://<github-user>.github.io/<repo-name>
```

Copy `.env.example` to `.env` and adjust connection strings before starting Docker services.

## Project structure

```
/
├── backend/
│   ├── AmbientWeather.slnx
│   ├── src/
│   │   ├── AmbientWeather.Api/           # Controllers, SignalR hub, DI
│   │   ├── AmbientWeather.Application/   # MediatR handlers, validators, DTOs
│   │   ├── AmbientWeather.Domain/        # Entities, metric definitions
│   │   ├── AmbientWeather.Infrastructure/ # Ambient clients, EF Core, Redis
│   │   └── AmbientWeather.Workers/       # Optional history sync background service
│   └── tests/
├── frontend/
│   └── src/                              # React components, hooks, pages, types
├── tests/
│   └── e2e/                              # Playwright TypeScript end-to-end tests
├── docker-compose.yml
└── docs/
```

## Architecture (summary)

```
Browser (React + SignalR)
    ↕
ASP.NET BFF API  ←→  PostgreSQL / Redis
    ↕
Ambient REST (rt.ambientweather.net)
Ambient Realtime (rt2.ambientweather.net)  ← RealtimeSubscriberService
Ambient Open API (lightning.ambientweather.net)  ← neighbor discovery
```

Ambient API keys never reach the browser. All outbound Ambient HTTP traffic passes
through a server-side rate-limited client (1 req/s per user key).

## Current phase status

- Phases 1-11 are complete through the realtime pipeline, live dashboard tiles, Settings-managed layout editor, neighbor comparison, public source stations, public weather alerts, and layout ticker enhancements.
- Phase 11 added:
  - Neighbor public station discovery and aggregation (Weather.gov, Open-Meteo; Ambient Open API feature-flagged)
  - Dashboard Own Station / Neighbors source toggle for the Default dashboard layout
  - Nearby station discovery/settings in Settings > My Stations > Public Sources, including City/State or ZIP fallback when no owned station coordinates exist
  - Public source stations (Weather.gov / Open-Meteo) in Default and Custom layouts
  - Public source discovery by zipcode / city+state
  - Weather.gov active alert banner and ticker on the dashboard
  - Ticker channel source and per-ticker NWS alerts zone in the Custom layout builder
  - Public sources and pinned stations integrated into the Default Settings station list (`ExternalSourceRow`, `PinnedSourceRow`) with provider badges, enabled toggles, and persisted per-source metric selection
  - Section 8C assembled-response cache benchmark completed; p95 was 2.70 ms over 100 warmed requests, so no extra Redis assembled-response cache was added
- Phase 12 added ECharts metric detail charts with range, single-day, granularity, owned-station
  comparison, and collapsible data-table controls; OpenAPI contract tests; reduced-motion and
  live-region accessibility coverage; typed options validation (`AmbientApiOptions`,
  `AmbientResilienceOptions`, `RedisOptions`, `ApplicationAuthenticationOptions`,
  `UserAgentOptions`); and the Playwright Test TypeScript E2E suite across dashboard, settings,
  layout builder, Default-layout neighbors, public sources, alerts, and metric detail flows.
  See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md).

## Device flexibility

Users can have multiple devices that may or may not be co-located. Some users may have only
indoor or outdoor sensors. The dashboard should be flexible enough to support various device
configurations and user preferences.

Phase 7 added server-backed settings for nicknames, primary station, dashboard visibility, and
per-device metric selections. Later dashboard and chart phases will use those settings to display
one device at a time, compare owned devices, and handle partial sensor support cleanly.

Other public weather and map APIs may be added later for additional context and comparison
through the neighbor-provider abstraction. Open-Meteo source-field expansion should reference the
official [Open-Meteo Forecast API docs](https://open-meteo.com/en/docs).

## 2.0 feature candidates

- **Offline cached history mode** — when Ambient credentials are missing or removed, show only
  locally cached historical data in a clearly labeled read-only mode: “Cached history only.
  Re-enter credentials to refresh.” Do not use live/current wording, and do not show refresh
  controls that imply new Ambient data can be fetched.
- **Local history hardening** — make PostgreSQL raw-reading sync, backfill, retention, and rollups
  production-ready before relying on offline history for long ranges.
- **Provider history overlays** — enable Weather.gov, Open-Meteo, Ambient Open, or pinned-source
  chart overlays only after provider history or cached samples can produce honest time series.
- **Offline freshness indicators** — show last cached timestamp, covered date range, and missing-gap
  warnings anywhere cached history is displayed.

## Licence

Open-source dependencies only (MIT, Apache 2.0, or BSD-3-Clause). See the development plan for the
approved package list.
