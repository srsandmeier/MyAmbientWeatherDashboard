# E2E Test Flows

Status: Coverage audit updated 2026-06-11 from README, API reference, phase plans, current
Playwright Test TypeScript coverage, and remaining Phase 12 release-gate gaps.

This document translates the user journeys and use cases in the project docs into scenario-level
E2E coverage.

Current implementation is Playwright Test TypeScript in `tests/e2e`.

TypeScript E2E standards:

- Test bodies call page-object or shared test-flow methods only.
- Locators use stable `data-test-id` through Playwright's configured `testIdAttribute`.
- Use web-first locator assertions for UI state. For non-locator state such as route mock counters,
  captured payloads, API/cache/sync status, or background sync completion, use `expect.poll`
  instead of fixed waits.
- Auth0 and BFF calls are mocked unless a scenario explicitly calls for a real integration path.
- No real addresses, coordinates, zip codes, station ids, MACs, tenant values, or keys appear in
  test data. Generate values at runtime or use sanitized placeholders.
- P0 flows are merge-gate journeys. P1 flows are extended product coverage.

Target TypeScript architecture:

- Fixtures own Auth0 and BFF route mocks, generated test data, per-test browser contexts,
  trace/video/screenshot artifacts, and P0/P1 project setup.
- Small helper functions own common user flows such as opening Settings, saving credentials,
  switching dashboard sources, selecting chart controls, and asserting API mock payloads.
- Page objects are used only for large reusable surfaces where they improve readability:
  Settings, Dashboard, Metric Detail, and any future dense editor surface.
- `expect(locator)` remains the default UI wait. Use `expect.poll` for route mock counters,
  captured payloads, API/cache/sync status, and background completion.
- TS specs use title tags `@p0` and `@p1`; CI filters by those tags.
- Use `test.step(...)` for multi-action flows so traces remain readable.
- Keep route mocks in fixtures/mock builders, not ad hoc inside spec bodies.
- Use mocked Auth0 only; no real tenant IDs, real tokens, or persisted real-user storage state.
- Keep TS E2E strict: no `any`, typed API mock payloads, and no accidental real external network
  calls.
- `playwright.config.ts` must set `testIdAttribute: "data-test-id"`, env-driven `baseURL`,
  CI-only retry, trace/video/screenshot artifacts, and `forbidOnly` in CI.
- Prohibit arbitrary sleeps, CSS-class selectors, XPath, and index-based selectors unless the
  exception is documented next to the test.

## Current Coverage Snapshot

| Area | Current E2E files |
|---|---|
| Dashboard shell/current/rainfall | `dashboard.smoke.spec.ts`, `dashboard.current.spec.ts` |
| Settings credentials/preferences/devices | `settings.smoke.spec.ts` |
| Dashboard layout/custom builder | `custom-layout-builder.spec.ts` |
| Route navigation | `navigation.spec.ts` |
| Neighbors | `neighbors.spec.ts` |
| Public sources in Settings | `public-sources.spec.ts` |

Coverage status meanings:

- Covered: an E2E test exercises the main user-visible behavior.
- Partial: an E2E test exercises the shell or happy path, but important state or assertion depth is
  still missing.
- Missing: no matching E2E coverage exists yet.
- Planned: product UI/API surface is not complete enough for final E2E coverage.

## Flow Coverage Matrix

| Flow | Priority | Status | Current E2E coverage | Needed next |
|---|---:|---|---|---|
| E2E-P0-001 Authenticated dashboard shell loads | P0 | Covered | `dashboard.smoke.spec.ts` covers authenticated shell/navigation and no-error smoke. | Keep as fast merge gate. |
| E2E-P0-002 Dashboard current data and rainfall render | P0 | Covered | `DashboardCurrentDataTests` covers station label, temperature, rainfall tile, no error boundary | Add specific assertions when new provider fields become first-class dashboard metrics. |
| E2E-P0-003 Credential save does not expose secrets | P0 | Covered | `settings.smoke.spec.ts` covers credential save success without rendering submitted secrets. | Keep sanitization assertion in place as credential UI changes. |
| E2E-P0-004 Credential delete confirmation | P0 | Covered | `settings.smoke.spec.ts` covers open/cancel, confirm DELETE, and post-delete status. | Keep as credential safety merge gate. |
| E2E-P0-005 Route round trip to metric detail | P0 | Covered | `navigation.spec.ts` covers the route round trip; `dashboard.current.spec.ts` covers real dashboard value click and keyboard activation to Metric Detail. | Keep as fast merge gate. |
| E2E-P0-006 Custom fill tile saves and restores | P0 | Covered | `custom-layout-builder.spec.ts` covers fill tile save and dashboard restore. | Add source-kind variants under P1, not the P0 gate. |
| E2E-P0-007 Click tile to metric detail chart shell | P0 | Covered | `dashboard.current.spec.ts` clicks/focuses a real dashboard metric value and asserts Metric Detail title and chart render. | Add range/date/table assertions under P1 chart-control flows. |
| E2E-P0-008 Missing credentials and missing station prompts | P0 | Covered | `settings.smoke.spec.ts` covers Settings; `dashboard.current.spec.ts` covers dashboard missing-credentials and no-stations prompts. | Keep as setup-path merge gate. |
| E2E-P1-001 Preferences save and theme/units apply | P1 | Covered | `settings-preferences.spec.ts` covers the PUT payload, Dashboard temperature/date formatting, and dark theme application. | Add more unit variants if preference formatting regressions appear. |
| E2E-P1-002 Device sync and device settings | P1 | Covered | `owned-device-settings.spec.ts` covers sync, nickname, primary, dashboard visibility, and metric selection; `default-metric-ordering.spec.ts` covers category/field ordering and Dashboard order. | Add dashboard suppression assertions if owned-station visibility regressions appear. |
| E2E-P1-003 Runtime mock stations preview | P1 | Covered | `settings.smoke.spec.ts` covers runtime mock station rendering with mocked credentials. | Keep trigger values sanitized and generated. |
| E2E-P1-004 Default metrics category and field ordering | P1 | Covered | `default-metric-ordering.spec.ts` covers category move, field move, save payload, and Dashboard order; `layout-unsaved-guard.spec.ts` covers Save and Discard route-continuation prompts. | Keep as layout safety coverage. |
| E2E-P1-005 Custom divider and keyboard reorder | P1 | Covered | `custom-layout-builder.spec.ts` covers divider/block reorder plus named and blank divider save/render. | Keep as divider release-gate coverage. |
| E2E-P1-006 Header/footer tickers | P1 | Covered | `custom-layout-builder.spec.ts` covers header ticker, footer ticker, pause control, alert content, public channel source, configured field text, configured NWS zone alert content, and reduced-motion/static initialization. | Keep as ticker release-gate coverage. |
| E2E-P1-007 Custom source picker owned/public/pinned | P1 | Covered | `custom-layout-builder.spec.ts` covers owned/public/pinned picker sources, provider provenance, unsupported metric filtering, and saved metric references. | Keep as custom-source release-gate coverage. |
| E2E-P1-008 Neighbor config save | P1 | Covered | `neighbors.spec.ts` covers panel expand and save payload. | Add provider checkbox/numeric field variants if regressions appear. |
| E2E-P1-009 Neighbor refresh drawer and pin | P1 | Covered | `neighbors.spec.ts` covers refresh, drawer, rows, pin action, and saved pinned-station config payload. | Keep as pinned-source release-gate coverage. |
| E2E-P1-010 Dashboard own/neighbors toggle | P1 | Covered | `neighbors.spec.ts` covers Default-layout neighbors provenance, return-to-own, and 428 unavailable state; frontend unit coverage verifies Custom layouts hide the neighbor toggle. | Add more no-station variants only if backend response semantics change. |
| E2E-P1-011 Public source discovery and add | P1 | Covered | `public-sources.spec.ts` covers city/state search, discovered result, add payload, saved row, empty state, and error state. | Keep as public-source release-gate coverage. |
| E2E-P1-012 Public source row management | P1 | Covered | `public-sources.spec.ts` covers saved row, provider badge, visibility toggle PUT, label edit, delete, supported metric pills, selected metric/order persistence, and Open-Meteo variant. | Keep as public-source release-gate coverage. |
| E2E-P1-013 Public and pinned sources in default dashboard | P1 | Covered | `dashboard.smoke.spec.ts` covers enabled public source group, disabled-source suppression, public missing-reading state, and pinned not-in-cache guidance; `neighbors.spec.ts` covers pinned source group. | Keep as provider dashboard release-gate coverage. |
| E2E-P1-014 Active alert banner and ticker | P1 | Covered | `dashboard.smoke.spec.ts` covers banner headline, detail expand/collapse, warning count, and area selection; `custom-layout-builder.spec.ts` covers ticker headline and ticker-specific zone alerts. | Keep as alert/ticker release-gate coverage. |
| E2E-P1-015 Alert area or zone selection | P1 | Covered | `dashboard.smoke.spec.ts` covers manual NWS zone entry and asserts `/api/alerts/active?area=...` refetch. | Keep as alert/ticker release-gate coverage. |
| E2E-P1-016 Metric history range/granularity | P1 | Covered | `metric-detail.spec.ts` covers range and granularity query params, chart render, and table expansion with values. | Keep as Metric Detail release-gate coverage. |
| E2E-P1-017 Specific historical date mode | P1 | Covered | `metric-detail.spec.ts` covers custom date mode, date query param, and chart render. | Keep as Metric Detail release-gate coverage. |
| E2E-P1-018 Removed chart exports | P1 | Removed | None | Exports were removed from Phase 12 scope; do not add download assertions. |
| E2E-P1-019 Owned comparison overlay | P1 | Covered | `metric-detail.spec.ts` covers selecting another owned station, asserting the comparison `deviceId` history request, and rendering the comparison status/chart. | Keep as Metric Detail release-gate coverage. |
| E2E-P1-020 Neighbor/public history disabled state | P1 | Covered | `metric-detail.spec.ts` covers unsupported current-only provider metrics without fetching history. | Keep as provider-history limitation coverage. |
| E2E-P1-021 Keyboard walkthrough | P1 | Covered | `accessibility-quality.spec.ts` covers Dashboard source toggles, theme menu open/Escape close, ticker pause/resume, Settings custom-layout builder add controls, credentials confirmation Escape close, neighbor drawer Escape close, and Metric Detail table controls by keyboard. | Keep as representative keyboard walkthrough coverage. |
| E2E-P1-022 Axe audits | P1 | Covered | `axe-audits.spec.ts` covers Dashboard, Metric Detail, Settings, custom layout builder, neighbor drawer, and delete dialog states. | Keep page-level axe audits aligned with newly added primary surfaces. |
| E2E-P1-023 Light/dark theme visibility | P1 | Covered | `accessibility-quality.spec.ts` covers key Dashboard, Metric Detail chart controls, Settings regions, and representative disabled/empty/error states in dark/light themes. | Add focused cases only when new visual states are introduced. |
| E2E-P1-024 API error recovery | P1 | Covered | `accessibility-quality.spec.ts` covers Dashboard current-reading retry, public source discovery recovery, neighbor refresh recovery, active-alerts retry, and Metric Detail history retry. | Keep as representative retry/error recovery smoke coverage. |

## Shared Test Data And Mocks

| Mock group | Endpoints/events |
|---|---|
| Auth shell | Auth0 authenticated state, user profile, access token |
| Settings | `GET/PUT /api/settings/preferences`, `GET/POST/DELETE /api/settings/credentials`, `GET/POST/PUT /api/settings/devices` |
| Dashboard | `GET /api/dashboard/current`, `/rainfall`, `/daily-extremes`, `/layout`, `PUT /api/dashboard/layout` |
| Realtime | SignalR-current-query cache behavior for mocked `ReadingUpdated` paths where feasible |
| Metrics history | `GET /api/metrics/{metricKey}/history` |
| Neighbors | `GET/PUT /api/neighbors/config`, `POST /api/neighbors/refresh`, `GET /api/neighbors/stations/current`, `GET /api/dashboard/current?source=neighbors` |
| Public sources | `GET/POST/PUT/DELETE /api/public-sources`, `GET /api/public-sources/discover`, `GET /api/public-sources/{id}/current` |
| Alerts | `GET /api/alerts/active` |

## P0 Critical Flows

### E2E-P0-001 — Authenticated Dashboard Shell Loads

Goal: A signed-in user lands on the dashboard shell with navigation and no error boundary.

Setup:
- Mock authenticated Auth0 state.
- Mock dashboard current, rainfall, layout, devices, preferences, public sources, pinned sources,
  and alerts with minimal valid data.

Steps:
- Navigate to `/`.
- Wait for dashboard ready state.
- Verify app shell navigation is visible.
- Verify no React error boundary is visible.

Expected:
- Dashboard page renders.
- Primary nav includes Dashboard and Settings.
- Current-data status/tiles render without credentials or key leakage.

Coverage: Implemented by dashboard smoke/current tests.

### E2E-P0-002 — Dashboard Current Data And Rainfall Render

Goal: The default dashboard shows current sensor values, station/source label, and rainfall summary.

Setup:
- Mock an owned station with selected dashboard metrics.
- Mock `/api/dashboard/current`, `/api/dashboard/rainfall`, `/api/dashboard/layout`,
  `/api/dashboard/daily-extremes`, and preferences.

Steps:
- Navigate to `/`.
- Verify temperature/humidity/pressure/wind or equivalent selected metric tiles render.
- Verify rainfall summary renders event/day/week/month/year values when available.
- Verify freshness/provenance text is present.

Expected:
- Values are formatted using user preferences.
- Null sensors show empty-state glyph/text, not zero.
- Rainfall tile respects rainfall units.

Coverage: Implemented by `dashboard.current.spec.ts`; add assertions as metrics expand.

### E2E-P0-003 — Settings Credential Save Does Not Expose Secrets

Goal: A user can enter Ambient API/application keys and receive saved status without seeing secrets.

Setup:
- Mock credential status as not saved initially.
- Mock `POST /api/settings/credentials` success and device auto-sync.
- Use runtime dummy key strings that are not real keys.

Steps:
- Navigate to `/settings`.
- Fill API key and application key.
- Save credentials.
- Wait for success/saved status.

Expected:
- Inputs clear or no longer expose entered values.
- Page text does not include the entered key values.
- Credential status updates to saved.
- Devices can populate from mocked sync.

Coverage: Implemented by `settings.smoke.spec.ts`.

### E2E-P0-004 — Settings Credential Delete Confirmation

Goal: Deleting credentials requires confirmation, can be cancelled, and updates saved status after confirm.

Setup:
- Mock credential status as saved.
- Mock delete endpoint only after confirm.

Steps:
- Navigate to `/settings`.
- Click delete credentials.
- Verify confirmation dialog appears.
- Cancel once and verify saved state remains.
- Reopen and confirm delete.

Expected:
- Dialog is labelled and keyboard reachable.
- No delete call occurs on cancel.
- One delete call occurs on confirm.
- Credential status changes to not configured.
- Secret values are never rendered.

Coverage: Implemented by `settings.smoke.spec.ts`.

### E2E-P0-005 — Route Round Trip To Metric Detail

Goal: Core navigation does not blank the app: Dashboard -> Settings -> Dashboard -> Metric Detail.

Setup:
- Mock dashboard with a clickable metric tile.
- Mock metric detail placeholder or Phase 12 history response depending on implementation stage.

Steps:
- Start at dashboard.
- Navigate to Settings.
- Navigate back to Dashboard.
- Activate a metric tile with click or keyboard.
- Verify `/metrics/{metricKey}` route loads.

Expected:
- No pre-mount navigation crash.
- Metric detail route displays the selected metric context.

Coverage: Implemented by `navigation.spec.ts` and `dashboard.current.spec.ts`.

### E2E-P0-006 — Custom Layout Fill Tile Saves And Restores

Goal: A user can switch to Custom layout, add a single-metric fill tile, save, and see it on the dashboard.

Setup:
- Mock devices with at least one owned source and current reading.
- Mock `GET /api/dashboard/layout` default, then `PUT /api/dashboard/layout` success with custom payload.

Steps:
- Navigate to Settings -> My Stations.
- Switch from Default to Custom.
- Add a metric block.
- Add one metric.
- Enable Fill tile.
- Save layout.
- Navigate to Dashboard.

Expected:
- Custom grid renders.
- Fill tile shows label and large formatted value.
- Saved layout survives route change.

Coverage: `custom-layout-builder.spec.ts` covers divider/block reorder plus named and
blank divider save/render.

## P1 Settings And Device Flows

### E2E-P1-001 — Preferences Save And Theme/Units Apply

Goal: A user can update units, date format, temperature decimals, daily-extrema timezone, and theme.

Setup:
- Mock preferences GET and PUT.
- Include dark and light theme validation paths.

Steps:
- Navigate to Settings.
- Change temperature, speed, pressure, rainfall, date format, temperature decimals,
  daily-extrema timezone, and theme.
- Save preferences.
- Return to Dashboard.

Expected:
- Save call includes all preference fields.
- Dashboard values reformat according to preferences.
- Light and dark theme controls and labels remain visible.

Coverage: Covered by `settings-preferences.spec.ts`, including PUT payload capture,
Dashboard temperature/date formatting, and dark theme application.

### E2E-P1-002 — Device Sync And Device Settings

Goal: A user can sync owned stations, rename a station, choose primary, toggle dashboard visibility,
and select/reorder metrics.

Setup:
- Mock saved credentials.
- Mock sync returning one or more generated stations.
- Mock device PUT calls.

Steps:
- Navigate to Settings.
- Refresh/sync device list.
- Edit nickname.
- Toggle dashboard visibility.
- Select primary station.
- Expand metric categories and change selected metrics/order.
- Save/update.
- Navigate to Dashboard.

Expected:
- Device row updates persist.
- Primary/dashboard controls are not shown for public read-only sources.
- Dashboard only shows visible stations and selected metric fields.

Coverage: Covered by `owned-device-settings.spec.ts` for sync, nickname, primary,
dashboard visibility, and metric selection. Category/field ordering and Dashboard order
are covered by `default-metric-ordering.spec.ts`.

### E2E-P1-003 — Runtime Mock Stations Preview

Goal: Local-only mock station names allow preview without real hardware.

Setup:
- Mock settings devices with a station named using the documented runtime mock trigger.

Steps:
- Navigate to Settings.
- Verify mock station appears.
- Navigate to Dashboard.

Expected:
- Mock readings render.
- Mock state remains local-only and does not imply Ambient sync.

Coverage: Implemented by `settings.smoke.spec.ts`; keep sanitized trigger values documented.

## P1 Dashboard Layout And Custom Builder Flows

### E2E-P1-004 — Default Metrics Category And Field Ordering

Goal: Settings Default tab category/field ordering controls dashboard order.

Setup:
- Mock owned station selected metric keys in a non-default order.
- Mock dashboard layout in Default mode.

Steps:
- Navigate to Settings -> My Stations -> Default.
- Move categories up/down.
- Move fields within a category.
- Attempt to navigate away before saving.
- Choose Save and verify the original navigation continues after save succeeds.
- Repeat with another edit and choose Discard, then verify the original navigation continues without
  sending the changed layout payload.
- Save.
- Navigate to Dashboard.

Expected:
- Dashboard group order follows saved category order.
- Field order inside tiles follows saved metric order.
- Unsaved layout edits prompt before route changes or dashboard navigation that would discard the
  changed layout.
- Save persists the pending layout change, closes the prompt, and continues the originally requested
  navigation.
- Discard drops the pending layout change, closes the prompt, and continues the originally requested
  navigation without a layout save request.
- Layout remains keyboard operable.

Coverage: Category/field move, save payload, and Dashboard order are covered by
`default-metric-ordering.spec.ts`; Save/Discard route-continuation prompts are covered by
`layout-unsaved-guard.spec.ts`.

### E2E-P1-005 — Custom Builder Divider And Keyboard Reorder

Goal: A user can create blocks/dividers and reorder them with keyboard-first controls.

Setup:
- Mock devices and layout save.

Steps:
- Open Custom builder.
- Add divider and metric block.
- Move items up/down.
- Save.
- Navigate to Dashboard.

Expected:
- Dashboard order matches builder order.
- Divider label/blank divider render correctly.
- No drag/drop is required.

Coverage: Implemented by `custom-layout-builder.spec.ts`.

### E2E-P1-006 — Header/Footer Tickers

Goal: A user can add ticker blocks and the dashboard renders scrolling weather/alert content with pause.

Setup:
- Mock current readings and active alerts.
- Mock custom layout with header/footer ticker items.

Steps:
- Add or load header ticker.
- Configure source labels and optional alert zone.
- Save.
- Navigate to Dashboard.
- Pause/resume ticker.

Expected:
- Ticker text includes configured fields and alert headlines when available.
- Pause control is keyboard reachable and meets target-size requirements.
- `prefers-reduced-motion` path initializes paused/static.

Coverage: `custom-layout-builder.spec.ts` covers header ticker, footer ticker, pause control,
alert content, public channel source, configured field text, configured NWS zone alert content,
and reduced-motion/static initialization.

### E2E-P1-007 — Custom Source Picker Includes Owned, Public, And Pinned Sources

Goal: Custom metric blocks can pull metrics from owned Ambient, saved public, and pinned neighbor sources.

Setup:
- Mock owned devices.
- Mock saved public sources with current readings.
- Mock neighbor config with pinned stations and current readings.

Steps:
- Open Custom builder.
- Add a metric block.
- Open source picker.
- Select one metric from each source kind.
- Save and view dashboard.

Expected:
- Picker labels distinguish owned, public, and pinned sources.
- Provider badges/provenance render.
- Unsupported provider metrics are not selectable.

Coverage: `custom-layout-builder.spec.ts` covers owned/public/pinned picker sources,
provider provenance, unsupported metric filtering, and saved metric references.

## P1 Neighbor And Public Source Flows

### E2E-P1-008 — Neighbor Config Save

Goal: A user enables neighbor comparison and saves radius, age, min station count, refresh interval,
and provider selection.

Setup:
- Mock `GET /api/neighbors/config` disabled by default.
- Capture `PUT /api/neighbors/config`.

Steps:
- Navigate to Settings.
- Expand Neighbors panel.
- Enable neighbors.
- Adjust numeric fields and provider checkboxes.
- Save.

Expected:
- PUT payload includes edited settings.
- Saved feedback is visible.
- Ambient Open provider checkbox respects feature availability.

Coverage: Implemented by `neighbors.spec.ts`.

### E2E-P1-009 — Neighbor Refresh Drawer And Pin

Goal: Refreshing neighbors shows discovered stations and allows pinning.

Setup:
- Mock enabled neighbor config.
- Mock refresh returning provider stations.
- Mock save config for pinned station.

Steps:
- Open Neighbors panel.
- Click Refresh now.
- Open station drawer.
- Pin a station.

Expected:
- Drawer has `role="dialog"`, focus management, Escape close.
- Station rows show provider, distance, freshness, and key values.
- Pin persists in config payload.

Coverage: Refresh drawer implemented; pin assertion should be added if missing.

### E2E-P1-010 — Dashboard Own/Neighbors Toggle

Goal: Default dashboard source toggle switches from owned station readings to neighbor aggregate readings.

Setup:
- Mock own current reading and neighbor aggregate reading.
- Mock neighbor config enabled.

Steps:
- Navigate to Dashboard.
- Verify Own Station selected by default.
- Click Neighbors.
- Verify neighbor provenance/aggregate values.
- Click Own Station.

Expected:
- Query changes to `source=neighbors`.
- Values/provenance update.
- 428/unavailable state is handled when neighbors are disabled or no stations exist.
- Custom dashboard layouts hide the neighbor source toggle and render configured custom items against
  owned, public, and pinned current readings.

Coverage: `neighbors.spec.ts` covers Default-layout neighbors provenance, return-to-own, and
428 unavailable state. Frontend unit coverage verifies Custom layouts hide the neighbor controls.

### E2E-P1-011 — Public Source Discovery And Add

Goal: A user can search by city/state or zip and add Weather.gov/Open-Meteo sources.

Setup:
- Mock `GET /api/public-sources/discover?q=` with Weather.gov and Open-Meteo candidates.
- Mock `POST /api/public-sources`.
- Use generated location query text, not real addresses or zip codes.

Steps:
- Navigate to Settings -> My Stations.
- Search public sources.
- Add a candidate.

Expected:
- Results show provider badge, label, and source identifier.
- Added source disappears or appears as saved in station list.
- Empty/error results are user-visible.

Coverage: Component coverage exists; E2E should be added.

### E2E-P1-012 — Public Source Row Management

Goal: Saved public sources appear in Default station list and can be edited.

Setup:
- Mock saved Weather.gov/Open-Meteo source.
- Mock PUT and DELETE.

Steps:
- Navigate to Settings -> My Stations -> Default.
- Verify provider badge.
- Toggle enabled/dashboard availability.
- Edit label.
- Expand supported metric pills and change selection.
- Delete source.

Expected:
- Public source has no primary radio.
- Supported metric pills are provider-filtered.
- PUT payload persists ordered selected metric keys.
- Delete removes the row.

Coverage: Covered by `public-sources.spec.ts` for saved row display, provider badge, enabled
toggle PUT, label edit, delete, supported metric pills, selected metric/order persistence, and
Open-Meteo variant.

### E2E-P1-013 — Public And Pinned Sources Render In Default Dashboard

Goal: Enabled public and pinned sources render like station groups in the Default dashboard.

Setup:
- Mock owned station, saved public sources, pinned stations, current readings, and metric selections.

Steps:
- Navigate to Dashboard.
- Verify owned group.
- Verify public source group with provider-prefixed name.
- Verify pinned station group with provider badge.

Expected:
- Public/pinned groups use provider-supported fields only.
- Disabled sources do not render.
- Missing source readings show empty/stale state, not error boundary.

Coverage: `dashboard.smoke.spec.ts` covers enabled public source group, disabled-source
suppression, public missing-reading state, and pinned not-in-cache guidance.
`neighbors.spec.ts` covers pinned source group rendering after pinning.

## P1 Alerts Flows

### E2E-P1-014 — Active Alert Banner And Ticker

Goal: Active Weather.gov alerts appear as dashboard banner and ticker content.

Setup:
- Mock `GET /api/alerts/active` with active alerts.
- Mock dashboard layout with ticker item where useful.

Steps:
- Navigate to Dashboard.
- Verify alert banner appears.
- Expand/collapse alert detail if supported.
- Verify ticker includes alert headline.

Expected:
- Severe/important alerts use appropriate alert/status semantics.
- Ticker `aria-live` remains off to avoid noisy announcements.

Coverage: Banner, expand/collapse, area, and ticker assertions are covered by `dashboard.smoke.spec.ts`
and `custom-layout-builder.spec.ts`.

### E2E-P1-015 — Alert Area Or Zone Selection

Goal: User can select station-area alerts or enter an NWS area/zone/state code for ticker/banner.

Setup:
- Mock default alert response and area-code response.

Steps:
- Open dashboard alert area selector.
- Choose station area.
- Enter/select area or zone code.
- Verify refetch.

Expected:
- Requests include selected `area` query when applicable.
- Invalid/empty area has clear feedback.

Coverage: Needs E2E coverage.

## P0/P1 Metric Detail And Chart Flows

### E2E-P0-007 — Click Tile To Metric Detail Loads Chart Shell

Goal: The primary drill-down journey works once Phase 12 chart UI lands.

Setup:
- Mock dashboard with clickable tile.
- Mock metric history success response for selected metric.

Steps:
- Navigate to Dashboard.
- Activate metric tile.
- Wait for Metric Detail page.

Expected:
- Route includes metric key.
- Page shows metric title, station/source context, selected range, loading/success state.
- Chart shell and data-table alternative render.

Coverage: Implemented by `dashboard.current.spec.ts`.

### E2E-P1-016 — Metric History Range And Granularity Controls

Goal: User can change range and granularity for a chart.

Setup:
- Mock different history responses by query params.

Steps:
- Open metric detail.
- Change range preset.
- Change granularity.
- Verify chart/data table update.

Expected:
- Requests include range/granularity.
- Empty and warning states are visible when response has no points or warnings.

Coverage: Planned for Phase 12.

### E2E-P1-017 — Specific Historical Date Mode

Goal: User can pick a specific date and view that day in station local timezone preference.

Setup:
- Mock preferences with local or UTC daily-extrema timezone.
- Mock `range=date&date=...`.

Steps:
- Open metric detail.
- Switch to date mode.
- Pick a generated date value.
- Verify chart/data table.

Expected:
- Query uses `range=date`.
- Visible date label respects date-format preference.
- Missing data shows a useful empty state.

Coverage: Planned for Phase 12.

### E2E-P1-018 — Removed: Chart Exports

Exports were removed from Phase 12 scope. Do not add CSV/PNG E2E coverage unless a future
phase reintroduces export functionality.

### E2E-P1-019 — Owned Device Comparison Overlay

Goal: A user can overlay multiple owned device series when supported.

Setup:
- Mock multiple dashboard-visible owned stations.
- Mock separate metric history responses by `deviceId`.

Steps:
- Open metric detail.
- Add comparison device.
- Verify the comparison history request includes the selected owned station `deviceId`.

Expected:
- Series legend/table updates.
- Missing sensor for one device shows partial/empty state without hiding all data.

Coverage: Covered by `metric-detail.spec.ts`, which selects a second owned station, verifies
the comparison history request carries that station's `deviceId`, and confirms the comparison
status/chart render. Removing a comparison device and partial-series empty-state variants remain
future hardening if comparison regressions appear.

### E2E-P1-020 — Neighbor/Public Source History Overlay Disabled State

Goal: Neighbor/public overlays remain disabled until provider history or cached samples exist.

Setup:
- Mock neighbor/public sources available but no history support.

Steps:
- Open metric detail.
- Inspect source/overlay controls.

Expected:
- Unsupported overlays are disabled with clear reason.
- No failing request is made for unsupported provider history.

Coverage: Planned for Phase 12.

## P1 Accessibility And Quality Flows

### E2E-P1-021 — Keyboard Walkthrough

Goal: Critical pages remain keyboard-operable.

Pages:
- Dashboard
- Settings
- Metric Detail
- Neighbor drawer
- Alert banner/ticker controls
- Custom layout builder

Expected:
- Logical tab order.
- No keyboard traps.
- Visible focus indicator.
- Enter/Space activates buttons and metric tiles.
- Escape closes dialogs/drawers.

Coverage: Covered by representative E2E cases in `accessibility-quality.spec.ts` for Dashboard
source toggles, theme menu open/Escape close, ticker pause/resume, Settings custom-layout builder
add controls, credentials confirmation Escape close, neighbor drawer Escape close, and Metric
Detail table controls.

### E2E-P1-022 — Axe Audits

Goal: Automated accessibility scan catches regressions.

Setup:
- Render stable mocked states for Dashboard, Settings, Metric Detail, and key dialogs.

Expected:
- Zero violations for the audited states.
- Known limitations recorded in `docs/ACCESSIBILITY.md`.

Coverage: Covered by `axe-audits.spec.ts` for Dashboard, Metric Detail, Settings, custom layout
builder, neighbor drawer, and delete dialog states. Page-level audits run by loading the existing
frontend `axe-core` dependency in Playwright, so no extra Playwright axe wrapper is required.

### E2E-P1-023 — Light/Dark Theme Visibility

Goal: UI remains readable in both themes.

Setup:
- Mock preferences or local theme state for light and dark.

Steps:
- Render Dashboard, Settings, and Metric Detail in both themes.
- Verify headings, labels, icon buttons, station/source headers, tiles, menus, and status text.

Expected:
- No overlapping text.
- Important controls remain visible.
- Theme toggle persists expected value.

Coverage: Covered by `accessibility-quality.spec.ts` for key Dashboard, Metric Detail chart
controls, Settings regions, and representative disabled, empty, and error states in dark/light
themes. Expand with focused cases when newly changed visual surfaces introduce new states.

## Security And Negative Flows

### E2E-P0-008 — Missing Credentials And Missing Station Prompts

Goal: Users without credentials or synced stations receive clear setup prompts, not 500s.

Setup:
- Mock credential status false or device list empty.
- Mock dashboard endpoints returning 428 where relevant.

Steps:
- Navigate to Dashboard.
- Navigate to Settings.

Expected:
- Dashboard prompts user to configure credentials/stations.
- Settings devices card shows no-credentials/no-devices state.
- No secret values or raw exception details are shown.

Coverage: Implemented by `settings.smoke.spec.ts` and `dashboard.current.spec.ts`.

### E2E-P1-024 — API Error Recovery

Goal: User-facing retry and error states work across major pages.

Setup:
- Mock one endpoint at a time with 400/401/404/428/429/503 as appropriate.

Scenarios:
- Dashboard current-reading error with retry.
- Metric history error with retry.
- Public source discovery error with a successful second search.
- Neighbor refresh error with a successful second refresh.
- Alerts transient failure with visible status and retry.

Expected:
- Errors use `role="alert"` where appropriate.
- Retry action refetches.
- No raw stack traces or credentials appear.

Coverage: Covered by representative E2E cases in `accessibility-quality.spec.ts` for Dashboard
current-reading retry, public source discovery recovery, neighbor refresh recovery, active-alerts
retry, and Metric Detail history retry.

## Highest-Value Next E2E Additions

1. Add focused provider-field assertions when new Weather.gov or Open-Meteo fields become
   first-class dashboard metrics.
2. Add more setup/error variants only when backend response semantics change or a regression appears.

## Test Suite Hardening Notes

- Keep route stubs in TS fixtures/mock builders. Specs should compose helpers instead of declaring
  ad hoc endpoint mocks inside each scenario.
- Keep all generated locations, coordinates, station IDs, and source IDs randomized or sanitized.
  Do not reintroduce concrete user-like test data.
- Keep direct URL navigation as route-regression coverage only. The primary P0 drill-down E2E is now
  dashboard metric value activation.

## Implementation Notes For Future Test Generation

- Keep P0 suite short: dashboard load/current data, credential save, route-to-detail, and one
  custom layout restore path.
- Keep provider-heavy flows P1 unless they become release-critical.
- Prefer TS fixtures for shared route mocks instead of duplicating endpoint stubs in each spec file.
- Use small TS flow helpers first, and add page objects only when a surface becomes too large:
  - Dashboard: source toggle, alert area selector, tile activation, ticker pause/resume.
  - Settings: neighbors panel, public source search, public/pinned row expansion, metric pills,
    layout mode switch, builder item controls.
  - Metric Detail: range/date/granularity controls, source/device overlays, chart assertions,
    data table.
- When new Phase 12 or later chart/provider UI lands, update this document with the covering spec
  file names or the explicit deferral target.
