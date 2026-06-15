# Phase 12 Completion Plan — Metric Detail, Charts, Contracts & Production Hardening

## Goal

Phase 12 turns the placeholder metric detail route into a full charting workflow and closes the
remaining v1 polish items: ECharts-powered history views, accessibility, API/frontend
contract checks, and production configuration hardening.

The resilience/configuration work from the earlier draft is folded into this plan as one slice. It
should refine what already exists rather than re-add solved work: credentials are already server-side
and encrypted, Redis connection-string support already exists, health checks already exist, Serilog is
already wired, Azure Monitor OpenTelemetry is already optional, and `RateLimitedApiClient` already
uses exponential retry with jitter plus a circuit breaker.

## Current State Already Complete

- [x] Metric detail route scaffold exists at `/metrics/:metricKey`.
- [x] Phase 12.1 replaced the placeholder with a metric history shell: title, station context,
  range/date/granularity/device controls, loading/error/empty/warning states, and a table preview.
- [x] Backend metric history endpoint exists: `GET /api/metrics/{metricKey}/history`.
- [x] Frontend metric history API client, TypeScript types, and query key exist.
- [x] Ambient credentials are server-side only, encrypted at rest, and not stored in committed config.
- [x] Redis connection string is already supported via `ConnectionStrings:Redis` / `Redis:ConnectionString`.
- [x] Dev/test Redis fallback exists: in-memory cache plus local/null realtime pub/sub.
- [x] Serilog structured logging is wired; dev/test logs use console, non-dev uses compact JSON.
- [x] Health checks exist: `/api/health`, `/api/health/live`, `/api/health/ready`.
- [x] Optional Azure Monitor OpenTelemetry backend wiring exists and is disabled without a connection string.
- [x] Ambient circuit-breaker break duration is seconds-based and currently configured by
  `AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds`.
- [x] Security coverage already exists for credential save, user isolation, SignalR auth, and sensitive
  redaction paths; Phase 12 should verify and fill only actual gaps.

## Phase 11 Carry-In Gaps To Close

Phase 11 product work is complete, but it intentionally left a few follow-through items that should
be handled in Phase 12 before the app is treated as v1-polished:

- [x] Metric detail placeholder removed in Phase 12.1; chart rendering remains Phase 12.2.
- [x] Open-Meteo extended metrics closed by Slice 12.4: 10 `om_` keys added with provider-specific
  mapping, labels, filtering, and tests. Users can now select cloud cover, precipitation probability,
  weather description, sunrise/sunset, UV max, daily precip sum, and max wind/gust/direction for
  Open-Meteo public and pinned sources.
- [x] Historical neighbor/public-source overlays have a v1 product decision: enable history only
  where the provider has a history source or cached samples exist; otherwise keep unsupported
  current-only provider metrics visibly disabled instead of rendering dead controls. Covered by
  `metric-detail.spec.ts`.
- [x] E2E coverage for the Phase 11 UI surface is now covered by TS Playwright specs. Public
  sources, pinned sources, alerts, default/custom metric ordering, ticker source/zone paths, and
  accessibility quality sweeps are tracked in `docs/e2e-specs/e2e-test-flows.md` with file names.
- [x] Page-level accessibility coverage needs to graduate from component checks to fuller Dashboard,
  Settings, and Metric Detail Playwright axe/keyboard/light-dark sweeps. Representative keyboard,
  light/dark, and retry smoke coverage exists in `accessibility-quality.spec.ts`; page-level axe
  audits now pass in `axe-audits.spec.ts`; disabled/empty/error visual sweeps are covered in
  `accessibility-quality.spec.ts`.
- [ ] Public-repository readiness remains a gate: current-tree/history scans, public CodeQL enablement,
  Auth0 app rotation/deletion, dependency automation review, and sanitized examples must be complete
  before changing repo visibility.

## Guiding Constraints

- Keep local testing light. Do not make Redis, Auth0, Azure Monitor, Seq, or production hostnames
  mandatory in Development or Testing.
- Add dependencies only when they remove meaningful implementation risk. Every new package must be
  MIT, Apache 2.0, or BSD-3-Clause and not deprecated.
- Preserve the existing Ambient rate-limit semantics: every retry must still respect the 1 req/s
  user API key limit and 3 req/s application key limit.
- Prefer small slices with focused tests. Chart UX, contracts, and production hardening should be
  independently reviewable.

## Slice 12.1 — Metric History Hook & Detail Shell

- [x] Add `useMetricHistory` hook using the existing typed API client and `queryKeys.metrics.history`.
- [x] Replace the placeholder `MetricDetailPage` body with the real work surface:
  - metric title, station/source context, current selected range/date, loading/error/empty states;
  - range controls for common windows;
  - date mode for a specific historical day;
  - data-source/device selector where supported.
- [x] Make dashboard metric tiles and keyboard activation route to Metric Detail with stable
  `data-test-id` locators. Existing tiles are semantic buttons and already route by metric key.
- [x] Validate invalid metric keys with a clear user-facing empty/error state.
- [x] Preserve direct URL handling for bookmarked metric-detail pages.
- [x] Add component/hook tests for hook query params, loading, error, empty, and success states.

## Slice 12.2 — ECharts Integration

- [x] Add Apache 2.0-compatible ECharts dependencies after license/deprecation check.
  - Installed `echarts@6.1.0` (Apache-2.0) and `echarts-for-react@3.0.6` (MIT).
  - `echarts-for-react` peer dependencies accept ECharts `^6.0.0` and React `>=16.0.0`;
    npm install completed without deprecation warnings and `npm audit` found 0 vulnerabilities.
  - Follow-up dependency hardening upgraded Vite to `8.0.16` and `@vitejs/plugin-react` to
    `6.0.2`, pulling in the patched esbuild range and keeping the frontend audit clean.
- [x] Build one shared chart option builder for all metric charts.
- [x] Support line/area/bar rendering as appropriate for scalar vs rainfall metrics.
- [x] Enable `dataZoom` brush/slider while keeping keyboard-accessible external range controls.
- [x] Enable ECharts `aria` with generated series descriptions.
- [x] Add tests for option-builder output and basic chart rendering.

## Slice 12.3 — Chart Controls, Comparison & Empty States

- [x] Add a chart control panel with stable `data-test-id`s:
  - range;
  - recent-day dropdown plus custom date picker;
  - granularity;
  - source;
  - device/station selector;
  - overlay availability state;
  - owned-station comparison selector.
  - Current status: reusable `MetricHistoryControls` is wired into Metric Detail. Exports were
    removed from Phase 12 scope.
- [x] Add owned-device comparison overlay series.
  - Metric Detail now offers a `Compare` selector for owned Ambient stations and overlays matching
    history as a second named ECharts series.
- [x] Add neighbor/public-source overlay series only when provider history or cached samples are
  available; otherwise keep a clear disabled/empty state.
  - No provider history/cached-sample time series exists yet, so Metric Detail keeps public, pinned,
    and neighbor overlays unavailable with an explicit status message instead of rendering dead
    controls.
- [x] Document the overlay availability rules in the UI and in `docs/API_REFERENCE.md` so unsupported
  providers are not mistaken for broken charts.
- [x] Handle missing sensors such as UV, solar, indoor, rainfall, and daily extrema gracefully.
  - Empty history responses now explain that the selected station may not report the metric, the
    sensor may be missing/offline, or the selected range may not have cached readings.
- [x] Add focused component tests for each control state.

## Slice 12.4 — Open-Meteo Extended Metrics ✅ Complete

Open-Meteo exposes richer forecast/current fields than the Ambient-style core metrics currently
shown in Settings and dashboard layouts. Add these only where they have clear labels, units,
accessibility-friendly display, and provider-specific support filtering.

- Reference the official Open-Meteo forecast docs when selecting fields and query parameters:
  `https://open-meteo.com/en/docs`.
- [x] Add canonical metric definitions and frontend labels for selected Open-Meteo extended fields:
  - weather condition / `weather_code` → `om_weather_description` (WMO 4677 lookup via `WmoWeatherDescriptions`);
  - cloud cover → `om_cloud_cover`;
  - precipitation probability → `om_precip_probability`;
  - sunrise and sunset → `om_sunrise`, `om_sunset` (formatted as "h:mm tt" local time);
  - UV index daily max → `om_uv_index_max`;
  - daily precipitation sum → `om_precip_sum`;
  - max wind speed / max gust / dominant wind direction → `om_wind_speed_max`, `om_wind_gust_max`, `om_wind_dir_dominant`.
- [x] Extend backend Open-Meteo current/daily/hourly request and response mapping only for fields
  that will be exposed in the UI (`weather_code`, `cloud_cover`, `precipitation_probability` in current;
  `uv_index_max`, `precipitation_sum`, `sunrise`, `sunset`, `wind_speed_10m_max`, `wind_gusts_10m_max`,
  `wind_direction_10m_dominant` in daily). Extended in both `OpenMeteoNearbyBaselineProvider` and
  `PublicSourceCurrentReadingService`. New properties added to `NeighborStation` and `CurrentReadingDto`.
- [x] Decided per metric: all 10 om_ metrics are current/forecast (not chartable from Ambient history);
  provider-specific tiles display them with clear "(Today)" labels where values are daily aggregates.
  Not added to backend `MetricRegistry` since they are not chartable from Ambient history endpoints.
- [x] Keep unsupported fields hidden from Default Settings and Custom layout pickers via
  `providerMetricSupport.ts` — all 10 `om_` keys are in `OPEN_METEO_PUBLIC_METRICS` and
  `OPEN_METEO_PINNED_METRICS` only; `WeatherGov` and `AmbientOpen` do not include them.
- [x] User-facing empty state: null `om_*` values display `—` in the tile, consistent with other metric tiles.
- [x] Backend mapping tests: `WmoWeatherDescriptionsTests`, `OpenMeteoNearbyBaselineProviderExtendedFieldsTests`,
  extended `PublicSourceCurrentReadingServiceTests` — 10+ new test cases.
- [x] Frontend tests: extended `providerMetricSupport.test.ts`, `WindTile.test.tsx`, new
  `ConditionsTile.test.tsx`, `HumidityTile.test.tsx`, `SolarTile.test.tsx`.
- [x] `metrics.test.ts` updated with all 10 new `om_` keys in `EXPECTED_KEYS`.
- [x] All 570 backend unit tests, 159 integration tests, and 440 frontend tests pass. Lint clean.

## Slice 12.6 — Accessibility & WCAG 2.2 AA

- [x] Add a collapsible data table alternative beneath each chart for users who cannot interpret
  graphics:
  - table has a visible/collapsible heading, accessible name, metric/unit context, timestamp column,
    value columns, and empty/loading/error states that match the chart state;
  - table toggle is keyboard reachable and persists only local UI state.
  - Implemented by `MetricHistoryTable`; covered by `MetricHistoryTable.test.tsx`,
    `MetricDetailPage.test.tsx`, and `metric-detail.spec.ts`.
- [x] Ensure chart and dashboard controls have semantic grouping:
  - chart controls use `role="group"` or fieldset/legend where appropriate and `aria-labelledby`
    points to visible text;
  - station/source groups, collapsed dashboard station sections, alert controls, and custom-layout
    builder controls expose accessible names and expanded/collapsed state.
  - Dashboard station summaries now expose explicit `aria-expanded`/`aria-controls`; covered by
    `DashboardPage.test.tsx`.
- [x] Ensure icon-only buttons have accessible labels and meet WCAG 2.2 target-size expectations:
  - 24x24 CSS px minimum target size unless a documented WCAG exception applies;
  - visible focus indication meets WCAG 2.2 Focus Appearance expectations;
  - disabled controls expose a reason through nearby text, tooltip text, or status text.
  - Dashboard ticker/action buttons, Settings metric-order buttons, and Custom Layout move/remove
    buttons now expose labels and disabled-state reasons; covered by `CustomDashboardRenderer.test.tsx`,
    `DevicesCard.test.tsx`, and `CustomLayoutBuilder.test.tsx`.
- [x] Verify keyboard flow:
  - [x] Dashboard source toggles, theme menu open/Escape close, ticker pause/resume, Settings
    custom-layout builder add controls, credentials confirmation Escape close, neighbor drawer
    Escape close, and Metric Detail table controls have TS Playwright keyboard smoke coverage
    (`accessibility-quality.spec.ts`).
  - Enter/Space and Escape representative paths are covered across dashboard, settings, drawer,
    dialog, ticker, and metric-detail surfaces.
  - Drag/drop-style reorder interactions already expose keyboard-first move controls (WCAG 2.2
    dragging movement alternative).
- [x] Verify reduced-motion behavior:
  - header/footer ticker tests cover `prefers-reduced-motion` with paused/static behavior;
  - animations do not become the only way to perceive changing weather or alert data.
- [x] Verify live regions:
  - realtime metric updates use polite status regions where useful;
  - alerts and tickers avoid noisy repeated screen-reader announcements;
  - warning/error counts are announced when they change.
  - Covered by `MetricHistoryChart.test.tsx`, `CustomDashboardRenderer.test.tsx`,
    `custom-layout-builder.spec.ts`, `AlertsBanner`, and the Metric Detail warnings live-region
    assertion in `MetricDetailPage.test.tsx`.
- [x] Run TS Playwright axe audits across Dashboard, MetricDetail, Settings, dialogs/drawers, and
  custom-layout surfaces with zero violations:
  - avoided adding `@axe-core/playwright` because npm metadata lookup timed out repeatedly;
  - reused the existing frontend `axe-core` install through `tests/e2e/fixtures/axe.ts`;
  - package metadata lookup for `@axe-core/playwright` and `axe-core` timed out on 2026-06-12; retry
    before adding the dependency. Retried on 2026-06-13 and both lookups timed out again;
  - audits run from stable mocked states using the TS fixtures, not real network data;
  - covered by `axe-audits.spec.ts` for Dashboard, Metric Detail, Settings, custom layout builder,
    neighbor drawer, and credentials delete dialog.
- [x] Run light/dark visibility sweeps for Dashboard, MetricDetail, Settings, menus, dropdowns,
  station/source headers, alerts, tickers, chart controls, and disabled/empty/error states.
  - [x] Dashboard, MetricDetail chart controls, Settings, and theme-menu light/dark smoke coverage is in
    `accessibility-quality.spec.ts`.
  - [x] Disabled, empty, and error-state visibility across Dashboard, MetricDetail, and Settings is
    covered in `accessibility-quality.spec.ts`.
- [x] Create/update `docs/ACCESSIBILITY.md` with the WCAG 2.2 AA conformance claim, current
  Playwright keyboard/theme/retry coverage, and known limitations.

## Slice 12.7 — API Contract & Security Verification ✅ Complete

- [x] Add OpenAPI snapshot / TypeScript contract verification.
  - `SwaggerContractTests` (integration test) uses the shared `TestApplicationFactory`
    (`Testing` environment, `TestAuthHandler`) to fetch `/swagger/v1/swagger.json` and compare
    against the committed snapshot at `docs/openapi.json`. `Program.cs` serves the OpenAPI JSON
    in `Development` and `Testing`; Swagger UI remains `Development` only. Snapshot output is
    key-sorted for deterministic diffs and filters Testing-only `/test/*` endpoints.
  - `npm run swagger:generate` regenerates the snapshot via `scripts/swagger-generate.mjs`
    (cross-platform Node script, sets `UPDATE_SWAGGER_SNAPSHOT=true`).
  - `npm run test:contract` runs just the contract test against the committed snapshot.
  - Contract check runs automatically as part of `npm run test:backend` on every CI run.
- [x] Verified backend DTOs and frontend TypeScript interfaces in sync for all 8 type files
  (alerts, customLayout, dashboard, metrics, neighbors, publicSources, settings, plus one more).
  No gaps found; snapshot captures full surface.
- [x] Reviewed existing security integration tests — all passing:
  - `SettingsCredentialsApiTests` covers credential save rate limit and auth requirement.
  - `DashboardCurrentApiTests` / `DashboardCurrentNeighborsApiTests` verify per-user isolation.
  - `SensitivePropertyRedactorTests` covers Serilog key redaction.
  - `TestAuthHandler` exercises auth in all 160 integration tests.
- [x] No security test gaps found; no new tests required.
- [x] Dependency vulnerability checks passed:
  - `dotnet list package --vulnerable` — no vulnerable packages in any backend project.
  - `npm audit --audit-level=moderate` — root workspace clean.
  - `npm audit --audit-level=moderate --prefix tests/e2e` — E2E workspace clean.
  - `npm audit --audit-level=moderate --prefix frontend` initially found the Vite/esbuild advisory;
    remediated by upgrading Vite to `8.0.16` and `@vitejs/plugin-react` to `6.0.2`.
  - Re-ran frontend audit with `NODE_OPTIONS='--use-system-ca'`; final result is 0 vulnerabilities.
- [x] Snapshot (`docs/openapi.json`) contains no tenant IDs, station IDs, coordinates, passwords,
  API keys, JWTs, or personal paths — confirmed by inspection.

## Slice 12.8 — Configuration & Resilience Refinement

This slice refines the earlier resilience draft with repo-aware scope.

- [x] Add `appsettings.Sample.json` or equivalent docs table with placeholder-only expected config:
  - `ConnectionStrings__Postgres`;
  - `ConnectionStrings__Redis`;
  - `Authentication__Authority`;
  - `Authentication__Audience`;
  - `AzureMonitor__ConnectionString`;
  - `APPLICATIONINSIGHTS_CONNECTION_STRING`;
  - `AllowedHosts`;
  - `UserAgent`.
- [x] Add options POCOs with validation for production-critical settings:
  - [x] `AmbientApiOptions` with data-annotation validation and `ValidateOnStart()`;
  - [x] `AmbientResilienceOptions` / rate-limit options nested under `AmbientApiOptions`;
  - [x] `RedisOptions`;
  - [x] `ApplicationAuthenticationOptions` project-specific JWT/Auth options type;
  - [x] `UserAgentOptions` with legacy scalar compatibility and generated version-aware values.
- [x] Use `ValidateOnStart()` and startup guards selectively:
  - strict in Staging/Production for Postgres, JWT auth, valid Ambient base URL, numeric resilience
    ranges, Redis, and production `AllowedHosts`;
  - permissive in Development/Testing so local smoke tests can still run without Redis, Auth0, or
    telemetry.
- [x] Keep Redis optional for Development/Testing; production should warn or fail based on deployment
  profile.
- [x] Restrict `AllowedHosts` outside Development; document expected production hostnames.
- [x] Make `UserAgent` build/version-aware through configuration or CI stamping.
  - For Weather.gov/Nominatim/Open-Meteo, require a deploy-time shape that includes app identity
    and contact/version information where provider guidance asks for it.
  - Tests should assert shape only, not exact CI build identifiers.
- [x] Confirm current retry behavior remains exponential with jitter and every retry still re-enters
  the Ambient rate-limit queue.
- [x] Defer Polly; keep the current built-in resilience implementation because it already satisfies
  Phase 12 requirements without adding a new dependency. If revisited in a future refactor:
  - keep package additions minimal and license-checked;
  - preserve per-key rate limiting and existing typed exception mapping;
  - reduce retry delays/counts in Testing.
- [x] Add tests for config binding/validation and Ambient resilience behavior.
  - `RedisOptionsTests`, `ApplicationAuthenticationOptionsTests`, and `UserAgentOptionsTests` cover
    the new typed options and compatibility fallbacks.
  - `RateLimitedApiClientTests` covers retry delay calculation and retry attempts re-entering the
    rate-limit queue.

## Slice 12.9 — E2E Flow Audit Implementation & Closeout

- [x] Playwright E2E: dashboard metric value click/keyboard activation -> metric detail chart loads
  is covered by `dashboard.current.spec.ts`; range/table coverage is covered by `metric-detail.spec.ts`.
- [x] Playwright E2E: date-mode chart renders a mocked historical day (`metric-detail.spec.ts`).
- [x] Playwright E2E: missing-sensor metric shows a useful empty state (`metric-detail.spec.ts`).
- [x] Implement the undone items from `docs/e2e-specs/e2e-test-flows.md` and keep its coverage matrix
  current as tests land:
  - [x] P0 dashboard missing-credentials/no-stations prompt coverage (`dashboard.current.spec.ts`).
  - [x] P0 metric-detail activation by real dashboard metric value click/keyboard path
    (`dashboard.current.spec.ts`).
  - [x] P0 credential delete confirm path, including DELETE request and post-delete status
    (`settings.smoke.spec.ts`).
  - [x] P1 preferences save/apply flow, including PUT payload, dashboard unit/date formatting, and
    light/dark visibility checks (`settings-preferences.spec.ts`).
  - [x] P1 owned-device settings flow: refresh/sync, nickname edit, primary station, dashboard
    visibility, metric selection, and category/field ordering (`owned-device-settings.spec.ts`,
    `default-metric-ordering.spec.ts`).
  - [x] P1 Default metrics category/field ordering: move controls, save payload, and Dashboard order
    (`default-metric-ordering.spec.ts`).
  - [x] P1 Dashboard layout unsaved-change guard: when a user changes Default or Custom layout
    settings and attempts to leave Settings, prompt to save or discard; after either choice,
    continue the originally requested navigation (`layout-unsaved-guard.spec.ts`).
  - [x] P1 Custom layout extensions: divider save/render, header/footer ticker, ticker channel
    source, configured field text, per-ticker NWS zone, and reduced-motion/static ticker path
    (`custom-layout-builder.spec.ts`).
  - [x] P1 Custom source picker: owned, saved public, and pinned neighbor sources with provider badges,
    unsupported metrics hidden, and saved metric references verified (`custom-layout-builder.spec.ts`).
  - [x] P1 neighbor pin follow-up: pin station, assert saved pinned-station config, and render pinned
    station on the default dashboard (`neighbors.spec.ts`).
  - [x] P1 neighbor source-state follow-ups: return-to-own source toggle and 428 unavailable state
    (`neighbors.spec.ts`).
  - [x] P1 public source management: discovery/add, empty/error discovery states, label edit, delete,
    selected metric/order persistence, and Open-Meteo variant (`public-sources.spec.ts`).
  - [x] P1 public/pinned dashboard states: disabled-source suppression, public missing-reading state,
    and pinned not-in-cache guidance (`dashboard.smoke.spec.ts`).
  - [x] P1 alerts: alert detail expand/collapse, area/zone selection, refetch query assertion, and
    ticker zone assertions (`dashboard.smoke.spec.ts`, `custom-layout-builder.spec.ts`).
  - [x] P1 owned comparison overlay: select another owned station, assert the comparison `deviceId`
    history request, and render comparison status/chart (`metric-detail.spec.ts`).
  - [x] P1 accessibility/quality: keyboard, light/dark, and representative retry smoke coverage is
    covered in `accessibility-quality.spec.ts`; page-level axe audits are covered in
    `axe-audits.spec.ts`; disabled, empty, and error-state sweeps are covered in
    `accessibility-quality.spec.ts`.
- [x] E2E automation hardening:
  - [x] Migrate E2E from Playwright C# to Playwright Test TypeScript before adding the remaining
    Phase 12 coverage, so the suite grows around the frontend-native runner instead of the
    temporary C# compatibility layer.
  - [x] Add `@playwright/test` under `tests/e2e` with a repo script that preserves
    `npm run test:e2e`; keep browser install/cache behavior documented for CI.
    - `npm run test:e2e` → TS Playwright suite.
    - Browsers: `cd tests/e2e && npm run install:browsers` (installs Chromium with deps).
  - [x] Add script aliases for the TS suite: `npm run test:e2e`, `npm run test:e2e:p0`, and
    `npm run test:e2e:p1`.
  - [x] Standardize TS E2E file layout before porting specs:
    - `tests/e2e/playwright.config.ts` for Playwright Test config;
    - `tests/e2e/fixtures/` for Auth0, BFF route mocks, generated data, and artifact setup;
    - `tests/e2e/flows/` for small reusable user-flow helpers;
    - `tests/e2e/pages/` only for large page/surface objects;
    - `tests/e2e/specs/` for scenario specs.
  - [x] Standardize TS E2E conventions:
    - title-tag P0/P1 tests with `@p0` / `@p1` so CI can run `--grep @p0` and `--grep @p1`;
    - use `test.step(...)` around multi-action user flows;
    - keep route mocks in fixtures/mock builders, not ad hoc inside spec bodies;
    - use mocked Auth0 fixtures only; do not persist real Auth0 storage state, tenant IDs, or tokens;
    - keep TS E2E strict: no `any`, no untyped mock payloads, and API mock DTOs should reuse app
      types or explicit test types;
    - block accidental real external network calls; only localhost/Vite assets and explicitly mocked
      Auth0/BFF/provider routes are allowed;
    - prohibit `page.waitForTimeout`, arbitrary sleeps, CSS-class selectors, XPath, and index-based
      selectors unless an exception is documented in the spec.
  - [x] Standardize `playwright.config.ts` defaults:
    - `testIdAttribute: "data-test-id"`;
    - `baseURL` from env with `http://localhost:5173` fallback;
    - `retries: process.env.CI ? 1 : 0`;
    - `trace: "on-first-retry"`, `screenshot: "only-on-failure"`, `video: "on-first-retry"`;
    - `forbidOnly: !!process.env.CI`;
    - bounded CI workers so local speed does not become CI flake.
  - [x] Use a hybrid TS architecture:
    - fixtures for Auth0, BFF route mocks, generated test data, trace/video/screenshot capture,
      and P0/P1 project setup;
    - small flow/helper functions for common actions such as opening Settings, saving credentials,
      switching dashboard sources, and selecting chart controls;
    - page objects only for large reusable surfaces such as Settings, Dashboard, and Metric Detail
      when helpers alone become noisy.
  - [x] Port the existing C# coverage first, one file at a time, keeping the same behavior and
    screenshots/traces where useful:
    - `specs/dashboard.smoke.spec.ts` — ports `DashboardSmokeTests` (7 tests, @p0);
    - `specs/dashboard.current.spec.ts` — ports `DashboardCurrentDataTests` (4 tests, @p0);
    - `specs/settings.smoke.spec.ts` — ports `SettingsSmokeTests` (7 tests, @p0);
    - `specs/navigation.spec.ts` — ports `RouteNavigationTests` (1 test, @p0);
    - `specs/custom-layout-builder.spec.ts` — ports `CustomLayoutBuilderTests` (4 tests, @p0/@p1);
    - `specs/neighbors.spec.ts` — ports `NeighborsTests` (3 tests, @p1);
    - `specs/public-sources.spec.ts` — ports `PublicSourcesSettingsTests` (3 tests, @p1).
    Total: 29 tests across 7 spec files. TypeScript type-check and `playwright test --list` pass.
  - [x] Replace C# helper methods that were created to mimic TS Playwright capabilities:
    - `expect.poll` replaces `Eventually.ValueAsync`/`Eventually.TrueAsync`;
    - Playwright Test fixtures replace `BaseTest` setup/teardown and shared route methods;
    - `page.getByTestId()` (via `BasePage.byTestId`) is the primary locator; CSS fallback
      `page.locator("[data-test-id='...']")` is used for dynamic IDs and checkbox inputs
      per the documented selector exception;
    - TS page objects (`BasePage`, `HomePage`, `SettingsPage`, `MetricDetailPage`) replace
      C# page object wrappers.
  - [x] Keep the C# suite running only until the matching TS spec passes; then delete the replaced
    C# test file, obsolete page object methods, and C#-only helper code in the same slice.
    The legacy C# E2E project and `test:e2e:cs` script have been removed.
  - [x] Do not carry duplicate C# and TS coverage beyond the migration slice; the TS spec is the
    source of truth once parity passes.
  - [x] Update CI to run TS Playwright P0/P1 jobs with the same trace/screenshot/video artifacts.
    `.github/workflows/ci.yml` runs a P0/P1 matrix and uploads suite-specific Playwright reports
    plus `tests/e2e/test-results/` on failure.
  - [x] Keep all generated locations, coordinates, station IDs, and source IDs randomized.
    The TS suite uses `@faker-js/faker`; generated values remain sanitized and license-compatible.
  - [x] Add or verify CI failure video capture alongside existing traces/screenshots, and upload
    trace/video/screenshot artifacts on failure or retry. `playwright.config.ts` uses
    `trace: "on-first-retry"`, `screenshot: "only-on-failure"`, and `video: "on-first-retry"`;
    CI uploads `tests/e2e/test-results/` on failure.
- [x] README closeout: document chart controls, config/env vars, and accessibility notes.
- [x] Update `docs/API_REFERENCE.md` for chart controls, contract behavior, and
  source/history overlay semantics.
- [x] Update `docs/DEVELOPMENT_PLAN.md` and this plan with final status and deferrals.
- [x] Update `docs/e2e-specs/e2e-test-flows.md` as tests land: mark covered flows with file names,
  leave uncovered flows as planned/deferred with a target phase.
- [x] Final verification:
  - [x] `dotnet build backend/AmbientWeather.slnx --no-restore`: clean.
  - [x] `dotnet test backend/AmbientWeather.slnx -c Release --no-restore`: 773 passing.
  - [x] `dotnet format whitespace backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal`: clean.
  - [x] `npm run lint:frontend`: clean.
  - [x] `npm run test:frontend`: 512 passing.
  - [x] `npm --prefix frontend run build`: clean.
  - [x] `npm run test:e2e`: 79 passing.
  - [x] `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`: clean; latest migration `20260614053257_AddDistanceUnitPreference`.

## Deferred Work Audit

Every known earlier deferral is either owned by Phase 12 below or explicitly moved to a future phase.

| Deferred item | Source | Phase 12 disposition |
|---|---|---|
| React Router pre-mount navigation concern | Phase 3 fixes | Closed in Phase 11; no Phase 12 work unless regression appears |
| Real browser E2E activation, CI-owned frontend/API startup, P0/P1 split, traces/videos | Phase 4/10 | Closed in Phase 11; Phase 12 expands coverage only |
| OpenAPI snapshot to TypeScript contract check | Phase 4 | Phase 12 Slice 12.7 |
| Cloudflare R2/export asset work | Phase 5 | Removed from Phase 12; R2 remains future infrastructure only if remote asset persistence becomes a real requirement |
| `AmbientHistoryService` range/date/page assembly | Phase 6 | Closed by Phase 8 history endpoint; Phase 12 consumes through `useMetricHistory` |
| `AmbientOpenApiClient` neighbor discovery | Phase 6 | Closed in Phase 11; Phase 12 only verifies provider filtering and chart overlay availability |
| Optional local raw-reading sync hardening/backfill/rollups | Phase 2/6/8 | 2.0 candidate; required before first-class offline cached history |
| Cache invalidation on credential rotation | Phase 8 | Future optimization unless Phase 12 testing shows stale history/dashboard data after credential rotation |
| `useMetricHistory` hook | Phase 8 | Phase 12 Slice 12.1 |
| Full metric detail charts and specific date mode | Phase 7/8/10 | Phase 12 Slices 12.1-12.3 |
| Historical neighbor charts | Phase 10/11 | Closed for v1: enable only with provider history or cached samples; unsupported current-only provider metrics remain visibly disabled and covered by `metric-detail.spec.ts` |
| Assembled dashboard/history response cache | Phase 8/9/11 | Closed by Phase 11 benchmark; future monitoring trigger only if deployed p95 exceeds target |
| Open-Meteo extended metrics | Phase 11 public-source follow-up | Phase 12 Slice 12.4 |
| Public-source/pinned-source/default/custom E2E gaps | Phase 11 closeout / E2E audit | Closed by Phase 12 Slice 12.9 and tracked in `docs/e2e-specs/e2e-test-flows.md` |
| Penetration testing / DAST suite | Security hardening | Future security hardening phase; Phase 12 may add the planned item and keep dependency/config/security tests passing |
| NCEI/CDO historical station data | Phase 11 research | Future provider expansion, not Phase 12 v1 scope |
| Public repository readiness | Phase 12 planning | Phase 12 Slice 12.10 gate before visibility change |
| Polly retry-policy refactor | Phase 12 resilience review | Future maintainability refactor only; current `RateLimitedApiClient` already provides exponential jittered retries, retry-after handling, circuit breaking, and per-key rate-limit re-entry without a new dependency |

## Version 2.0 Feature Candidates

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

## Phase 12 E2E Release Gate

The flow audit is intentionally larger than the minimum Phase 12 release gate. Close these before
Phase 12 is complete:

- [x] P0 missing-credentials/no-stations dashboard prompt.
- [x] P0 dashboard tile click and keyboard activation to Metric Detail.
- [x] P0 credential delete confirm/delete status.
- [x] P1 default metric category/field ordering save payload and Dashboard order.
- [x] P1 public source discovery/add/edit/delete and selected metric/order persistence.
- [x] P1 pinned neighbor source pin/save and default-dashboard rendering.
- [x] P1 alert area/zone selection and ticker zone assertions.
- [x] P1 owned comparison overlay request/status/chart path.
- [x] Metric Detail range/date/table happy paths and missing-sensor empty state.

The remaining P1 flows in `docs/e2e-specs/e2e-test-flows.md` may be tracked as post-v1 hardening
only if this plan names the target phase and explains the risk accepted.

## Phase 12 Completion Checklist

- [x] All Phase 12 slices either completed or explicitly moved to the Deferred Work Audit with an
  owner/target.
- [x] No Phase 11 carry-in gap remains unowned.
- [x] README, `docs/API_REFERENCE.md`, `docs/e2e-specs/e2e-test-flows.md`,
  `docs/ACCESSIBILITY.md`, and `docs/DEVELOPMENT_PLAN.md` match the shipped behavior.
- [x] Contract, security, accessibility, E2E, frontend, backend, and build gates pass.
- [x] Final **Check EF migrations** step is run and recorded:
  `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.
- [x] Any new migration is committed intentionally; no pending model changes remain.

## Slice 12.10 — Public Repository Readiness Gate

Complete this gate before making the repository public.

- [x] Remove or generalize concrete Auth0 dev tenant values in current files:
  - `.env.example`;
  - `frontend/.env.example`;
  - `README.md`;
  - `frontend/src/config/app.ts`;
  - E2E tests and shared test-auth fixtures.
  Current-tree scan found only sanitized placeholder Auth0 values (`example.auth0.test`,
  `example-spa-client-id`) and no old live tenant/client values. Frontend runtime now fails with
  an explicit missing-config error instead of silently falling back to placeholder Auth0 values.
- [ ] Rotate or delete the current Auth0 dev SPA/app before public release. Auth0 SPA client IDs are
  browser-public by design, but publishing a live tenant/client invites abuse, noise, and support churn.
- [x] Replace committed sample database password values:
  - replace legacy concrete sample database password values in `.env.example`, `docker-compose.yml`, README,
    and related docs;
  - use a clearly dummy local-only value such as `change-me-local-only`, or placeholders where copy/paste
    setup is not required.
  Current-tree scan found no legacy concrete sample DB password; remaining examples use placeholders
  or clearly dummy local-only values.
- [ ] Re-enable CodeQL/code scanning when the repository is made public:
  - note: GitHub code scanning/CodeQL upload is not available for this private repository under the
    current license/settings, so failures while private are expected;
  - restore useful `push` / `pull_request` triggers;
  - remove the disabled job guard;
  - ensure repository code scanning is enabled in GitHub settings.
- [x] Review Dependabot auto-merge before public launch:
  - require all CI checks;
  - auto-approval was removed; auto-merge is now patch-only and requires a maintainer-applied
    `automerge-dependabot` label before enabling GitHub auto-merge.
- [x] Keep agent and improvement-plan docs public intentionally:
  - `AGENTS.md`;
  - `CLAUDE.md`;
  - `.claude/agents/*`;
  - `.cursorrules`;
  - `docs/archive/plans/CODEBASE_IMPROVEMENT_PLAN.md`.
  These files expose how the project was built and reviewed. No secret material was found in the
  current copies during the public-readiness review, so they should remain public unless a later scan
  finds sensitive content.
- [x] Add a README note that agent guidance and improvement-plan docs are intentionally public build
  process artifacts.
- [ ] Decide on git-history sanitation before public launch:
  - minimum: rotate/delete the current Auth0 dev app and accept that historical commits include public
    SPA identifiers and local-only sample DB passwords;
  - strictest: rewrite history before publishing so those values never appear in public history.
- [x] Run a current-tree and history scan for private keys, provider tokens, Auth0 tenant values,
  Ambient API keys, local passwords, and personal paths before switching repository visibility:
  - current tree: no old live Auth0 dev tenant/client value, no legacy concrete sample DB password, and no
    private-key header found; matches were placeholder examples, docs references, type names, or
    dummy test credentials;
  - git history: old commits do contain the prior Auth0 dev tenant/client and old local-only sample
    DB password, so the history decision above remains an intentional public-release blocker.

## Explicit Non-Goals For Phase 12

- Do not require Redis for local Development/Testing.
- Do not require Auth0 config for mocked E2E or local dev bypass scenarios.
- Do not add mandatory raw weather-history storage in PostgreSQL unless Ambient API plus Redis caching
  is proven insufficient.
- Do not add Cloudflare R2 unless remote export persistence becomes a concrete requirement.
- Do not add Seq or a metrics scraper dependency unless deployment will actually consume it.
- Do not present existing secrets, Redis, health, Serilog, or OpenTelemetry wiring as missing.
- Do not add NCEI/CDO historical station data in Phase 12.
- Do not run full DAST/manual penetration testing as a Phase 12 blocker; track it as a future
  public-beta/production security hardening phase.
- Do not add SBOM/provenance/signing pipelines in Phase 12 unless public release requirements change.

## Local Testing Complications To Avoid

- Over-eager `ValidateOnStart()` can break tests that intentionally run without Postgres, Redis, Auth0,
  or telemetry.
- Strict `AllowedHosts` can break Vite proxy, Playwright, Docker hostnames, and localhost unless
  environment-specific config is handled carefully.
- Polly or any retry refactor can slow failing tests unless Testing uses small retry counts and short
  delays.
- Dynamic `UserAgent` values can make snapshots or log assertions noisy; tests should assert shape, not
  exact CI build identifiers.
- Extra env vars increase setup friction unless README, `.env.example`, and user-secrets commands stay
  clear.

---

## Addendum — Post-12.9 UX Improvements

Six incremental frontend-only UX improvements planned after the E2E migration closed. No new backend
endpoints are required; all changes are in `frontend/src/`.

### A1 — Dashboard Neighbors: only show owned stations in Default-layout neighbor mode

When `dataSource === 'neighbors'` and the active layout is Default, filter the `tileGroups` render
loop (`DashboardPage.tsx`) to skip groups whose `sourceKind` is not `'ambient'`. Also suppress the
separate pinned-station section in neighbor mode. The `isAmbientComparisonEligibleGroup` check already
defines the right predicate — this extends it to the render level. Custom layouts hide the Neighbors
source toggle entirely because neighbor comparison is a Default-layout aggregate view.

### A2 — Custom layout: history links for owned stations

`MetricRow` and `FillCell` in `CustomDashboardRenderer.tsx` render metric values as plain text.
Wrap the value display in the existing `MetricHistoryValueLink` component (already used by
`RainfallSummaryTile`) when the resolved source is an owned ambient station, passing
`metricKey` and the station MAC as `deviceId`. Set `enabled={!isValueUnavailable}` to match
the default-layout MetricTile behavior.

### A3 — History: default UTC/Local toggle derived from preferences

`MetricDetailPage` initialises `timezone` state as `'local'` regardless of the user's
`dailyExtremaTimezone` preference. Fix:
- Create `useSettingsPreferences` hook (`frontend/src/hooks/useSettingsPreferences.ts`) following
  the same TanStack Query pattern as `useSettingsDevices`; add a `settingsPreferences` key to the
  query key factory.
- In `MetricDetailPage`, seed `timezone` from `preferences.data?.dailyExtremaTimezone` and sync via
  `useEffect` when the data first arrives.

### A4 — History compare: hide section when no other stations; suppress placeholder messages

Three changes to the compare overlay:
1. When `comparisonStationOptions.length === 0`, pass `showComparison={false}` to
   `MetricHistoryControls` and omit the compare section entirely.
2. In `MetricHistoryControls`, render `metric-detail-overlay-state` only when
   `comparisonDeviceId` is non-empty (suppresses the "Select another owned station…" idle hint).
3. Remove the static `metric-detail-provider-overlay-state` paragraph ("Public, pinned, and
   neighbor source history overlays are unavailable…") entirely.

### A5 — Dashboard Neighbors: "Neighbors of \<station\>" label

Inside `NeighborCountButton`, add a heading line above the existing loading/count text:

```tsx
<p className="font-medium text-foreground" data-test-id="dashboard-neighbors-label">
  Neighbors of {stationLabel}
</p>
```

This pairs with A1: once only owned station groups render in neighbor mode, each group clearly
announces whose neighbors are being compared.

### A6 — Container-level layered background shading

Add progressive visual depth using opacity-modified `bg-muted`:
- **L2** `bg-muted/25` — collapsible section content areas (Sources panel body in `DevicesCard.tsx`,
  embedded neighbor config section in `NeighborsConfigPanel.tsx`).
- **L3** `bg-muted/50` — device row `<article>` elements in `DevicesCard.tsx` (currently `bg-card`);
  source group `<details>` wrappers in `DashboardPage.tsx` (add alongside existing classes).

Do not change innermost metric row items (`bg-background`) or category headers (`bg-muted/40`);
they already sit at the correct depth.

### Verification

```bash
npm run build          # type-check
npm run test:frontend  # includes focused coverage for the addendum behavior
npm run test:e2e       # all 79 tests must continue to pass
```

Manual checks: Default-layout neighbor mode hides pinned/public groups and shows "Neighbors of X"
label; Custom layouts do not show the neighbor source toggle; custom layout metric values link to
history; MetricDetailPage timezone follows the preferences setting; compare section absent with one
station; settings and dashboard show visible nesting depth.

**Implementation status:** Completed in `frontend/src/` with regression tests for neighbor-mode
source filtering/labels, Custom-layout neighbor-control suppression, custom-layout owned metric
history links, preference-derived history timezone defaults, hidden comparison controls/placeholders,
and the new container depth classes.
