# Phase 5 — Observability, Health, And Deployment Baseline Plan

Created 2026-05-30 after re-checking Phase 4 against `master`.

## Phase 4 Audit Result

Phase 4 is scaffold-complete, but not fully activated. The core quality gates exist and
pass locally:

- `npm run lint` passes.
- `npm run test` passes: 93 backend unit tests, 38 backend integration tests, 35 frontend tests.
- `npm run build` passes.
- `npm run test:e2e` passes only because the single Playwright browser test is ignored.

Phase 4 can remain marked complete only if "complete" means the quality scaffold exists.
The browser E2E suite, P0/P1 splitting, trace/video artifacts, and flake-warning handling
are activation work for later phases when the app has real UI flows to exercise.

## Phase 4 Closeout Items

### P4-1 — Fix E2E Scaffold Drift

Current gaps:

- `tests/AmbientWeather.E2E/Pages/HomePage.cs` still expects the old heading
  `"Ambient Weather Dashboard"`; the shell heading is now `"Dashboard"`.
- `DashboardSmokeTests.cs` ignore reason still says "Enable in Phase 4", but it is still
  deferred.
- E2E page objects do not use the planned `BasePage` / `BaseTest` structure from the QA
  agent.

Implementation checklist:

- [x] Add `tests/AmbientWeather.E2E/Pages/BasePage.cs`.
- [x] Add `tests/AmbientWeather.E2E/BaseTest.cs` deriving from Playwright NUnit's
  `PageTest`.
- [x] Move shared navigation/wait helpers into `BasePage`.
- [x] Make `HomePage` inherit `BasePage`.
- [x] Change the dashboard title locator to `"Dashboard"` or a stable
  `data-test-id="dashboard-page"` assertion.
- [x] Update the ignore reason to "Enable in Phase 9/10 when auth/dev server test flow is
  available in CI."
- [x] Add `[Category("P0")]` to the smoke test so the future CI split has a seed.
- [x] Keep the test ignored until a CI-owned frontend server/auth strategy exists.

Exit criteria:

- `npm run test:e2e` still passes with one intentional skip.
- The skip reason names the future activation phase.
- Page object structure matches the QA agent convention.

### P4-2 — Fix CI Maintenance Config

Current gaps:

- NuGet caching is not configured.
- Dependabot is still a placeholder with an empty package ecosystem.
- CI builds E2E but does not yet split P0/P1 browser suites, which is acceptable while the
  only browser test is intentionally skipped.

Implementation checklist:

- [x] Add NuGet package caching keyed on `**/*.csproj`.
- [x] Keep npm caching via `actions/setup-node`.
- [x] Fix `.github/dependabot.yml` with real ecosystems:
  - `nuget` for `/backend`
  - `npm` for `/frontend`
  - `github-actions` for `/`
- [x] Leave P0/P1 E2E split deferred until runnable browser tests exist.
- [x] Add a short CI comment explaining why the E2E job is scaffold-only for now.

Exit criteria:

- Dependabot can actually update NuGet, npm, and GitHub Actions dependencies.

### P4-3 — Standardize Runtime LTS Policy

Node.js release status was rechecked on 2026-05-30. Node 24 is the current Active LTS
line, Node 22 is Maintenance LTS, and Node 20 is end-of-life. The locked frontend
dependency tree was checked against Node 24.0.0, 24.13.0, and 24.16.0 with zero
`engines.node` conflicts.

Implementation checklist:

- [x] Set CI frontend setup to Node `24.x`.
- [x] Add Node 24 LTS to README requirements.
- [x] Add Node 24 LTS to project rules and agent guidance.
- [x] Add package `engines` metadata so npm warns on unsupported runtime lines.
- [x] Add `.nvmrc` for local shell/tooling alignment.
- [x] Add the general rule: prefer current Active LTS runtimes; use supported
  Maintenance LTS only for a documented dependency or hosting constraint; never use EOL
  runtimes.

Exit criteria:

- CI, docs, rules, agents, and package metadata agree on Node 24 LTS.
- Future runtime updates prefer the current Active LTS line unless blocked by a real
  dependency/host constraint.

### P4-4 — Explicitly Defer Contract And Full Browser E2E

These are not Phase 4 blockers:

- OpenAPI snapshot to TypeScript contract checks remain Phase 12 because product DTOs and
  chart endpoints are not stable yet.
- Real browser E2E remains Phase 9/10 because it needs an Auth0/mock-auth strategy and
  dashboard/settings flows worth testing.
- Playwright trace/video artifact upload remains Phase 9/10 with the runnable E2E job.

Implementation checklist:

- [x] Add a short note to `docs/DEVELOPMENT_PLAN.md` under Phase 4 and Phase 12.
- [x] Keep Phase 4 wording as "Quality scaffold complete; browser E2E activation deferred."

## Phase 5 Scope Decision

Phase 5 should cover observability and readiness without adding unused infrastructure.

Keep in Phase 5:

- Structured server logging.
- Secret redaction in logs.
- Backend health/readiness checks.
- Optional Application Insights / Azure Monitor telemetry implemented now but disabled
  until a connection string is configured.
- Frontend telemetry bootstrap behind environment configuration, exposed through a
  vendor-isolated app telemetry interface.
- CI/deployment baseline stub that validates build artifacts and documents required
  production secrets.

## Phase 5 Defaults

- Development logs stay human-readable for local debugging.
- Staging/Production logs are structured JSON.
- Telemetry code lands in Phase 5, but exporters are disabled unless a connection string
  is configured.
- Frontend RUM starts anonymous-only: no email, Auth0 profile, access token, Ambient
  credentials, raw Auth0 subject, or hashed subject is sent.
- If user correlation is needed later, add a one-way hashed Auth0 subject behind an
  explicit opt-in config flag.
- All browser telemetry goes through the app-owned telemetry wrapper so Application
  Insights can be replaced by another RUM provider without touching feature code.

Defer from Phase 5:

- Cloudflare R2 integration. It is for future exports/assets and has no active consumer
  yet. Move it to the export/chart polish work in Phase 12 or a later deployment/assets
  phase.
- Real deploy to a cloud provider. Keep only a safe workflow stub until hosting is chosen.
- Full alerting/SLO dashboards. Add only enough telemetry shape to support them later.

## Phase 5 Implementation Plan

### Step 1 — Dependency And License Preflight

Before installing anything, verify each package is MIT, Apache 2.0, or BSD-3-Clause and
not deprecated.

Expected backend candidates:

- `Serilog.AspNetCore`
- `Serilog.Settings.Configuration`
- `Serilog.Sinks.Console`
- `Azure.Monitor.OpenTelemetry.AspNetCore`

Expected frontend candidates:

- `@microsoft/applicationinsights-web`
- `@microsoft/applicationinsights-react-js`

Notes:

- Microsoft currently recommends Azure Monitor OpenTelemetry Distro for new Application
  Insights-backed ASP.NET Core apps.
- For React SPA monitoring, the official Application Insights React extension uses
  `@microsoft/applicationinsights-react-js` with `@microsoft/applicationinsights-web`.
- If any package fails the license/maintenance check, stop and update this plan before
  implementation.

Exit criteria:

- Package choices, versions, licenses, and rationale are recorded in this file or
  `docs/DEVELOPMENT_PLAN.md`.

### Step 2 — Backend Structured Logging

Implementation checklist:

- [x] Add Serilog packages to `AmbientWeather.Api`.
- [x] Configure Serilog at startup before `builder.Build()`.
- [x] Keep Development logs human-readable.
- [x] Write JSON logs in Staging/Production.
- [x] Enrich logs with application name, environment, and trace id.
- [x] Do not include raw or hashed user identity in logs unless a future privacy review
  approves it for a specific operational need.
- [x] Do not log raw user subject, email, Ambient `apiKey`, `applicationKey`, Authorization
  header, cookies, or query strings containing secrets.
- [x] Add a small `SensitiveLogRedactor` helper for known secret names and credential-like
  values.
- [x] Review existing `ILogger` calls for structured-template usage and secret safety.
- [x] Keep `System.Net.Http.HttpClient.AmbientWeatherRest` at `Warning` or higher so
  Ambient query-string credentials are not emitted by HttpClientFactory.

Tests:

- [x] Unit tests for `SensitiveLogRedactor`.
- [x] Integration test or focused unit test proving Ambient credential values are redacted
  from representative log scopes/messages.

Exit criteria:

- Logs are structured and secret-safe.
- Existing analyzer and lint gates pass.

### Step 3 — Health And Readiness Endpoints

Implementation checklist:

- [x] Keep `GET /api/health` as unauthenticated liveness for compatibility.
- [x] Add `GET /api/health/live` for process liveness.
- [x] Add `GET /api/health/ready` for dependency readiness.
- [x] Add EF/PostgreSQL readiness via the existing `AmbientWeatherDbContext`.
- [x] Add Redis readiness only when Redis is configured; Development/Testing memory-cache
  fallback should report the active cache mode clearly.
- [x] Return a stable JSON shape with status, checks, duration, and timestamp.
- [x] Do not include connection strings, host secrets, or raw exception details in health
  responses.

Tests:

- [x] Integration tests for `/api/health`, `/api/health/live`, and `/api/health/ready`.
- [x] Test readiness behavior in Testing environment without requiring external Redis.

Exit criteria:

- Health endpoints support local dev, CI, and future container probes.

### Step 4 — Backend Telemetry

Implementation checklist:

- [x] Add optional Azure Monitor OpenTelemetry setup.
- [x] Read `APPLICATIONINSIGHTS_CONNECTION_STRING` or
  `AzureMonitor:ConnectionString` from configuration.
- [x] If no connection string exists, telemetry exporter is disabled with a safe startup
  log message.
- [x] The application must start successfully when telemetry is disabled.
- [x] Set service name/cloud role to `AmbientWeather.Api`.
- [x] Capture ASP.NET Core request telemetry, outbound `HttpClient` dependency telemetry,
  runtime metrics, and exception telemetry.
- [x] Add filtering/sampling defaults to stay free-tier friendly.
- [x] Ensure request URLs are scrubbed or do not include Ambient credentials.
- [x] Add equivalent worker-service telemetry shape later when worker deployment becomes
  real; do not block Phase 5 API observability on worker telemetry.

Tests:

- [x] Unit or integration test that missing telemetry configuration does not fail startup.
- [x] Config test for service name and disabled-by-default behavior.

Exit criteria:

- Telemetry is optional, safe by default, and ready for an Application Insights connection
  string.

### Step 5 — Frontend Telemetry

Implementation checklist:

- [x] Add optional Application Insights web/React SDK packages after license preflight.
- [x] Add `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` to `frontend/.env.example`.
- [x] Initialize telemetry only when the env var is present.
- [x] Track route changes from React Router.
- [x] Capture uncaught React errors from `ErrorBoundary`.
- [x] Do not send Ambient credentials, Auth0 access tokens, email, or raw user profile.
- [x] Do not send raw or hashed user identity in Phase 5.
- [x] If user correlation is needed later, add a one-way hashed subject behind an explicit
  opt-in config flag.
- [x] Add a typed, vendor-isolated telemetry wrapper so components never call the SDK
  directly.
- [x] Define app-owned telemetry methods such as `trackPageView`, `trackException`, and
  `trackEvent` in a small interface that can be backed by Application Insights now and
  swapped for another RUM provider later without touching feature components.
- [x] Keep SDK-specific types out of page, component, hook, and API-client code.

Tests:

- [x] Unit tests proving telemetry is disabled with missing env.
- [x] Unit tests proving `trackException` / `trackPageView` wrappers call the SDK when
  configured.

Exit criteria:

- Frontend telemetry is optional and privacy-safe.
- Frontend telemetry starts anonymous-only.
- The app depends on its own telemetry interface, not directly on Application Insights
  or any future RUM vendor such as Datadog.

### Step 6 — Deployment Baseline Stub

Implementation checklist:

- [x] Add a GitHub Actions workflow or CI job that builds deployable artifacts without
  deploying them.
- [x] Backend artifact: publish `AmbientWeather.Api` in Release.
- [x] Frontend artifact: upload `frontend/dist`.
- [x] Document required production environment variables:
  - Auth0 authority/audience
  - PostgreSQL connection string
  - Redis connection string
  - Data Protection key-ring location
  - Application Insights connection string
  - Allowed hosts/CORS origin if added later
- [x] Do not add a real cloud deploy target until hosting is chosen.
- [x] Do not add R2 secrets or SDK packages in Phase 5.

Exit criteria:

- CI can prove the app can produce deployment artifacts.
- No secrets are hardcoded.

### Step 7 — Documentation Updates

Implementation checklist:

- [x] Update `docs/DEVELOPMENT_PLAN.md` Phase 4 wording to reflect scaffold completion
  plus deferred E2E activation.
- [x] Update `docs/DEVELOPMENT_PLAN.md` Phase 5 checklist with the refined scope.
- [x] Update `README.md` with local health endpoints and telemetry configuration.
- [x] Update `docs/SECURITY.md` with logging redaction guarantees.
- [x] Add a short troubleshooting note for "telemetry disabled because no connection
  string is configured."

Exit criteria:

- Docs match the actual implementation and do not promise R2 or real deploy before they
  exist.

### Step 8 — Verification

Run:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal
git diff --check
```

Expected result after Phase 5:

- Backend unit/integration tests pass.
- Frontend tests pass.
- E2E project passes with the intentional browser-test skip until Phase 9/10.
- No analyzer, ESLint, format, or whitespace failures.
