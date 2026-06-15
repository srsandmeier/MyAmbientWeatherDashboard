# Phase 8 Completion Plan - Ambient History API And Redis Cache

Created: 2026-05-30
Status: Complete

## Purpose

Phase 8 turns the backend into the source of historical metric data for the React app. It
adds a user-facing metric history BFF endpoint backed by Ambient Weather history pages and
Redis/distributed cache, while keeping Ambient credentials server-side only.

Phase 8 also closes the remaining Phase 7 review gaps that affect history correctness:
repository-level station/default tests, primary/default repair coverage, and the decision on
credential-save + station auto-sync atomicity.

Phase 8 is not the realtime, dashboard tile, neighbor, or ECharts polish phase. Those stay
in later phases unless directly needed to validate the history API contract.

## Current State

Already complete before Phase 8:

- Auth0/JWT user identity and development/test auth bypasses.
- Encrypted Ambient credential storage and credential validation.
- Owned station sync from Ambient `GET /devices`.
- Settings page for credentials, preferences, and owned station/device settings.
- `AmbientRestClient.GetDeviceHistoryAsync` single-page primitive using `endDate` epoch ms.
- `RateLimitedApiClient` with per-key throttling, retry, and circuit breaker.
- Redis/distributed-cache registration.
- `DeviceHistoryService` legacy route with direct MAC history retrieval.

Known carry-in gaps from Phase 7 review:

- **Resolved and tested:** `WeatherStationRepository.SyncStationsAsync`
  now creates a default `UserPreferences` row when a fresh user syncs stations before visiting
  preferences.
- **Resolved and tested:** `PUT /api/settings/devices/{mac}` blocks demoting the only
  primary station.
- Real EF repository behavior for preserving user-managed station fields, seeding default
  station, updating primary/default, repairing missing primary state, and creating missing
  preferences during primary promotion is covered by repository-level tests.
- Credential save and station auto-sync are not atomic; if sync fails after credential save,
  devices may not be populated even though credentials persist.
- **Resolved in current code:** `dotnet format --verify-no-changes` now passes.
- **Resolved in current code:** Settings smoke tests now include `dateFormat` and assert all six
  preference selects.
- **Resolved in current code:** `CLAUDE.md` now maps `AmbientCredentialsRequiredException` to
  `428 Precondition Required`.
- **Resolved in docs:** Main plan and Phase 7 closeout now move repository invariant tests and
  credential-save auto-sync atomicity review into Phase 8 carry-in.

## Scope

In scope:

- Verify Phase 7 repository invariants needed by Phase 8 default-device history queries.
- Add repository-level tests for station sync and primary/default behavior.
- Add `AmbientHistoryService` that pages Ambient history by `endDate` + `limit=288`.
- Add `GET /api/metrics/{metricKey}/history`.
- Support preset ranges, custom `from`/`to`, and specific-date mode.
- Resolve default station from `UserPreferences.DefaultWeatherStationId`, falling back to
  primary owned station when needed.
- Support explicit `deviceId`/MAC selection for owned devices only.
- Validate metric keys, ranges, dates, granularity, and ownership.
- Cache Ambient history pages and optionally assembled response payloads in Redis/distributed cache.
- Return a chart-ready series response for frontend consumers.
- Add typed frontend API/types/query keys for history retrieval.
- Add tests for paging, trimming, rainfall aggregation, cache keys, ownership, and errors.
- Update docs and closeout checklists.

Out of scope:

- Live dashboard current/rainfall tiles - Phase 10.
- SignalR realtime fan-out - Phase 9.
- ECharts detail page and export UI - Phase 12.
- Neighbor history overlays - Phase 12 or later after provider support exists.
- Full shared metric registry across backend/frontend - Phase 10, though Phase 8 may add a
  small internal history metric map that Phase 10 will promote.
- Mandatory local PostgreSQL raw-reading storage - optional future optimization.

## API Shape

Add:

- `GET /api/metrics/{metricKey}/history`

Query parameters:

- `range`: `24h`, `7d`, `30d`, `90d`, `1y`, `custom`, or `date`.
- `from`: ISO date/time for `range=custom`.
- `to`: ISO date/time for `range=custom`.
- `date`: `YYYY-MM-DD` for `range=date`.
- `granularity`: `auto`, `raw`, `hour`, or `day`.
- `deviceId`: owned station MAC address. Optional; omit to use default/primary station.
- `source`: only `my` in Phase 8. `neighbors` is rejected with a clear 400/501-style
  application error until Phase 11/12.

Response draft:

```json
{
  "metricKey": "outdoor_temp",
  "deviceId": "{ownedDeviceId}",
  "deviceName": "{stationName}",
  "range": "date",
  "fromUtc": "2026-05-29T05:00:00Z",
  "toUtc": "2026-05-30T04:59:59Z",
  "granularity": "raw",
  "unit": "F",
  "points": [
    { "timestampUtc": "2026-05-29T12:00:00Z", "value": 72.4 }
  ],
  "warnings": []
}
```

Design notes:

- `date` mode uses the user's station timezone when available; until timezone support exists,
  use the app/user configured timezone or document UTC fallback explicitly.
- Returned values stay in canonical Ambient units for Phase 8 unless unit conversion helpers
  are pulled forward. UI display conversion remains Phase 10 if not needed earlier.
- Rainfall history uses `hourlyrainin` summed into buckets. Snapshot fields such as
  `dailyrainin`, `weeklyrainin`, `monthlyrainin`, and `yearlyrainin` remain tile/current
  values and are not used as chart bucket inputs.

## Cache Strategy

Cache levels:

- Ambient page cache:
  - Key shape: `history-page:{userHash}:{mac}:{endDateEpochMs}:{limit}`.
  - Stores the raw Ambient page DTO array.
  - TTL target: 15 minutes for recent pages, longer for pages older than 24 hours.
- Assembled response cache:
  - Key shape: `history-response:{userHash}:{mac}:{metricKey}:{rangeHash}:{granularity}`.
  - Stores the trimmed/aggregated response.
  - TTL target: short for recent ranges, longer for completed historical dates.

Rules:

- Include a user-scoped non-secret hash in cache keys; never use raw API keys or application keys.
- Include MAC, range/endDate, limit, metric key, granularity, and source in relevant keys.
- Cache misses still go through `RateLimitedApiClient`.
- Cache deserialization failures should evict the bad entry and refetch once.
- Cancellation tokens flow through cache, Ambient calls, and handlers.

## Implementation Checklist

### 0. Phase 7 Carry-In Fixes And Verification

- ✅ `WeatherStationRepository.SeedDefaultStationIfAbsentAsync` creates a `UserPreferences`
  row when missing, then sets `DefaultWeatherStationId`.
- ✅ Direct API demotion of the only primary station is blocked in
  `UpdateSettingsDeviceCommandHandler`.
- ✅ Decide whether to additionally reject all `isPrimary=false` requests in
  `UpdateSettingsDeviceCommandValidator` so clients can only promote another station.
  - Decision: keep patch semantics and allow `isPrimary=false` in the request model, but enforce
    the invariant in the handler/repository so a user cannot be left with zero primary stations.
- ✅ Ensure setting a primary station through `SaveAsync` creates or repairs
  `UserPreferences.DefaultWeatherStationId` even for legacy/bad data where preferences are absent.
- ✅ Add repository-level tests using a real EF provider for:
  - first sync creates user/stations/preferences default;
  - resync preserves nickname, dashboard visibility, selected metrics, and primary choice;
  - promoting another primary clears the old primary and updates default station;
  - missing primary state is repaired to one deterministic primary;
  - primary promotion creates preferences when legacy data has none.
- ✅ **Decision: credential save + station auto-sync are kept non-atomic.**
  - Rationale: The risk window (credentials saved, sync failed) is narrow and recoverable.
    The user can see the sync error in the UI and explicitly press "Sync devices" to retry.
    Making them atomic would require wrapping two separate stores behind a unit-of-work or
    two-phase commit, adding complexity for a rare edge case.
  - What happens on partial failure: credentials persist (correct), station list stays empty
    or stale (visible in Settings → Devices), and the `SyncSettingsDevicesCommand` handler
    already returns an error response that the frontend can surface as a toast warning.
  - No code change required. Documented here as an explicit decision record.
- ✅ Fix `SettingsSmokeTests.cs` formatting so `dotnet format --verify-no-changes` passes.
- ✅ Update settings smoke test mocks/assertions for `dateFormat`.
- ✅ Replace fixed Playwright waits with web-first assertions where practical.
- ✅ Fix `CLAUDE.md` exception mapping from `AmbientCredentialsRequiredException` to `428`.
- ✅ Update Phase 7 documentation wording so completed items and carry-forward fixes agree.

### 1. Contracts And Validation

- ✅ Add `MetricHistoryRequest`/query model for route + query params.
- ✅ Add `MetricHistoryResponseDto`, `MetricHistoryPointDto`, and optional warning DTO.
- ✅ Add `GetMetricHistoryQuery` MediatR record.
- ✅ Add `GetMetricHistoryQueryValidator`:
  - metric key is recognized;
  - range is recognized;
  - `custom` requires `from` and `to`;
  - `date` requires `date`;
  - `from < to`;
  - maximum range enforced for v1;
  - `deviceId`/MAC format validated when provided;
  - unsupported `source=neighbors` rejected clearly.
- ✅ Add a Phase 8 history metric map (`HistoryMetricMap`):
  - `outdoor_temp` -> `tempf`;
  - `indoor_temp` -> `tempinf`;
  - `outdoor_humidity` -> `humidity`;
  - `indoor_humidity` -> `humidityin`;
  - `pressure` -> `baromrelin`;
  - `uv_index` -> `uv`;
  - `solar_radiation` -> `solarradiation`;
  - `wind_speed` -> `windspeedmph`;
  - rainfall chart metrics -> `hourlyrainin` bucket sums.
- ✅ Document that the Phase 8 metric map is temporary until Phase 10 shared registry (comment in HistoryMetricMap.cs).

### 2. Station Resolution And Authorization

- ✅ Add `IUserStationStore.GetDefaultStationAsync` method to resolve the default/primary owned station.
- ✅ For omitted `deviceId`, choose `UserPreferences.DefaultWeatherStationId` when valid.
- ✅ If the default is missing/stale, repair it to the current primary station when possible.
- ✅ If no primary exists but owned stations exist, choose the first deterministic station and
  repair primary/default state.
- ✅ If no owned station exists, return a typed missing-station/settings error (428).
- ✅ For explicit `deviceId`, normalize MAC and verify ownership before calling Ambient.
- ✅ Never accept a MAC that belongs to another user (404 via `AmbientApiNotFoundException`).

### 3. Ambient History Service

- ✅ Add `IAmbientHistoryService` interface in Application layer.
- ✅ Implement `AmbientHistoryService` in Infrastructure.
- ✅ Page backward from requested `to` using `IAmbientRestClient.GetDeviceHistoryAsync`.
- ✅ Use `limit=288` for full-day 5-minute station history pages.
- ✅ Stop paging when:
  - requested `from` boundary is covered;
  - Ambient returns an empty page;
  - duplicate/oldest timestamp no longer moves backward;
  - dynamic max page guard for accepted 1-year/custom ranges is reached.
- ✅ De-duplicate points by `dateutc`.
- ✅ Sort ascending for API responses.
- ✅ Trim to requested `[from, to]` inclusive.
- ✅ Preserve nulls/missing values as skipped points; add warning when some nulls present.

### 4. Aggregation And Granularity

- ✅ Implement `raw`, `hour`, `day`, and `auto` granularity.
- ✅ `auto` rules: <= 48 hours: raw; <= 30 days: hourly; > 30 days: daily.
- ✅ Non-rain metrics aggregate with average in each bucket.
- ✅ Rainfall metrics aggregate by summing `hourlyrainin`.
- ✅ Empty or all-null metric data returns an empty series plus warning, not a 500.
- ✅ Unit tests cover aggregation boundaries.

### 5. Cache Integration

- ✅ Cache raw Ambient pages in distributed cache before trimming/aggregation.
- ✅ Key shape: `history-page:{userHash}:{mac}:{endDateEpochMs}:{limit}`.
- ✅ TTL: 15 min for recent pages (within 24h), 6h for older historical pages.
- ✅ Include user-scoped SHA-256 hash in cache keys; never raw API keys.
- ✅ Corrupt cache entries are evicted and refetched once.
- ✅ Unit tests cover cache-hit and cache-miss behavior.
- [>] Assembled response cache (optional optimization — deferred to Phase 10).
- [>] Cache invalidation on credential rotation — deferred; current strategy: TTL expiry.

### 6. Controller Surface

- ✅ Add `MetricsController` at `GET /api/metrics/{metricKey}/history`.
- ✅ `[Authorize]` + `[EnableRateLimiting("metric-history")]` at 30 requests/minute per user.
- ✅ Thin controller: bind route/query, send MediatR query, return DTO.
- ✅ XML comments and Swagger response types for all status codes.
- ✅ Domain exceptions mapped to HTTP codes via `GlobalExceptionHandlerMiddleware`:
  missing credentials -> 428; station not found -> 404; invalid metric/range -> 400;
  rate limit -> 429; circuit open -> 503.

### 7. Frontend API Foundation

- ✅ Add TypeScript types (`MetricHistoryResponse`, `MetricHistoryPoint`, `MetricHistoryParams`, etc.) in `frontend/src/types/metrics.ts`.
- ✅ Add `getMetricHistory` in `frontend/src/api/metrics.ts`.
- ✅ Add `queryKeys.metrics.history(metricKey, params)`.
- [>] Add `useMetricHistory` hook — deferred to Phase 12 chart UI (not needed by Phase 8 tests).
- ✅ Add API client tests for query string construction and bearer-token use.

### 8. Tests

- ✅ Backend unit tests:
  - query validator matrix (metric key, range, custom, date, deviceId, source, granularity);
  - pagination merge/de-dupe/stop conditions;
  - metric field extraction (outdoor_temp → tempf, rainfall → hourlyrainin);
  - rainfall sum aggregation vs non-rainfall average;
  - cache-hit skips Ambient call; cache-miss calls Ambient and stores page;
  - missing sensor warnings; empty page warning.
- ✅ Backend integration tests:
  - unauthorized request -> 401;
  - missing credentials -> 428;
  - invalid metric/range returns 400 (7 parameter variations).
- ✅ Backend integration tests:
  - no default/primary station -> 428;
  - explicit station must be owned by user -> 404;
  - mocked Ambient pages return correct trimmed series -> 200.
- ✅ Repository tests for Phase 7 carry-in invariants (station sync, primary/default).
- ✅ Frontend tests for typed API function (10 tests covering query string, bearer token, error codes).
- [>] E2E smoke tests remain limited to settings until Phase 9/10.

### 9. Documentation

- ✅ Update `docs/DEVELOPMENT_PLAN.md` Phase 8 section with the completed checklist.
- ✅ Update `README.md` for Phase 8 endpoints, feature status, commands, setup steps, and
  troubleshooting notes.
- ✅ Update `docs/API_REFERENCE.md` or add a history endpoint section with request/response examples.
- ✅ Update `docs/AMBIENT_HISTORY_API_RESEARCH.md` if implementation discoveries differ from research.
- ✅ Update `docs/PHASE_7_COMPLETION_PLAN.md` to mark carry-in fixes complete or explicitly moved.
- ✅ Update this Phase 8 plan before closeout so completed work, deferrals, and verification
  results are accurate.
- ✅ Keep deferred-work ledger accurate for Phases 9-12 and optional future work.

### 10. Verification

- ✅ `dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal`.
- ✅ `dotnet test backend/AmbientWeather.slnx`.
- ✅ `npm run lint:frontend`.
- ✅ `npm run test:frontend`.
- ✅ `npm run build --prefix frontend`.
- ✅ `git diff --check`.
- ✅ Automated Swagger/build coverage for `GET /api/metrics/{metricKey}/history`.

## Deferred Work Ledger

Already deferred items and their owners:

- Phase 3 SignalR client and React Router browser-flow hardening -> Phase 9.
- Phase 3 dashboard tiles/layout -> Phase 10.
- Phase 3 neighbor UI -> Phase 11.
- Phase 3 chart/detail UI -> Phase 12.
- Phase 4 full browser E2E activation -> Phase 9/10.
- Phase 4 OpenAPI snapshot/type contract -> Phase 12.
- Phase 5 Cloudflare R2/export asset work -> Phase 12 local CSV/PNG export; future remote persistence only if needed.
- Phase 6 `AmbientHistoryService` -> completed in Phase 8.
- Phase 6 `AmbientOpenApiClient` -> Phase 11.
- Phase 6 optional local raw-reading sync hardening -> optional future optimization.
- Phase 7 metric history/date/range retrieval and Redis history cache -> completed in Phase 8.
- Phase 7 realtime SignalR pipeline -> Phase 9.
- Phase 7 dashboard current/rainfall tiles and layout editor integration -> Phase 10.
- Phase 7 neighbor discovery/config UI -> Phase 11.
- Phase 7 full metric detail charts, chart exports, and OpenAPI contract snapshot -> Phase 12.
- Phase 7 repository invariant tests and default-station fixes -> completed in Phase 8.

## Gaps And Deferrals

Gaps closed in Phase 8:

- Phase 7 default/primary station invariant gaps.
- Phase 7 backend format failure.
- History endpoint contract and validation.
- Redis/distributed-cache behavior for history pages.
- Tests proving history paging/aggregation and station ownership.
- Multi-agent closeout findings: long-range paging budget, raw null-value skipping, corrupt
  cache eviction, 30/min metric-history rate limiting, safer Preferences fallback, and strict
  frontend `source='my'` typing.

Items that should remain deferred:

- Realtime current-data path: Phase 9.
- Dashboard tiles and layout: Phase 10.
- Nearby public station comparison: Phase 11.
- ECharts-rich metric detail page, exports, and OpenAPI snapshot: Phase 12.
- Local PostgreSQL weather-reading persistence: optional future optimization unless Redis +
  Ambient API paging proves insufficient.

## Completion Criteria

- ✅ Phase 7 carry-in review findings are fixed or explicitly reclassified with owner phase.
- ✅ A user with saved credentials and synced stations can request history for their default station.
- ✅ A user can request a specific historical date with `range=date&date=YYYY-MM-DD`.
- ✅ A user can request preset and custom ranges without exposing Ambient credentials.
- ✅ The service pages Ambient history safely under rate limits and trims to the requested range.
- ✅ Redis/distributed cache is used for history pages and tested.
- ✅ Rainfall history uses `hourlyrainin` bucket sums.
- ✅ Cross-user station access is rejected (404 via integration test).
- ✅ Missing credentials or missing station setup returns clear non-500 errors (428).
- ✅ Backend tests, frontend tests, lint, build, format, and whitespace checks pass.
