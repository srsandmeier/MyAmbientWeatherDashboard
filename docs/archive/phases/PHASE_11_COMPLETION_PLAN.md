# Phase 11 — Nearby Public Data & Averaging: Completion Plan

## Context

Phase 10 delivered a fully functional dashboard with live metric tiles, rainfall summary,
custom layout builder, and Settings-managed Default/Custom layout persistence. Phase 11 turns
that single-station dashboard into a comparative weather view by adding public neighbor station
discovery, aggregation, and a frontend toggle to switch the data source.

Phase 10 also left four explicit carry-ins that must be closed before Phase 11 product work
begins: CI-owned Playwright server startup, Redis→SignalR E2E, `useWeatherHub` reconnect tests,
and a full route-navigation regression test.

The neighbor feature is designed around three providers in priority order:
1. **Ambient Open API** (`lightning.ambientweather.net`) — undocumented, feature-flagged,
   disabled by default; real Postman testing confirms it works and returns 50 nearby stations.
2. **Weather.gov / NWS** — official U.S. observations; no key required; fallback for users
   without Ambient public-station coverage.
3. **Open-Meteo** — global model-based fallback; no key required.

Research lives in `docs/NEIGHBOR_DATA_RESEARCH.md`.

---

## Scope

### Section 0 — Phase 10 carry-in gate

Must close before Phase 11 product slices ship.

- ✅ CI-owned frontend dev server startup (`npm run dev`) in `.github/workflows/` for
  Playwright jobs — Vite must be live before E2E tests run; add health-check wait loop.
- ✅ CI-owned backend API server startup in the E2E job (or confirm `WebApplicationFactory`
  fixture is sufficient) so integration tests run in CI without external dependency.
  _Resolved: E2E tests are fully Playwright-mocked; `WebApplicationFactory` covers integration._
- ✅ Redis→SignalR E2E push test: Testcontainers-Redis + real SignalR WebSocket connection;
  assert that a published reading reaches the browser `ReadingUpdated` handler.
  _`WeatherHubRealtimePipelineTests` — publishes directly to Redis channel, asserts `ReadingUpdated` arrives._
- ✅ `useWeatherHub` reconnecting-state test: verify hook transitions
  `connecting → connected → reconnecting → connected` when the hub drops and reconnects.
  _Added `should transition connected → reconnecting → connected when hub reconnects` test._
- ✅ Route-navigation regression E2E: Dashboard → Settings → Dashboard → Metric tile
  traversal with no blank-page or pre-mount navigation errors.
  _`RouteNavigationTests.Navigation_RoundTrip_DashboardToSettingsToDashboardToMetricDetail`._

### Section 1 — EF Migrations / Database

- ✅ `NeighborConfig` value object stored as a JSON column on `UserPreferences`. Fields:
  `isEnabled`, `radiusMiles`, `maxAgeMinutes`, `minStations`, `enabledProviders[]`.
  _`NeighborConfigJson` (jsonb) on `user_preferences`. Property renamed from British spelling._
- ✅ `neighbor_station_cache` table entity: `Id`, `UserHash`, `Provider`, `SourceId`,
  `Name`, `Lat`, `Lon`, `DistanceMiles`, `LastObservedAtUtc`, `FreshnessMinutes`,
  `RawReadingJson` (text), `CachedAtUtc`.
  _`NeighborStationCache.cs` replaces old placeholder entity (previously FK-based, wrong schema)._
- ✅ EF migration: `AddNeighborSupport` — covers both schema changes.
  _Drops old `neighbour_station_cache`, renames config column, creates new table with correct schema._
- ✅ `.AsNoTracking()` on all read-only neighbor queries. _(Satisfied by `ExecuteDeleteAsync` + `AddRangeAsync` pattern in `NeighborDiscoveryService`; no tracking queries required.)_

### Section 2 — Provider Abstraction

- ✅ `INearbyWeatherProvider` interface in `Domain/Neighbors/`:
  `Task<IReadOnlyList<NeighborStation>> DiscoverAsync(NeighborConfig config, CancellationToken ct)`.
  `NeighborStation` carries: `Provider`, `SourceId`, `Name`, coordinates, `DistanceMiles`,
  current reading fields (matching `IAmbientSensorFields` subset), and freshness metadata.
- ✅ `AmbientOpenWeatherProvider` — `lightning.ambientweather.net` bounding-box discovery
  (`$publicBox` params per research doc); feature-flagged via
  `Features:AmbientOpenApiEnabled` (default `false`); disabled → returns empty list.
  Uses `AmbientRateLimitState` for 1 req/s. Computes `dewPoint`/`feelsLike` client-side
  when missing (matching `aioambient` behavior). Filters stations missing required fields.
- ✅ `WeatherGovNearbyObservationProvider` — `api.weather.gov` nearest active observation
  stations; maps NWS `observationStations` + latest observation to `NeighborStation`;
  returns empty list when user coordinates are outside the U.S. bounding box.
- ✅ `OpenMeteoNearbyBaselineProvider` — `api.open-meteo.com` current conditions at user
  coordinates; returns a single pseudo-station entry; global no-key fallback.
- ✅ Provider registration via `IServiceCollection` extension; ordered list injected into
  discovery service (Ambient first, NWS second, Open-Meteo third).

### Section 3 — Discovery Service & API

- ✅ `NeighborDiscoveryService` (`INeighborDiscoveryService`):
  - Calls all enabled providers in order; merges results.
  - Deduplicates by `(Provider, SourceId)`; filters stations older than `maxAgeMinutes`.
  - Haversine sorts by distance; takes top N (default 10, configurable).
  - Upserts to `neighbor_station_cache`.
  - Returns sorted list.
- ✅ Redis cache key `neighbor-list:{userHash}` with TTL = `config.refreshIntervalMinutes`
  (default 15 min); cache-aside pattern identical to `DistributedLatestReadingCache`.
  _Also added `RefreshIntervalMinutes` field to `NeighborConfig` (default 15, range 5–60)._
- ✅ `GET /api/neighbors/config` — reads `UserPreferences.NeighborConfig`; seeds default
  on first access.
- ✅ `PUT /api/neighbors/config` — FluentValidation; persists to `UserPreferences`.
- ✅ `POST /api/neighbors/refresh` — clears Redis cache entry and triggers re-discovery;
  returns updated station list; rate-limited to `credential-save` policy (strict).
- ✅ `NeighborsController` with `[EnableRateLimiting("per-user")]` class-level attribute;
  `/refresh` overrides with `credential-save`.
- ✅ `.AsNoTracking()` on all read-only neighbor queries. _(Section 1 deferred item — satisfied
  by `ExecuteDeleteAsync` + `AddRangeAsync` pattern in `NeighborDiscoveryService`; no tracking
  queries needed.)_

### Section 4 — Aggregation & Dashboard Integration

- ✅ `NeighborAggregationService`:
  - Mean aggregation per sensor field; null exclusion (missing sensor → skip, not zero).
  - Circular mean for wind direction (handles 0°/360° wrap-around correctly).
  - Returns `AggregatedNeighborReadingDto` with per-metric aggregate value, contributing
    station count, and `isBelowMinStations` warning flag.
- ✅ `source=neighbors` query parameter on `GET /api/dashboard/current`:
  - Returns aggregated neighbor reading when `source=neighbors` via `GetNeighborCurrentReadingQuery`.
  - Returns 428 (`neighbors-unavailable`) if feature is disabled, no coordinates, or no stations.
- ✅ Add `Source` field to `CurrentReadingDto` so the frontend can display provenance label
  (`"own"` | `"neighbors"`). Defaults to `"own"` for backward compatibility.

### Section 5 — Settings: Timezone Preference

- ✅ Add `DailyExtremaTimezone` field (`"utc"` | `"local"`) to `UserPreferences` entity and
  `UserPreferencesDto`. Default: `"local"` (station local; falls back to UTC when unknown).
  _Already implemented in pre-Phase-11 daily-high/low work._
- ✅ EF Core migration: `AddDailyExtremaTimezonePreference` (20260603214516).
  _Already applied._
- ✅ `GetDashboardDailyExtremaQueryHandler`: reads the preference and computes day boundaries
  in the station's IANA timezone when `"local"` is selected; falls back to UTC when unknown.
  _Already implemented with `ResolveDayUtc` helper._
- ✅ History `range=date` mode in `GetMetricHistoryQueryHandler`: applies the same timezone
  preference when resolving a `YYYY-MM-DD` date to UTC boundaries via `ResolveDateRangeUtc`.
  _Added `IUserPreferencesStore` dependency; extracted testable `ResolveDateRangeUtc` helper;
  updated `MetricsTestFactory` integration test fixture with preferences mock._
- ✅ `PreferencesCard` (Settings): timezone-mode select (`Station local time` / `UTC`) rendered
  below the date-format selector. `data-test-id="settings-preferences-timezone-select"`.
  _Already implemented._
- ✅ `PUT /api/settings/preferences` + `GET /api/settings/preferences` accept the new field.
  _Already implemented in `UpdateUserPreferencesCommand` + validator._
- ✅ Frontend `UserPreferencesDto` and `UpdatePreferencesRequest` include `dailyExtremaTimezone`.
  _Already implemented in `frontend/src/types/settings.ts`._

### Section 6 — Frontend (Neighbors) ✅

- ✅ `frontend/src/types/neighbors.ts` — `NeighborConfigDto`, `NeighborStationDto`,
  `AggregatedNeighborReadingDto` mirroring backend DTOs.
- ✅ `frontend/src/api/neighbors.ts` — `getNeighborsConfig()`, `putNeighborsConfig()`,
  `postNeighborsRefresh()`.
- ✅ `useNeighborsConfig()` — GET with stale-while-revalidate.
- ✅ `useSaveNeighborsConfig()` — PUT mutation; updates cache on success.
- ✅ `useNeighborsRefresh()` — POST mutation; invalidates neighbor config + dashboard
  current query keys on success.
- ✅ Dashboard neighbor toggle: `Own Station` / `Neighbors` segmented control in
  `DashboardPage`; passes `source` param to `useDashboardCurrent`. Own-station uses base
  key (SignalR-compatible); neighbors gets a distinct key to prevent cache collisions.
- ✅ `NeighborsConfigPanel` in Settings > My Stations > Public Sources:
  - Enable/disable toggle, optional City/State or ZIP discovery location, radius input (5–50 mi), max-age input, min-stations input,
    refresh-interval input, provider checkboxes (Ambient / Weather.gov / Open-Meteo).
  - "Refresh now" button → `useNeighborsRefresh`; shows "View N stations" link on success.
  - `data-test-id` on every interactive element.
- ✅ `NeighborsStationDrawer` — slide-out panel listing discovered stations: name, distance,
  provider badge, freshness, key metric values, and pin/unpin controls.
- ✅ WCAG: fieldset/legend for config form, drawer `role="dialog"` + `aria-modal`, focus loop,
  Escape to close.

### Section 7 — Tests ✅

- ✅ Backend unit:
  - `NeighborDiscoveryServiceTests` — cache hit/miss, provider call, dedup, freshness filter,
    cache invalidation.
  - `NeighborAggregationServiceTests` — mean aggregation, null sensor exclusion, circular wind mean,
    below-min flag, empty list.
  - `GetNeighborConfigQueryHandlerTests` — null/empty/stored/malformed JSON all covered.
  - `UpdateNeighborConfigCommandValidatorTests` — range checks on all fields, known/unknown providers,
    pinned station count/provider/source/label validation.
- ✅ Backend integration:
  - `NeighborsConfigApiTests` — 401 unauth; GET seeds defaults; PUT validates; 400 on bad input; 200 on valid.
  - `NeighborsRefreshApiTests` — 401 unauth; 200 empty when disabled; 200 station list when enabled.
  - `DashboardCurrentNeighborsApiTests` — 401 unauth; 428 when disabled; 428 when no coords; 200 aggregated.
- ✅ Frontend component:
  - `NeighborsConfigPanel.test.tsx` — renders, form fields, providers, save, saved feedback, error, refresh, pin save payload, axe.
  - `NeighborsStationDrawer.test.tsx` — open/closed, station list, empty state, close button, pin callback, focus loop, axe.
- ✅ E2E (CI-owned):
  - `NeighborsTests.cs` — config panel expand/save with PUT assertion; dashboard source toggle + provenance; refresh + drawer content.

### Section 8A — Public Source Stations In Layouts

Allows a user to add Weather.gov / NWS and/or Open-Meteo source locations as selectable
dashboard stations, distinct from the aggregated `Neighbors` source. These sources should be
available in both the Default layout and the Custom layout builder.

#### Product Behavior

- [x] Users can add one or more public source stations from Settings.
  - Weather.gov / NWS source: U.S. official observation station selected by location search,
    nearest-station lookup, or explicit station/zone identifier.
  - Open-Meteo source: global model-based location selected by lat/lon or location search.
- [x] Public source station display names use provider-prefixed labels:
  - `Weather.gov - <YourSelectedLocation>` for NWS sources.
  - `Open-Meteo - <YourSelectedLocation>` for Open-Meteo sources.
- [x] Public source stations appear alongside owned Ambient stations in Custom layout selection,
  with clear provider/source provenance.
- [x] Custom layout metric blocks can select fields from any owned Ambient station or any saved
  Weather.gov/Open-Meteo source station.
- [x] Public source stations are read-only data sources: no primary-station radio, no Ambient
  credential dependency, and no direct realtime SignalR connection.

#### Backend

- [x] Add a persisted user-owned public source station model.
  - Provider: `WeatherGov` or `OpenMeteo`.
  - User-facing location label.
  - Provider-specific source id (NWS station id/zone id or Open-Meteo coordinate key).
  - Latitude/longitude and optional timezone.
  - Enabled/disabled flag.
- [x] Add BFF endpoints for public source station management:
  - `GET /api/public-sources`
  - `POST /api/public-sources`
  - `PUT /api/public-sources/{id}`
  - `DELETE /api/public-sources/{id}`
- [x] Extend current-reading query support so a dashboard/custom metric can request a specific
  public source station by id and metric key.
- [x] Normalize supported Weather.gov/Open-Meteo fields into the shared metric registry where
  possible; unsupported fields must not appear in metric pickers.
- [x] Cache public source current readings with provider-appropriate TTLs and clear provenance.
- [x] Enforce user ownership for saved public source ids in source-current reads; Custom layout
  references and Default dashboard rendering only resolve saved user-scoped source ids.

#### Frontend

- [x] Add Settings UI for public source stations near Neighbors.
  - Add Weather.gov source.
  - Add Open-Meteo source.
  - Rename/disable/delete saved source.
  - Show provider badge and resolved location.
- [x] Update Default layout rendering so enabled saved public sources appear as read-only
  station-like groups with provider-prefixed names and provider-supported fields.
- [x] Update Custom layout metric picker so custom metric references can target either:
  - owned Ambient station ids, or
  - saved public source station ids.
- [x] Render provider/source labels anywhere a public-source metric appears on the dashboard.
- [x] Empty/error states:
  - unsupported provider field,
  - stale source reading,
  - source location no longer resolves,
  - Weather.gov unavailable outside the U.S.

#### Tests

- [x] Backend unit/integration tests for source CRUD validation, auth, and ownership.
- [x] Backend tests for provider field filtering, current-reading mapping, and ownership validation.
- [x] Frontend tests for source Settings UI, Custom layout metric picker source availability,
  provider labels, and source-specific current values.
- [x] E2E smoke: add a mocked Open-Meteo source and verify the dashboard renders the
  provider-prefixed station label and source-specific value.

### Section 8B — Public Weather Alerts

Adds NWS active-alerts for the user's station area: a backend polling endpoint, a dashboard
banner/ticker for active alerts, and configurable header/footer crawlers that scroll alert text.

#### Backend

- [x] `AlertsController` at `GET /api/alerts/active` — fetches NWS `GET /alerts/active` filtered
  by the bounding box around the user's primary station (`point={lat},{lon}` or
  `area={state}`); returns a list of `WeatherAlertDto`.
- [x] `WeatherAlertDto`: `id`, `event`, `headline`, `description`,
  `severity` (`Extreme`/`Severe`/`Moderate`/`Minor`/`Unknown`), `urgency`, `certainty`,
  `effectiveUtc`, `expiresUtc`, `areaDesc`.
- [x] `GetActiveAlertsQueryHandler` — calls `api.weather.gov/alerts/active` with
  `point={lat},{lon}` and `status=actual`; maps GeoJSON `features` array to `WeatherAlertDto`;
  returns empty list when coordinates are unavailable or outside the US bounding box. Uses
  the existing `WeatherGovRest` named `HttpClient`.
- [x] Distributed cache `alerts:{userHash}:{lat}:{lon}` with 2-minute TTL (alerts change fast; stale-while-revalidate
  acceptable). Cache-aside pattern same as `DistributedLatestReadingCache`.
- [x] `AlertsController` uses `[EnableRateLimiting("per-user")]`; no separate rate limit needed
  (2-min cache already throttles outbound NWS calls).

#### Frontend

- [x] `frontend/src/types/alerts.ts` — `WeatherAlertDto` interface.
- [x] `frontend/src/api/alerts.ts` — `getActiveAlerts()` typed BFF function.
- [x] `useActiveAlerts()` hook — TanStack Query, `staleTime: 2 * 60 * 1000`, polls every
  2 minutes via `refetchInterval`.
- [x] `AlertsBanner` component on the Dashboard: shown when `alerts.length > 0`; renders a
  collapsible banner (collapsed by default) with severity-coloured badge, event name, and
  headline. `data-test-id="dashboard-alerts-banner"`.
- [x] `AlertsTicker` component: active alert headlines are included in the existing header/footer
  ticker renderer.
  Used in **both** the custom dashboard header block and the custom dashboard footer block.
  - Header crawler: `data-test-id="dashboard-header-ticker"`.
  - Footer crawler: `data-test-id="dashboard-footer-ticker"`.
  - Scroll speed proportional to text length (auto). Pauses on hover.
  - Only rendered when at least one alert is active.
- [x] Custom dashboard header/footer ticker blocks: `header-ticker` and `footer-ticker` items
  are available in the layout builder and render active alert headlines alongside configured
  weather-field ticker text.
- [x] Area selector: a compact dropdown in the dashboard toolbar (next to the Own/Neighbors
  toggle) that lets the user choose which area's alerts to display — `Station area` (default,
  uses station lat/lon) or a free-form NWS zone/state code entered manually.
  `data-test-id="dashboard-alerts-area-selector"`.
- [x] WCAG: banner `role="alert"` or `role="status"` depending on severity; ticker `aria-live`
  off (too noisy); area selector labelled.

#### Tests

- [x] Backend unit/integration: `GetActiveAlertsQueryHandlerTests`, `WeatherGovAlertServiceTests`,
  `AlertsApiTests` — coordinates → alert list, missing/non-US coordinates → empty, NWS failure → empty,
  cache hit, and auth.
- [x] Frontend: dashboard alert banner, area selector, and ticker alert content covered by component tests.
- [x] E2E smoke: dashboard with mocked active alert renders banner and ticker.

### Section 8D — Layout & Ticker Enhancements

Four UX improvements building on the public-source and neighbor infrastructure from 8A–8B:

1. Pinned stations rendered identically to owned stations in the Default layout
2. Public source discovery by zipcode / city+state
3. Pinned station metrics usable as sources in Custom layout blocks
4. Ticker channel source selection and per-ticker NWS alerts zone

---

#### Feature 1 — Pinned stations look like owned stations in Default layout

- [x] `PinnedStationTileGroup.tsx`: heading upgraded to `text-base font-semibold text-foreground`
  (matches `dashboard-source-heading`); grid changed to `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
  (matches owned station groups); heading structure wrapped in the same `flex items-baseline gap-2`
  div; provider badge kept but styled as `text-muted-foreground`.
- [x] `DashboardPage.tsx`: pinned station groups moved inside the `tileGroups.length > 0` branch
  (rendered after owned/public groups); fallback view also shows pinned groups when `dataSource === 'own'`;
  separate `dashboard-pinned-stations` wrapper removed.

---

#### Feature 2 — Public source discovery by zipcode / city+state

##### Backend

- [x] `DiscoveredPublicSourceDto` — `Provider`, `SourceId`, `DisplayLabel`, `Latitude`, `Longitude`, `Timezone`.
- [x] `DiscoverPublicSourcesQuery` + `DiscoverPublicSourcesQueryHandler` — delegates to `IPublicSourceDiscoveryService`.
- [x] `IPublicSourceDiscoveryService` interface in `Application/Interfaces/`.
- [x] `PublicSourceDiscoveryService` (Infrastructure):
  - Step 1: Nominatim `GET /search?q={q}&format=json&limit=1&countrycodes=us` — geocodes to lat/lon.
  - Step 2: NWS `GET /points/{lat},{lon}` → `observationStations` URL (reuses `WeatherGovRest` client).
  - Step 3: NWS stations list → up to 5 `DiscoveredPublicSourceDto` with `Provider = "WeatherGov"`.
  - Appends one Open-Meteo entry keyed by `"{lat:F4},{lon:F4}"`.
  - Returns empty list gracefully on any NWS HTTP failure; outer try/catch suppresses all exceptions.
- [x] `"Nominatim"` named `HttpClient` registered in `DependencyInjection.AddNeighborProviders`:
  base `https://nominatim.openstreetmap.org`, 10 s timeout, `User-Agent` from `configuration["UserAgent"]`.
- [x] `IPublicSourceDiscoveryService` registered as `Scoped` in `DependencyInjection`.
- [x] `GET /api/public-sources/discover?q=` endpoint in `PublicSourcesController`:
  validates `q` is non-empty and ≤ 128 chars; returns 200 with list (may be empty).

##### Frontend

- [x] `DiscoveredPublicSourceDto` interface added to `frontend/src/types/publicSources.ts`.
- [x] `discoverPublicSources(q, token, signal)` function added to `frontend/src/api/publicSources.ts`.
- [x] `PublicSourceDiscoverySearch` component in `DevicesCard.tsx`:
  - Text input (`placeholder="Zipcode or City, State"`) + Search button.
  - `useQuery` with `enabled: false`; triggers on form submit (manual refetch via new `searchQuery` state).
  - Results list: each entry shows label, provider, station ID; "Add" button calls `createMutation` with
    pre-filled fields; added entries are dismissed from the list on success.
  - Error and empty-results states handled.
- [x] Manual form collapsed into a `<details>` / `<summary>` ("Add manually (advanced)") below the search.

##### Tests

- [x] Backend unit: `DiscoverPublicSourcesQueryHandlerTests` — mocked service, returns list.
- [x] Backend integration: `GET /api/public-sources/discover?q=` returns 200 list schema.
- [x] Frontend component: `PublicSourceDiscoverySearch` renders, submits, shows results, add dismisses.

---

#### Feature 3 — Pinned station metrics as sources in Custom layout

- [x] `sourceKind` union in `SettingsDeviceDto` extended: `'ambient' | 'public' | 'pinned'`.
- [x] `pinnedStationId(provider, sourceId)` helper in `types/neighbors.ts` → `"pinned:{provider}:{sourceId}"`.
- [x] `pinnedToDevice(pin)` helper in `types/neighbors.ts` → `SettingsDeviceDto` with
  `sourceKind: 'pinned'`, `macAddress: pinnedStationId(...)`, `selectedMetricKeys: null`.
- [x] `usePinnedStationsCurrentReadings(pins)` hook — `useQueries` one query per pin;
  keys `Map` by `pinnedStationId`; mirrors `usePublicSourceCurrentReadings` pattern.
- [x] `DashboardPage.tsx` — call `usePinnedStationsCurrentReadings`; pass `pinnedStationReadings`
  to `CustomDashboardRenderer`.
- [x] `DevicesCard.tsx` — extend `customLayoutSources` prop with `pinnedToDevice` entries;
  show `"(Pinned) {name}"` label in station picker.
- [x] `CustomLayoutBuilder.tsx` — `getPickerMetricKeys`: when `sourceKind === 'pinned'` return
  neighbor-safe outdoor metric set (same `NEIGHBOR_KEYS` used by `PinnedStationTileGroup`);
  show provider badge in device picker option.
- [x] `CustomDashboardRenderer.tsx` — add `pinnedStationReadings?: ReadonlyMap<string, CurrentReadingDto>`
  prop (default `new Map()`); resolve in metric lookup chain before public source readings;
  handle `stationId.startsWith('pinned:')` in `stationLabel()` helper.

##### Tests

- [x] `usePinnedStationsCurrentReadings.test.ts` — empty pins → empty map; populated pins → correct Map keys.
- [x] `CustomDashboardRenderer.test.tsx` — MetricRow resolves pinned station reading.
- [x] `CustomLayoutBuilder.test.tsx` — station picker shows pinned device with restricted metrics.

---

#### Feature 4 — Ticker channel source + NWS alerts zone ✅

- [x] `CustomTickerItem` extended with `channelStationId?` and `alertsZone?`.
- [x] Backend `CustomLayoutItemDto` extended with `ChannelStationId` and `AlertsZone` (no EF migration — JSON blob).
- [x] `CustomLayoutItemValidator.cs` — `ChannelStationId` ≤ 256 chars; `AlertsZone` ≤ 32 chars, uppercase alphanumeric + `/` only.
- [x] `TickerEditor` expandable panel in `CustomLayoutBuilder.tsx`: channel-source dropdown, sourceLabels checkboxes, alertsZone input.
- [x] `DashboardPage.tsx` — per-zone `useQueries`, `tickerAlertsMap`, passed to renderer.
- [x] `CustomDashboardRenderer.tsx` — channel reading resolution + per-zone alerts in `TickerTile`.

##### Tests

- [x] Backend unit: `CustomLayoutItemValidatorTests` (12 new unit tests).
- [x] Frontend: `CustomLayoutBuilder.test.tsx` — TickerEditor expand, channel dropdown, alertsZone save.
- [x] Frontend: `CustomDashboardRenderer.test.tsx` — channel reading + per-zone alert list.

---

### Section 8E — Public/Pinned Source Management In Default Settings

- [x] `ExternalSourceRow` component: provider badge, label edit, enabled toggle, delete, expand/collapse with supported metric checkbox pills.
- [x] `PinnedSourceRow` component: Pinned+provider badges, label, expand/collapse with supported metric checkbox pills, unpin button.
- [x] `ExternalMetricList` component: shows provider-supported metrics grouped by Temperature/Atmosphere/Wind/Sun & UV/Rainfall.
- [x] Public sources and pinned stations rendered in the Default tab station list alongside owned Ambient devices.
- [x] `PublicSourcesPanel` stripped of its source list (add/discover only); list moved to `ExternalSourceRow` instances.
- [x] Nearby station discovery and neighbor comparison settings consolidated into the same Public Sources settings area as saved public sources and pinned stations; saved City/State or ZIP discovery location supports users without owned station coordinates.
- [x] `PINNED_SOURCE_METRIC_KEYS` and `PUBLIC_SOURCE_METRIC_KEYS` filter metric display to provider-supported fields only (indoor-only keys excluded).
- [x] `handleUnpin` calls `useSaveNeighborsConfig.mutateAsync` to remove pin without full-page reload.
- [x] Per-source metric selection/persistence:
  - public sources persist ordered `selectedMetricKeys` in `public_weather_sources.selected_metric_keys_json`;
  - pinned stations persist ordered `selectedMetricKeys` in `NeighborConfigJson`;
  - Default Settings checkbox pills update the matching source and Default dashboard/pinned groups honor the selected fields.
- [x] Tests:
  - Backend: `PublicWeatherSourceHandlerTests`, `PublicWeatherSourceCommandValidatorTests`, `UpdateNeighborConfigCommandValidatorTests` cover selected metric persistence/validation.
  - Frontend: `DevicesCard.test.tsx` — external source rows, pinned rows, checkbox pills, visibility toggle, delete, unpin, and public/pinned metric persistence.
  - E2E: `PublicSourcesSettingsTests.cs` — 3 smoke tests: provider badge visible, enable toggle fires PUT, expand shows metric tags.

---

### Section 8C — Assembled Response Cache (conditional)

- [x] Repeatable local/integration benchmark added:
  - `DashboardCurrentNeighborsApiTests.GetCurrentNeighborsBenchmarkShouldStayBelowAssembledCacheThreshold`
    warms the authenticated `GET /api/dashboard/current?source=neighbors` route, then measures
    100 requests against a representative cached neighbor dataset.
  - Result on 2026-06-09: p50 1.63 ms, p95 2.70 ms.
- [x] Redis assembled-response cache is not needed for Phase 11 because measured p95 is well
  below the 200 ms threshold; leaving the endpoint uncached avoids invalidation complexity.
- [x] Phase 12+ production monitoring remains the re-evaluation trigger if deployed telemetry
  later shows p95 above 200 ms.

### Section 9 — Documentation Closeout ✅

- [x] Mark DEVELOPMENT_PLAN.md Phase 10 section as `✅ COMPLETED`.
- [x] Update Deferred Work Ledger for all Phase 11 completions.
- [x] Update README "Current phase status" to reflect completed Phase 11 work and the 8C cache decision.
- [x] `docs/API_REFERENCE.md` already covers all new endpoints (neighbors, public sources, alerts).
  Ticker channel/zone are layout JSON fields, not new BFF routes — no additional endpoint docs needed.
- [x] PHASE_11_COMPLETION_PLAN.md updated with final status for shipped sections and the completed 8C benchmark.

### Section 10 — Final Verification ✅

Completion-pass verification on 2026-06-09:
- `dotnet build backend/AmbientWeather.slnx --no-restore`: clean.
- `dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal`: clean.
- Focused backend unit tests: 56 passing across public-source selected metrics and neighbor-config validation.
- Focused backend integration tests: 23 passing across public sources, neighbor config, `source=neighbors`, and the 8C benchmark.
- 8C benchmark: 100 warmed requests, p50 1.63 ms, p95 2.70 ms.
- `npm run lint --prefix frontend`: zero warnings.
- Focused frontend Settings tests: 47 passing.
- `npm run build --prefix frontend`: clean.
- EF migration `20260609152254_AddPublicSourceMetricSelection` applied locally; `dotnet ef migrations list` shows it as the latest migration with no pending marker.
- `docker compose ps` remained blocked by local Docker config/pipe permissions, but EF successfully connected to PostgreSQL and applied/listed migrations.

```bash
dotnet build backend/AmbientWeather.slnx --no-restore
dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal
dotnet test backend/tests/AmbientWeather.UnitTests/AmbientWeather.UnitTests.csproj --no-build --filter "FullyQualifiedName~PublicWeatherSource|FullyQualifiedName~UpdateNeighborConfigCommandValidator"
dotnet test backend/tests/AmbientWeather.IntegrationTests/AmbientWeather.IntegrationTests.csproj --no-build --filter "FullyQualifiedName~PublicSourcesApiTests|FullyQualifiedName~NeighborsConfigApiTests|FullyQualifiedName~DashboardCurrentNeighborsApiTests"
npm run lint --prefix frontend
npm run test --prefix frontend -- src/components/settings/DevicesCard.test.tsx
npm run build --prefix frontend
dotnet ef database update \
  --project backend/src/AmbientWeather.Infrastructure \
  --startup-project backend/src/AmbientWeather.Api
dotnet ef migrations list \
  --project backend/src/AmbientWeather.Infrastructure \
  --startup-project backend/src/AmbientWeather.Api
```

---

## Deferred Work Ledger

### Items closed by Phase 11

- UTC vs local calendar-day preference for daily extrema and history date-range queries (deferred from daily-high/low pre-Phase-11 work)
- CI-owned frontend/API server startup for Playwright (from Phase 4/10)
- Redis→SignalR E2E push test and `useWeatherHub` reconnecting-state coverage (from Phase 9)
- Route-navigation regression E2E (from Phase 3/10)
- `AmbientOpenApiClient` neighbor discovery (from Phase 6)
- Neighbor config, discovery, averaging, and UI (core Phase 11 scope)

### Deferred Work Ledger Closeout

| Deferred item | Target phase |
|---|---|
| User-selected Weather.gov/Open-Meteo source stations in Default and Custom layouts | Phase 11 Sections 8A + 8E ✅ |
| Public weather alerts API, dashboard banner/ticker, and header/footer crawlers | Phase 11 Section 8B ✅ |
| Public source discovery by zipcode/city+state | Phase 11 Section 8D Feature 2 ✅ |
| Pinned stations as custom layout metric sources | Phase 11 Section 8D Feature 3 ✅ |
| Ticker channel source selection + per-ticker NWS alerts zone | Phase 11 Section 8D Feature 4 ✅ |
| Public/pinned source management in Default settings | Phase 11 Section 8E ✅ |
| Assembled response cache measurement and optional implementation | Phase 11 Section 8C ✅; cache not needed at p95 2.70 ms |
| Per-source public/pinned Default metric-key persistence | Phase 11 Section 8E ✅ |
| Open-Meteo extended metrics (weather condition, cloud cover, precipitation probability, sunrise/sunset, daily forecast values) | Phase 12+ provider-specific metric expansion |
| Historical neighbor charts | Phase 12+ decision gate; implement only if provider history or cached samples exist |
| `useMetricHistory` hook | Phase 12 chart UI |
| `/metrics/:metricKey` chart detail page, ECharts, exports | Phase 12 |
| OpenAPI snapshot ↔ TypeScript contract test | Phase 12 (DTOs not stable until then) |
| Penetration testing / DAST suite (OWASP ZAP or equivalent, plus documented manual checks) | Future security hardening phase |
| Cloudflare R2 / export assets | Future/deployment asset persistence; Phase 12 local CSV/PNG export only |
| NCEI/CDO historical station data | Future provider expansion |
| Local PostgreSQL raw-reading backfill/hardening | Optional future optimization |

---

## Key Files

### New files
| Path | Purpose |
|---|---|
| `backend/src/AmbientWeather.Domain/Neighbors/` | `INearbyWeatherProvider`, `NeighborStation`, `NeighborConfig` |
| `backend/src/AmbientWeather.Infrastructure/Neighbors/` | `AmbientOpenWeatherProvider`, `WeatherGovNearbyObservationProvider`, `OpenMeteoNearbyBaselineProvider`, `NeighborDiscoveryService`, `NeighborAggregationService` |
| `backend/src/AmbientWeather.Application/Features/Neighbors/` | Handlers + validators for config GET/PUT + refresh |
| `backend/src/AmbientWeather.Api/Controllers/NeighborsController.cs` | BFF endpoints |
| `backend/src/AmbientWeather.Infrastructure/Data/Migrations/` | `AddNeighborSupport` migration |
| `frontend/src/types/neighbors.ts` | DTO interfaces |
| `frontend/src/api/neighbors.ts` | Typed BFF functions |
| `frontend/src/hooks/useNeighborsConfig.ts` | GET hook |
| `frontend/src/hooks/useSaveNeighborsConfig.ts` | PUT mutation |
| `frontend/src/hooks/useNeighborsRefresh.ts` | POST mutation |
| `frontend/src/components/settings/NeighborsConfigPanel.tsx` | Settings accordion card |
| `frontend/src/components/neighbors/NeighborsStationDrawer.tsx` | Discovered-stations drawer |

### Modified files
| Path | Change |
|---|---|
| `docs/DEVELOPMENT_PLAN.md` | Data model, Phase 11 checklist, deferred ledger updated |
| `docs/PHASE_10_COMPLETION_PLAN.md` | Deferred ledger: mark carry-ins closed in Phase 11 |
| `docs/API_REFERENCE.md` | New endpoints + `source` param on dashboard/current (Section 9) |
| `README.md` | Phase 11 features + endpoints (Section 9) |
| `backend/src/.../Data/AmbientWeatherDbContext.cs` | `NeighborStationCache` DbSet; `NeighborConfigJson` column config |
| `backend/src/.../Data/Entities/UserPreferences.cs` | `NeighborConfigJson`, `DailyExtremaTimezone` columns |
| `backend/src/.../Features/Metrics/Queries/GetMetricHistoryQueryHandler.cs` | `IUserPreferencesStore` dependency; `ResolveDateRangeUtc` timezone support |
| `backend/tests/.../MetricHistoryApiTests.cs` | `MetricsTestFactory` — added `IUserPreferencesStore` mock |
| `backend/src/.../Controllers/DashboardController.cs` | `?source` param on `GetCurrent` |
| `backend/src/.../Controllers/NeighborsController.cs` | New controller (Section 3) |
| `frontend/src/components/dashboard/DashboardToolbar.tsx` | Add Own / Neighbors toggle (Section 6) |
| `frontend/src/hooks/useDashboardCurrent.ts` | Accept optional `source` param (Section 6) |
| `frontend/src/api/dashboard.ts` | Pass `source` query param (Section 6) |
| `frontend/src/components/settings/PreferencesCard.tsx` | Timezone select added (pre-Phase-11) |
| `frontend/src/types/settings.ts` | `dailyExtremaTimezone` in `UserPreferencesDto` (pre-Phase-11) |
| `.github/workflows/ci.yml` | `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var; Vite startup wait loop |

---

## Patterns to Reuse

| Need | Existing pattern |
|---|---|
| Provider interface + DI ordering | `IAmbientRestClient` / `RateLimitedApiClient` in `Infrastructure/Ambient/` |
| Redis cache-aside | `DistributedLatestReadingCache` in `Infrastructure/Services/` |
| Feature flag | `DevAuthBypass` in `appsettings.Development.json` |
| MediatR handler + FluentValidation | `SaveDashboardLayoutCommandHandler` |
| TanStack Query hooks | `useDashboardLayout` / `useSaveDashboardLayout` |
| Settings accordion card | `DevicesCard` / `PreferencesCard` in Phase 10 Settings page |
| Authenticated subject | `ICurrentUserService.RequireAuthenticatedUser()` at top of every handler |
| Infrastructure JSON | `AmbientJsonOptions.Default` for all deserialization |
| Rate limit attribute | `[EnableRateLimiting("per-user")]` at controller level |
