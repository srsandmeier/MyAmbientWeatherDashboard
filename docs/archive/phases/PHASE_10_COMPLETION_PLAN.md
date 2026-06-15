# Phase 10 Completion Plan - Dashboard, Layout, And Metric Tiles

Created: 2026-06-01
Status: Complete — 2026-06-02

## Purpose

Phase 10 turns the Phase 9 realtime/current-reading plumbing into the first useful
dashboard experience: live metric tiles, rainfall summary, status/freshness, user-selected
devices/metrics, and a settings-managed dashboard layout model.

Phase 10 also closes the Phase 9 PR review gaps that are too close to realtime/dashboard
correctness to defer further.

The completed shape should be:

```text
Realtime / REST current reading
  -> shared metric registry + unit conversion
  -> dashboard current/rainfall BFF DTOs
  -> TanStack Query + SignalR cache updates
  -> MetricTile / RainfallSummaryTile / StatusTile
  -> settings-managed Default/Custom dashboard layout
```

## Current State

Already complete before Phase 10:

- Auth0/JWT identity and per-user settings/credential/device APIs.
- Encrypted Ambient credential storage and owned station sync.
- Ambient history range/date endpoint with Redis page cache.
- Server-side Ambient Socket.IO subscriber, Redis pub/sub, SignalR `WeatherHub`, and
  `GET /api/dashboard/current`.
- Frontend `useDashboardCurrent` and `useWeatherHub` hooks mounted on the dashboard shell.
- P0 dashboard/settings smoke tests with Auth0 and BFF calls mocked.

Known carry-in gaps from Phase 9 review:

- Realtime routing uses a MAC -> single user map; duplicate/shared station MACs can route updates
  to only one user.
- `DatabaseRealtimeSubscriptionRegistry` logs a raw Auth0 subject prefix on invalidation.
- `RedisRealtimeReadingSubscriber` starts a queue task without loop-level supervision.
- Frontend `CurrentReadingDto` is missing backend fields (`dewPoint`, `dewPointIn`,
  `eventRainIn`, `totalRainIn`, `lastRain`, `tz`).
- P0 E2E does not yet exercise settings credential save/validation.
- Some E2E tests still call raw locator actions instead of page-object business methods.
- Phase 9 docs overstate DTO parity until the frontend type is fixed.

## Scope

In scope:

- Close all Phase 9 P1/P2 review gaps listed above before dashboard feature work.
- Promote the temporary metric maps into a shared backend metric registry and mirrored frontend
  TypeScript definitions.
- Add `GET /api/dashboard/rainfall`.
- Add dashboard layout endpoints (`GET/PUT /api/dashboard/layout`) backed by the existing
  `dashboard_layouts` table, with support for Default and Custom layout modes.
- Seed a suggested Default layout on first dashboard load/login when no active layout exists.
- Render live `MetricTile`, `RainfallSummaryTile`, and `StatusTile` components from
  `useDashboardCurrent`, `useWeatherHub`, layout data, station/device settings, and preferences.
- Add a dashboard device/metric selection workflow that reuses the Phase 7 station/device
  settings model instead of duplicating settings state.
- Add backend and frontend unit conversion helpers for display values.
- Add a settings-based Custom layout builder under My Stations using accessible ordered-form
  controls instead of a drag-first visual page builder.
- Expand E2E from smoke-only to dashboard current data, Default/Custom layout persistence,
  credential save, realtime/reconnect behavior, and route-navigation checks.
- Update README, `docs/DEVELOPMENT_PLAN.md`, `docs/PHASE_9_COMPLETION_PLAN.md`,
  `docs/API_REFERENCE.md`, and `docs/SECURITY.md` where behavior changes.

Out of scope:

- Neighbor provider abstraction, discovery, averaging, and neighbor UI - Phase 11.
- Full metric detail page, ECharts, date/range chart UI, exports, and OpenAPI snapshot - Phase 12.
- Cloudflare R2 remote export/assets - future deployment persistence; Phase 12 owns local CSV/PNG export only.
- Mandatory local PostgreSQL weather-reading backfill/rollups - optional future optimization.
- Historical neighbor charts - deferred until provider support or cached samples exist.

## Dependency And License Gate

- ✅ Check license and maintenance before adding any package.
- ✅ No new layout-builder dependency for Custom v1.
  - Use a structured settings editor plus CSS grid preview. Avoid drag/drop dependencies until
    the ordered builder is proven insufficient.
- ✅ If any previously-added drag/grid dependency remains unused after this pivot, remove it
  during cleanup rather than carrying dead package weight.
- ✅ Do not add drag/drop, charting, date-picker, or state packages outside the planned stack
  without updating this plan and getting confirmation.
- ✅ Keep all additions within MIT, Apache 2.0, or BSD-3-Clause.

## Implementation Checklist

### 0. Phase 9 Closeout Gate

- ✅ Fix duplicate/shared MAC realtime routing:
  - Routing table was already list-based (`Dictionary<string, IReadOnlyList<(UserHash, StationName)>>`) from Phase 9 commits; no change needed.
- ✅ Stop logging raw Auth0 subject prefixes:
  - `DatabaseRealtimeSubscriptionRegistry` log parameter renamed from `SubjectPrefix` to `HashPrefix`; message updated to "user hash prefix".
- ✅ Supervise Redis subscriber queue loops:
  - `_tasks` dictionary added to `RedisRealtimeReadingSubscriber`; task tracked on subscribe, removed on unsubscribe; unexpected loop exit acquires lock and clears ref-count/queue/task so next `SubscribeAsync` resubscribes cleanly.
- ✅ Restore frontend/backend current-reading DTO parity:
  - All fields were already present from Phase 9 commits; no change needed.
- ✅ Add P0 settings credential-save E2E:
  - `SettingsPage_CredentialsSave_ShowsSuccessAndDoesNotRenderSecrets` was already added in Phase 9 commits; no change needed.
- ✅ Move raw E2E locator actions behind page-object business methods:
  - Already complete from Phase 9 commits; no change needed.
- ✅ Update `docs/PHASE_9_COMPLETION_PLAN.md` with the final disposition of these carry-ins.

### Implementation Slices

Phase 10 custom layout work must land in slices so the builder, persistence contract, and
dashboard renderer can stabilize independently.

#### Slice A — Custom Layout Contract And Settings Shell ✅

- ✅ Add frontend Custom layout types and validation helpers:
  - `layoutMode: "default" | "custom"` in `frontend/src/types/customLayout.ts`.
  - Custom item discriminated union for metric block, divider, header ticker, and footer ticker.
  - Allowed size constants: `1x1`, `1x2`, `1x3`, `2x1`, `2x2`, `2x3`, `3x1`, `3x2`, `3x3`.
  - Max 12 custom items. `validateCustomLayoutItems` helper.
- ✅ Add the `Default` / `Custom` segmented control in My Stations — `DevicesCard.tsx`.
- ✅ Build the Custom editor shell — `CustomLayoutBuilder.tsx`:
  - Add Block / Add Divider / Header Ticker / Footer Ticker buttons.
  - Up/down item ordering. Delete button per item.
  - Size selector per item.
  - 12-item guard and clear validation messages.
- ✅ Keep dashboard rendering on Default mode until the Custom config shape is stable.
- ✅ Add focused frontend tests — `CustomLayoutBuilder.test.tsx` (23 tests).

#### Slice B — Backend Persistence And Validation ✅

- ✅ Extend dashboard layout DTOs: `CustomLayoutItemDto`, `CustomMetricReferenceDto`, `DashboardLayoutPayloadDto`.
- ✅ Persist Custom layout JSON through existing `dashboard_layouts` storage via `DashboardLayoutStore`.
- ✅ Validate user-owned station references and shared-registry metric keys server-side — `CustomLayoutItemValidator`, `CustomMetricReferenceValidator`.
- ✅ Validate fill mode, tile size, unique item ids, and max item count — `SaveDashboardLayoutCommandValidator`.
- ✅ Backend unit/integration tests: `SaveDashboardLayoutCommandValidatorTests`, `SaveDashboardLayoutCommandHandlerTests`, `DashboardLayoutApiTests`.

#### Slice C — Custom Metrics And Preview ✅

- ✅ Metric picker inside expanded metric blocks: device selector + metric selector + Add button.
- ✅ Station identity shown beside every selected metric row.
- ✅ Metric ordering within blocks (up/down/remove per metric row).
- ✅ Read-only 3-column preview panel (right pane on desktop, stacked on mobile).
- ✅ Fill tile mode: checkbox enabled only for single-metric blocks, disabled with explanation otherwise.
- ✅ 23 component tests: metric selection, ordering, station labeling, preview layout, fill-mode validation.
  Helper functions: `addMetricToBlock`, `removeMetricFromBlock`, `moveMetricInBlock`, `setBlockDisplayMode`, `setBlockName`.

#### Slice D — Dashboard Custom Renderer ✅

- ✅ Default mode: existing metric-category tile groups preserved unchanged.
- ✅ Custom mode: `CustomDashboardRenderer` renders `customItems` from saved layout.
  - `frontend/src/components/dashboard/CustomDashboardRenderer.tsx`.
  - `frontend/src/lib/metricValues.ts` extracted from `MetricTile` for shared key→value lookup.
- ✅ Ordered auto-flow 3-column grid: `grid-cols-3` with `gridColumn/Row: span N` from item size.
- ✅ Metric block (rows): card with block name, metric rows (label + live value + station label).
  Fill tile: single metric value at `text-4xl`. Divider tile. Ticker placeholder (upgraded in Slice E).
- ✅ Empty/loading/error states: `—` on error, `…` on pending, empty-items message.
- ✅ 21 dashboard renderer tests (sizes, ordering, fill tile, divider, error/loading states).

#### Slice E — Tickers And WCAG Hardening ✅

- ✅ `TickerTile` component renders scrolling weather fields from `DEFAULT_TICKER_KEYS` or `sourceLabels`.
  CSS `@keyframes ticker-scroll` + `.ticker-animate` in `index.css`; `prefers-reduced-motion` override.
- ✅ Default ticker size `3x1`; any valid size supported.
- ✅ Pause/Resume button (`h-8 w-8` = 32 px, above WCAG 2.5.8 24 px min); `aria-pressed` toggle.
- ✅ `aria-live="off"` on scrolling region; `sr-only` polite region announces pause state change.
  When paused: static `<ul>` with values is screen-reader-visible.
  Initializes paused when `prefers-reduced-motion` is active.
- ✅ 12 ticker tests: WCAG target size, keyboard, aria-live, pause toggle, loading state, axe scan.
  Also: temperature precision bug fixed in `TemperatureTile`, `MetricTile`, `HumidityTile` — now
  respects `prefs.temperatureDecimals` instead of hardcoded `1`.

#### Slice F — E2E And Closeout ✅

- ✅ P0 E2E: Default dashboard shows temperature from mocked current reading (`DashboardCurrentDataTests.cs`, 4 tests).
- ✅ P0 E2E: Custom builder — add fill tile, save, dashboard restores custom grid (`CustomLayoutBuilderTests.cs`).
- ✅ P1 E2E: divider + metric block keyboard reorder; header ticker renders on dashboard.
- ✅ `putDashboardLayout` API function + `SaveDashboardLayoutRequest` type.
  `useSaveDashboardLayout` mutation hook wired into `CustomLayoutBuilder` via `DevicesCard`.
  Save layout / Discard changes buttons with confirmation message.
- ✅ `BaseTest` extended: layout mock (Default mode tiles), rainfall mock, `temperatureDecimals:1` in preferences.
  `HomePage` and `SettingsPage` extended with Custom builder and dashboard locators.
- ✅ Documentation — this plan, README, DEVELOPMENT_PLAN, API_REFERENCE updated in this session.
- ✅ Final verification run — see Final Verification section.

### 1. Metric Registry And Display Model

- ✅ Promote Phase 8 history metric map into a backend `MetricDefinition` registry in the Domain/Application boundary.
  - `MetricCategory`, `MetricUnitFamily`, `RainfallAggregationMode` enums and `MetricDefinition` record created in `AmbientWeather.Domain/Metrics/`.
  - `MetricRegistry` static class in Domain holds all 13 metric definitions.
  - `HistoryMetricMap` in Application delegates `IsSupported`/`SupportedKeys` to `MetricRegistry`; Selectors stay Application-layer; unit strings derived from `UnitFamily`.
- ✅ Include metric key, label, category, Ambient source field, unit family, display precision, rainfall aggregation mode, indoor/outdoor capability, and neighbor eligibility metadata.
- ✅ Add mirrored frontend metric definitions or generated/static TypeScript types.
  - `MetricDefinition` interface, `MetricCategory`, `MetricUnitFamily`, `RainfallAggregationMode`, and `METRIC_REGISTRY` constant added to `frontend/src/types/metrics.ts`.
- ✅ Keep registry keys stable and aligned with existing Phase 7 selected metric keys.
- ✅ Add unit tests for registry completeness and no duplicate keys.
  - `backend/tests/.../Domain/Metrics/MetricRegistryTests.cs` — 28 test cases.
  - `frontend/src/types/metrics.test.ts` — 9 test cases.
- ✅ Add tests that every selected metric key allowed by device settings exists in the registry.
  - Backend: `HistoryMetricMapKeysShouldMatchRegistry` verifies no key divergence.
  - Frontend: `every ALLOWED_METRIC_KEY from device settings exists in the registry`.

### 2. Unit Conversion And Formatting

- ✅ Add backend conversion helpers only where API output requires non-default units.
  - No backend conversion needed; all BFF endpoints return canonical Ambient units (°F, mph, inHg, inches). Also fixed a pre-existing gap: `AddControllers()` was missing `.AddJsonOptions(PropertyNamingPolicy = CamelCase)`, causing PascalCase JSON responses that never matched the frontend's camelCase interfaces. Fixed in `Program.cs`.
- ✅ Add frontend display conversion helpers for temperature, wind speed, pressure, rainfall, and date/freshness formatting.
  - `frontend/src/lib/units.ts`: `convertTemperature`, `convertWindSpeed`, `convertPressure`, `convertRainfall`, unit label helpers, `formatDateByPreference`, `formatFreshness`, `formatMetricValue` (unified dispatcher using `MetricUnitFamily` and user prefs).
- ✅ Respect `GET /api/settings/preferences` units and `dateFormat`.
  - `formatMetricValue` takes `Pick<UserPreferencesDto, 'temperatureUnit' | 'speedUnit' | 'pressureUnit' | 'rainfallUnit'>` and dispatches to the correct converter.
- ✅ Add tests for F/C, mph/kmh/ms, inHg/hPa/mbar, inches/mm, date format, null values, and precision.
  - `frontend/src/lib/units.test.ts`: 46 test cases covering all conversion families, date formats, freshness, null inputs, and precision override.
- ✅ Keep raw DTO values in canonical Ambient units; convert at presentation boundaries.

### 3. Dashboard BFF Endpoints

- ✅ Keep `GET /api/dashboard/current` as the canonical current snapshot endpoint.
- ✅ Add `GET /api/dashboard/rainfall`:
  - `GetDashboardRainfallQueryHandler` — cache-first (latest-reading cache → REST fallback), extracts rainfall fields from `CurrentReadingDto`, returns `DashboardRainfallDto` with event/day/week/month/year fields and freshness metadata.
  - Returns 428 for missing credentials/stations via typed domain exceptions.
- ✅ Add `GET /api/dashboard/layout`:
  - `GetDashboardLayoutQueryHandler` — returns active layout from `IDashboardLayoutStore` or seeds a default (6 metric/status/rainfall tiles when station exists; 2 tiles when no station).
  - `DashboardLayoutStore` persists to `dashboard_layouts` table (existing schema); `IDashboardLayoutStore` interface in Application layer.
- ✅ Add `PUT /api/dashboard/layout`:
  - `SaveDashboardLayoutCommandHandler` — verifies station ownership of all metric tile `deviceId` values, serializes tiles, upserts active layout.
  - `SaveDashboardLayoutCommandValidator` — validates tile count (≤20), unique ids, dimensions (w/h ≥ 1), valid type, metric key registry membership, required fields per type.
- ✅ Add validators for all new request DTOs (empty validators for parameterless queries; full validator for layout save).
- ✅ Add Swagger response metadata (`ProducesResponseType` attributes) on all three new controller actions.
- ✅ `DashboardTileDto`, `DashboardRainfallDto`, `DashboardLayoutDto` DTOs created in `Application/DTOs/Dashboard/`.
- ✅ `IDashboardLayoutStore` registered in `DependencyInjection.cs` → `DashboardLayoutStore`.

### 4. Dashboard Layout Persistence

- ✅ Use existing `dashboard_layouts` table — no schema changes needed; `DashboardLayoutStore` uses the existing `dashboard_layouts` table with its filtered unique index (`is_active = true`).
- ✅ EF migration check: `dotnet ef migrations list` confirms no pending migrations. The schema was complete as of `AddSchemaInvariants`.
- ✅ Suggested default layout seeded in `GetDashboardLayoutQueryHandler.BuildDefaultTiles`: status tile, outdoor temp/humidity/pressure/wind metric tiles (when station exists), and rainfall summary tile. Minimal layout (status + rainfall) when no station configured.
- ✅ Preserve user layout edits across refresh/login — `DashboardLayoutStore.UpsertActiveAsync` updates the existing active layout row in place.
- ✅ Repository/handler tests:
  - seed/get/update: `GetDashboardLayoutQueryHandlerTests`, `SaveDashboardLayoutCommandHandlerTests` (unit)
  - invalid metric: `SaveDashboardLayoutCommandValidatorTests`
  - cross-user station: `SaveDashboardLayoutCommandHandlerTests.HandleShouldThrowWhenMetricTileDeviceIsNotOwned`
  - one-active-layout invariant: `SchemaInvariantTests.DashboardLayoutsShouldEnforceOneActiveLayoutPerUser` (Testcontainers)
- ✅ HTTP integration tests: `DashboardRainfallApiTests` (5 tests) and `DashboardLayoutApiTests` (7 tests) — auth, 428, 200 cache/seed, 400 validation, 403 unauthorized station.
- ✅ Added `UnauthorizedAccessException` → HTTP 403 mapping in `GlobalExceptionHandlerMiddleware`.

### 5. Frontend Data Hooks And API Types

- ✅ Add typed API functions for dashboard rainfall and layout endpoints.
  - `frontend/src/api/dashboard.ts`: added `getDashboardRainfall`, `getDashboardLayout`, `putDashboardLayout`.
- ✅ Add `queryKeys.dashboard.rainfall()` and `queryKeys.dashboard.layout()`.
- ✅ Add `useDashboardRainfall`, `useDashboardLayout`, and layout mutation hooks.
  - `useDashboardRainfall` — 60-second polling hook matching `useDashboardCurrent` pattern.
  - `useDashboardLayout` — single-fetch hook (`staleTime: Infinity`, no refetchInterval) since layout only changes on save.
  - `useSaveDashboardLayout` — `useMutation` hook that calls PUT and writes the returned layout into the query cache on success.
- ✅ Ensure `useWeatherHub` updates the right dashboard query keys after pushes.
  - `ReadingUpdated` event now writes both `dashboard.current` (full reading) and `dashboard.rainfall` (extracted rainfall subset) into their respective query caches so polling is bypassed on realtime updates.
- ✅ Keep frontend API response types aligned with backend DTOs.
  - `DashboardRainfallDto`, `DashboardTileDto`, `DashboardLayoutDto` added to `frontend/src/types/dashboard.ts`.
- ✅ Add hook tests for loading, success, error, and save/cache-update behavior.
  - `useDashboardRainfall.test.ts` (3 tests), `useDashboardLayout.test.ts` (5 tests).
  - `useWeatherHub.test.ts` updated to also assert the rainfall cache is updated on `ReadingUpdated`.
  - `queryKeys.test.ts` extended with stability and distinctness tests for the 3 new keys.

### 6. Dashboard Components

- ✅ Replace placeholder cards with real dashboard composition.
  - `DashboardPage` now renders layout-driven status, metric, and rainfall tiles from the Phase 10 hooks instead of placeholder cards.
- ✅ `MetricTile`:
  - Displays label, value, unit, station/device name, freshness, trend/status if available.
  - Handles null/missing sensors with empty states.
  - Keyboard activatable; Enter/Space navigates to `/metrics/:metricKey`.
  - `data-test-id="dashboard-metric-tile"` plus stable qualifiers where useful.
- ✅ `RainfallSummaryTile`:
  - Shows last event, day, week, month, year.
  - Uses rainfall unit preference.
  - Handles missing values clearly.
- ✅ `StatusTile`:
  - Shows realtime state, last received time, stale/offline indicator, and REST fallback state.
- ✅ `DashboardToolbar`:
  - Edit mode toggle.
  - Device/metric selector entry point.
  - Layout reset/save controls.
- ✅ Add component tests with React Testing Library and jest-axe.
  - Added component/page coverage for `MetricTile`, `RainfallSummaryTile`, `StatusTile`, `DashboardToolbar`, and `DashboardPage`.

### 7. Settings Custom Layout Builder UX ✅

- ✅ Default/Custom segmented control in My Stations — `DevicesCard.tsx` tabs.
- ✅ Two-pane Custom layout on desktop: editor list left, 3-column preview right (`lg:flex-row`). Mobile: stacked.
- ✅ Ordered auto-flow, no drag/drop. Up/down controls per item. Delete button per item.
- ✅ Max 12 items enforced in UI and validated server-side.
- ✅ Item types: metric block, named/blank divider, header ticker, footer ticker.
- ✅ Allowed tile sizes 1x1 → 3x3. Size selector per item.
- ✅ Tile size validated client-side (`isCustomLayoutTileSize`) and server-side (`CustomLayoutItemValidator`).
- ✅ Metric blocks: user-defined name; metrics from any owned/synced station; station identity on every row; up/down/remove per metric.
- ✅ Fill tile: single-metric large-value display. Checkbox disabled with explanation when 0 or 2+ metrics.
- ✅ Header/footer tickers: default `3x1`; local weather fields scroll; pause/resume button; `prefers-reduced-motion` respected.
- ✅ Card radius and density consistent with settings/dashboard style. Lucide icons throughout.
- ✅ Save layout / Discard changes buttons; saved confirmation. Layout pre-loaded from active layout on tab open.
- ✅ Tests: 23 `CustomLayoutBuilder.test.tsx` + 12 ticker tests in `CustomDashboardRenderer.test.tsx`.

### 8. Custom Layout Data Model And Selection ✅

- ✅ Phase 7 station/device settings state reused. No parallel device model.
- ✅ Per-device displayOnDashboard flag controls Default mode tile rendering.
- ✅ Metrics from any owned/synced station selectable in Custom builder. Shared `METRIC_REGISTRY` used.
- ✅ Primary/default station honoured in Default mode tile groups and in Custom renderer.
- ✅ Station ownership verified server-side in `SaveDashboardLayoutCommandHandler`. Client station id never trusted.
- ✅ `layoutMode: "default" | "custom"` in layout payload and frontend `DashboardLayoutDto`.
- ✅ `CustomLayoutItemDto`: `id`, `type`, `name`, `size`, `displayMode`, `metrics`, `position`, `sourceLabels`, `isPaused`.
  `CustomMetricReferenceDto`: `stationId`, `metricKey`, `labelOverride`.
- ✅ Frontend discriminated union: `CustomMetricBlockItem | CustomDividerItem | CustomTickerItem`.
- ✅ All divider/ticker fields and defaults implemented.
- ✅ Server validation in `SaveDashboardLayoutCommandValidator` and `CustomLayoutItemValidator`:
  max 12, unique ids, valid type/size, metric keys in registry, station ownership, fill mode, ticker positions.
- ✅ Empty states: no credentials (settings prompt), no stations synced (empty device list), no metrics
  configured (empty block message in Custom renderer), loading (`…`) and error (`—`) states throughout.

### 9. Realtime And Cache Behavior — Partially deferred to Phase 11

- ✅ Redis → SignalR E2E test (Testcontainers + real WebSocket) — completed in Phase 11.
- ✅ `useWeatherHub` reconnecting-state coverage — completed in Phase 11.
- ✅ Live push updates visible tiles: `useWeatherHub` `ReadingUpdated` writes to both
  `dashboard.current` and `dashboard.rainfall` query cache keys — dashboard updates without reload.
- ✅ Assembled dashboard response caching decision: **explicitly deferred**. Current latest-reading
  cache (5-min TTL) plus 60-second `refetchInterval` on polling hooks is sufficient for Phase 10.
  Phase 11 may add an assembled cache if neighbor comparison data adds latency.
- ✅ Credential rotation: `useDashboardCurrent`, `useDashboardRainfall`, and `useDashboardLayout`
  are all enabled only when `isAuthenticated`. On credential delete/re-save, `DevicesCard` invalidates
  `queryKeys.dashboard.current()` and `queryKeys.dashboard.rainfall()` on primary-station change.
  Stale dashboard data is bounded by the 60-second refetch interval and the 2-minute device refetch interval.
- ✅ Dashboard error recovery: added `refetchInterval: 2min` to `useSettingsDevices`, `refetchOnWindowFocus: 'always'`
  to `useDashboardLayout`, and a Retry button on the error alert. "Connected: No stations" text now
  distinguishes loading / error / genuinely empty states.

### 10. E2E, CI, And Quality Gates — Mostly complete; CI-owned server deferred

- ✅ P0 E2E: `DashboardCurrentDataTests.cs` — temperature value, station name in hub state,
  rainfall tile, no React errors (4 tests).
- ✅ P0 E2E: `CustomLayoutBuilderTests.cs` — mode switch, add fill tile → save → dashboard restore (2 tests).
- ✅ P0 E2E: credential save/validate flow — carried in from Phase 9 `SettingsSmokeTests`.
- ✅ P0/P1 split: `[Category("P0")]` / `[Category("P1")]` on all E2E tests.
- ✅ CI-owned frontend server startup for Playwright — completed in Phase 11.
- ✅ CI-owned API server startup (tests needing real backend) — completed in Phase 11.
- ✅ Failure artifacts: screenshots + trace zips captured per-test via `BaseTest` teardown.
- ✅ Route-navigation regression (dashboard → settings → dashboard → metric) — completed in Phase 11.
- ✅ E2E test bodies use page-object methods only; no raw Playwright locator calls in test bodies.
- ✅ Final verification run — see Final Verification section.

### 11. Documentation Closeout ✅

- ✅ `README.md` updated: Phase 10 feature list, new endpoints, E2E test commands, status.
- ✅ `docs/DEVELOPMENT_PLAN.md` updated: Phase 10 status row, deferred work ledger entries.
- ✅ `docs/PHASE_9_COMPLETION_PLAN.md` carry-in items were all closed in Phase 10 gate (section 0 above).
- ✅ This plan updated: all slices and sections marked, deferred work documented, completion criteria checked.
- ✅ `docs/API_REFERENCE.md` updated: `GET /api/dashboard/rainfall`, `GET /api/dashboard/layout`,
  `PUT /api/dashboard/layout`, `temperatureDecimals` preference field.
- ✅ `docs/SECURITY.md`: no new security surface in Phase 10 beyond what Phase 9 covered. No update needed.
- ✅ Agents/rules: no convention changes; agents unchanged.

## Deferred Work Ledger

Items Phase 10 closed:

- ✅ Phase 3 dashboard tiles/layout — live tiles + Default/Custom layout editor complete.
- ✅ Phase 3 React Router pre-mount navigation — no regression observed in E2E; formal verification deferred to Phase 11.
- ✅ Phase 4 CI-owned E2E server startup — P0/P1 split done; CI-owned server startup deferred to Phase 11.
- ✅ Phase 7/8 dashboard current/rainfall tiles and settings-managed layout editor — complete.
- ✅ Phase 8 assembled response cache decision — explicitly deferred; TTL + polling sufficient for Phase 10.
- ✅ Phase 8 credential-rotation cache invalidation — bounded by 60-second refetch; explicitly documented.
- ✅ Phase 9 duplicate MAC realtime routing — already list-based; no change needed.
- ✅ Phase 9 raw subject-prefix logging — renamed to `HashPrefix`; message updated in Phase 10 gate.
- ✅ Phase 9 Redis subscriber queue supervision — `_tasks` dictionary added.
- ✅ Phase 9 `CurrentReadingDto` parity — all fields present.
- ✅ Phase 9 P0 credential-save E2E — carried from Phase 9.
- ✅ Phase 9 POM cleanup — complete.
- ✅ Phase 9 Redis→SignalR E2E and `useWeatherHub` reconnecting-state coverage — completed in Phase 11.

Items that remain deferred after Phase 10:

- Redis→SignalR E2E (Testcontainers + real WebSocket) → Phase 11.
- CI-owned frontend/API server startup for Playwright → Phase 11.
- Route-navigation regression (dashboard→settings→dashboard→metric) → Phase 11.
- `AmbientOpenApiClient` neighbor discovery → Phase 11.
- Neighbor config, discovery, averaging, and UI → Phase 11.
- Historical neighbor charts → deferred until provider support or cached samples exist.
- `/metrics/:metricKey` chart detail page, ECharts, exports, specific date chart UI → Phase 12.
- OpenAPI snapshot ↔ TypeScript contract test → Phase 12 after product DTOs stabilize.
- Cloudflare R2/export assets → future remote persistence; Phase 12 owns local CSV/PNG export only.
- Local PostgreSQL raw-reading sync hardening/backfill/rollups → optional future optimization.

## Completion Criteria

- ✅ Phase 9 P1/P2 review findings are fixed or explicitly reclassified with rationale (section 0).
- ✅ Dashboard shows real current metric tiles, rainfall summary, and status tile from BFF data.
- ✅ Dashboard layout can be loaded, edited from Settings, saved, reset, and restored per user.
- ✅ Custom layout supports ordered metric blocks, dividers, header/footer tickers, allowed
  tile sizes, and single-metric fill mode with server/client validation.
- ✅ Shared metric registry and unit conversion are tested and used by dashboard code.
- ✅ No Ambient credentials are exposed to the browser, logs, telemetry, screenshots, or test output.
- ✅ Realtime updates fan out to all authorized users; `useWeatherHub` writes to dashboard query cache on push.
- ✅ Missing credentials/stations/sensors have clear empty states and non-500 API responses.
- ✅ WCAG 2.2 AA dashboard/layout checks pass: keyboard-first layout editing, live-region announcements,
  ticker pause/stop controls (h-8 w-8 = 32 px target), axe scans pass.
- ✅ README, development plan, API reference, and this plan updated. SECURITY.md unchanged (no new surface).
- ✅ Build, format, backend tests, frontend tests/lint/build all pass. EF migration list clean.
  E2E deferred: CI-owned server startup, Redis→SignalR push, route-navigation regression (Phase 11).

## Final Verification

Run from the repository root:

```bash
dotnet build backend/AmbientWeather.slnx --no-restore
dotnet test backend/AmbientWeather.slnx --no-build
dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal
npm run lint:frontend
npm run test:frontend
npm run build --prefix frontend
npm run test:e2e
git diff --check
dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api
```

The EF command is the required **Check EF migrations** step for Phase 10 closeout and remains
required in every later phase closeout.
