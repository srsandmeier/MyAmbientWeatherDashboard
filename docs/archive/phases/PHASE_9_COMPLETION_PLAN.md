# Phase 9 Completion Plan - Realtime Pipeline

Created: 2026-05-31
Status: Complete

## Purpose

Phase 9 adds the realtime path that keeps the browser current without exposing Ambient
Weather credentials or connecting the browser directly to Ambient Socket.IO.

The completed shape should be:

```text
Ambient rt2 Socket.IO
  -> RealtimeSubscriberService
  -> Redis pub/sub + latest-reading cache
  -> SignalR WeatherHub
  -> React useWeatherHub hook
```

Phase 9 also closes the earlier browser-flow deferrals that naturally belong with a real
authenticated, realtime frontend path.

## Current State

Already complete before Phase 9:

- Auth0/JWT user identity, test auth, and protected BFF endpoints.
- Encrypted Ambient credential storage and owned station sync.
- Settings UI for credentials, preferences, and station/device settings.
- Ambient REST client with rate limiting, retry, circuit breaker, and secret-safe error handling.
- Metric history BFF endpoint with Redis/distributed cache page storage.
- Frontend typed API foundation and query-key factory.
- Playwright C# project exists, but full browser E2E activation remains deferred.

Known carry-in gaps from Phase 8 and earlier:

- Phase 3 React Router pre-mount navigation concern still needs browser-flow re-evaluation once
  realtime/auth navigation is exercised end to end.
- Phase 4 real browser E2E activation still needs a CI-owned frontend server, mock-auth or
  Auth0-safe test strategy, trace/video artifacts, and P0/P1 job split.
- Phase 8 intentionally deferred dashboard tile UI, layout editing, and ECharts chart detail
  work. Phase 9 should only provide realtime data plumbing and a minimal current-reading BFF
  surface needed to validate that plumbing.
- Phase 8 assembled history-response cache and credential-rotation cache invalidation remain
  Phase 10+ optimizations, not Phase 9 blockers.
- Neighbor discovery/current data and neighbor historical charts remain Phase 11/12+.
- Local PostgreSQL weather-reading sync hardening remains optional future work unless Redis plus
  Ambient API paging proves insufficient.

## Scope

In scope:

- Add the approved realtime dependencies after checking license and maintenance status.
- Add a backend realtime subscriber that connects to Ambient `rt2.ambientweather.net` from the
  server only.
- Maintain per-user/per-station subscriptions without logging or exposing Ambient keys.
- Publish sanitized latest readings to Redis pub/sub channels and cache the latest reading with
  a short TTL.
- Add SignalR `WeatherHub` authenticated group fan-out by app user id.
- Add a minimal `GET /api/dashboard/current` BFF endpoint that reads latest cached realtime data
  and falls back to Ambient REST only through approved backend services.
- Add frontend SignalR client wiring and `useWeatherHub` hook that invalidates/updates TanStack
  Query state.
- Re-evaluate the React Router navigation concern under real browser routing.
- Activate at least a P0 browser E2E path that proves authenticated shell + realtime/current
  data plumbing using safe mocks.
- Update docs and closeout ledgers.

Out of scope:

- Full dashboard tiles, tile styling, rainfall summary tile, and layout editor - Phase 10.
- Shared metric registry and unit conversion UI - Phase 10.
- Neighbor provider abstraction and nearby station averaging - Phase 11.
- ECharts metric detail page, export controls, and OpenAPI snapshot/type contract - Phase 12.
- Mandatory local PostgreSQL raw-reading persistence - optional future optimization.

## Dependency And License Gate

- ✅ Check the license and maintenance status before adding any package.
- ✅ Expected backend candidate: `SocketIOClient` 4.0.4 MIT — added to Infrastructure.
- ✅ Expected browser candidate: `@microsoft/signalr` 10.0.0 (MIT) for SignalR client — Step 6.
- ✅ Redis pub/sub needs direct multiplexer access: added `StackExchange.Redis` 2.8.41 (MIT).
  `IDistributedCache` supports only key-value GET/SET/REMOVE; pub/sub requires `IConnectionMultiplexer`.
- ✅ Keep all additions within MIT, Apache 2.0, or BSD-3-Clause.

## Implementation Checklist

### 0. Phase 8 Carry-In And Design Gate ✅

- ✅ Confirm Phase 8 remains complete: 349 tests pass.
- ✅ Re-read `docs/API_REFERENCE.md` realtime notes and Ambient realtime docs/research.
- ✅ Decide the canonical realtime DTO shape: flat `CurrentReadingDto` with all sensor fields +
  station identity (`DeviceId`, `DeviceName`) + freshness metadata (`TimestampUtc`, `ReceivedAtUtc`).
  User identity: `userHash` (SHA-256 of subject). Group name: `user:{userHash}`.
- ✅ Document that `CurrentReadingDto` is intentionally broader than Phase 9 UI needs so Phase 10
  tiles can consume values directly without additional mapping.
- ✅ No EF model change needed for Phase 9. All new state lives in Redis.

### 1. Backend Realtime Contracts ✅

- ✅ Add Application-layer DTOs: `CurrentReadingDto`, `ReadingUpdatedEventDto`,
  `AmbientRealtimeDataDto`, `AmbientDataReceivedEventArgs`.
- ✅ Add `CurrentReadingMapper` with `FromWeatherReading` + `FromDeviceData` factory methods.
- ✅ Add interfaces: `IRealtimeSubscriptionRegistry`, `ILatestReadingCache`,
  `IRealtimeReadingPublisher`, `IRealtimeReadingSubscriber`, `IWeatherHubPusher`.
- ✅ Controllers stay thin; business logic lives in MediatR handlers.
- ✅ XML doc comments on all public C# members.

### 2. Ambient Socket.IO Subscriber ✅

- ✅ `RealtimeSubscriberService` implemented as `BackgroundService` in Infrastructure.
- ✅ Registered via `AddHostedService<RealtimeSubscriberService>()` in `Program.cs`.
- ✅ Connects to `rt2.ambientweather.net` server-side only via `AmbientSocketClientFactory`.
- ✅ Subscribes only for users with saved credentials and synced stations.
- ✅ `SubscriptionsChanged` event triggers clean refresh cycle; registry is invalidated when
  credentials are saved/deleted or stations are synced.
- ✅ Outer-loop bounded backoff (2 s → 5 min) on initialization failures; library manages
  per-connection reconnect with `ReconnectionAttempts = 10`.
- ✅ Data events routed through a bounded `Channel<AmbientRealtimeDataDto>` (capacity 1 000,
  drop-oldest) consumed by a lifecycle-aware loop — no fire-and-forget.
- ✅ API keys, application keys, and subjects never appear in log messages.
- ✅ Malformed Socket.IO frames are caught and logged; connection stays open.
- ✅ 12 unit tests: initialization, routing, unknown/empty MAC, publish failure, refresh.

### 3. Redis Pub/Sub And Latest Cache ✅

- ✅ Pub/sub channel: `ambient:readings:{userHash}` (no instance-name prefix).
- ✅ Latest-reading cache key: `latest-reading:{userHash}:{normalizedMac}`; 5-minute TTL.
- ✅ `ReceivedAtUtc` in `CurrentReadingDto` lets the UI distinguish stale from live.
- ✅ `LocalRealtimeReadingPublisher` (cache only) and `NullRealtimeReadingSubscriber` registered
  when Redis is not configured.
- ✅ Corrupt entries in `DistributedLatestReadingCache.GetAsync` return null, log a warning,
  and remove the bad cache entry immediately.
- ✅ 29 tests: cache get/set/remove/TTL/corrupt/failure, Redis publisher, local publisher,
  8 registry integration tests (Testcontainers).

### 4. SignalR Hub ✅

- ✅ `WeatherHub` at `/hubs/weather`, mapped in `Program.cs`.
- ✅ `[Authorize(Policy = "AuthenticatedUser")]` on the hub class.
- ✅ On connect: subject extracted from `Context.User`, hashed, added to `user:{userHash}` group;
  `IRealtimeReadingSubscriber.SubscribeAsync` called.
- ✅ `ReadingUpdated` fan-out: `IWeatherHubPusher` adapter decouples Infrastructure subscriber
  from the hub type; `WeatherHubPusher` forwards to `IHubContext<WeatherHub>`.
- ✅ Unauthenticated WebSocket upgrade returns 401 at the negotiate endpoint.
- ✅ Integration tests (7): 401 for no-auth, browser-style `access_token` query auth,
  connect succeeds, subscribe/unsubscribe called, `ReadingUpdated` delivered to correct group,
  cross-user isolation verified. Redis→SignalR end-to-end remains a Phase 10 Testcontainers
  integration test.

### 5. Minimal Current BFF Endpoint ✅

- ✅ `GET /api/dashboard/current` added at `DashboardController`.
- ✅ `GetCurrentReadingQueryHandler`: reads from `ILatestReadingCache` first.
- ✅ Falls back to `IAmbientRestClient.GetDevicesAsync` on cache miss; caches the result.
- ✅ Uses `IUserStationStore.GetDefaultStationAsync` from Phase 8 station resolution.
- ✅ 428 when credentials null; 428 when no default station; 401 from Ambient → GlobalExceptionHandler;
  429/503 from circuit breaker / rate limiter — all mapped by `GlobalExceptionHandlerMiddleware`.
- ✅ `CurrentReadingDto` is flat and reusable by Phase 10 tiles with no additional mapping.
- ✅ 7 unit tests (handler) + 5 integration tests (auth, 428, cache-hit 200, REST-fallback 200).
  Swagger `ProducesResponseType` attributes on all status codes.

### 6. Frontend SignalR Hook ✅

- ✅ `@microsoft/signalr` 10.0.0 (MIT) added and verified.
- ✅ `src/types/dashboard.ts`: `CurrentReadingDto` + `ReadingUpdatedEventDto` matching backend.
- ✅ `src/api/dashboard.ts`: `getDashboardCurrent` calling `GET /api/dashboard/current`.
- ✅ `queryKeys.dashboard.current()` added to centralized key factory.
- ✅ `useDashboardCurrent`: TanStack Query hook with 60 s `refetchInterval` REST fallback.
- ✅ `useWeatherHub`:
  - gets Auth0 access token via `getAccessToken` from `useAuth`;
  - connects to `/hubs/weather` using `accessTokenFactory`;
  - bounded exponential back-off up to 30 s via `withAutomaticReconnect`;
  - updates TanStack Query `dashboard.current` cache on every `ReadingUpdated` push;
  - calls `conn.off` and `conn.stop()` on unmount.
- ✅ 9 Vitest/RTL tests: connect/disconnect, query cache update, `start` called, handler
  cleanup, callback registration, and retry after initial `start()` failure. Reconnecting-state
  transition tests remain deferred to E2E because they need a real SignalR connection.
- ✅ Dashboard shell now mounts `useDashboardCurrent` and `useWeatherHub` so Phase 9 plumbing is
  exercised before Phase 10 tile UI work.
- ✅ Re-tested app navigation through dashboard/settings E2E smoke; no React Router pre-mount
  navigation regression observed.

### 7. Browser E2E Activation ✅

- ✅ Auth strategy: Playwright `RouteAsync` intercepts all Auth0 and BFF calls — RSA-signed
  JWT is generated in-process; no real tenant or backend is contacted.
- ✅ E2E tests run against `npm run dev` frontend only (backend NOT required per CLAUDE.md).
- ✅ P0/Smoke categories applied: dashboard tests are `[P0][Smoke]`; settings tests are `[Smoke]`.
- ✅ Trace recording enabled in `BaseTest.SetUp`: screenshots + snapshots captured per test.
  On failure: full-page screenshot + trace zip saved; on pass: trace stopped without writing.
- ✅ P0 smoke tests (5 new in `DashboardSmokeTests`):
  - authenticated shell loads (`data-test-id="dashboard-page"` visible);
  - navigation renders (`nav-dashboard-link` visible);
  - current-reading plumbing and placeholder tiles render;
  - no React error boundary triggered + zero JS errors;
  - settings route reachable from dashboard via nav link.
- ✅ All Ambient, Auth0, BFF, and SignalR calls mocked. SignalR negotiate returns 401 so
  `useWeatherHub` fails gracefully; real-time push e2e deferred to Phase 10 when tiles are wired.
- ✅ `DashboardSmokeTests.HomePage_ShowsTitle` `[Ignore]` stub removed and replaced with 5
  concrete tests.
- ✅ `SettingsSmokeTests` refactored to use `BaseTest.SetupMockRoutesAsync`; RSA JWT helper
  and auth route setup consolidated in `BaseTest` so all future fixtures inherit them.
- ✅ `/api/dashboard/current` added to the shared mock-route setup (ready for Phase 10 wiring).

### 8. Documentation ✅

- ✅ `README.md` updated: Phase 1-9 complete status, Phase 9 endpoint table (`GET /api/dashboard/current`,
  `GET /hubs/weather`), SignalR connection and hook notes, architecture diagram unchanged.
- ✅ `docs/DEVELOPMENT_PLAN.md` updated: Phase 9 section marked ✅ with final status and
  deferred-work items; status table updated; "remaining gaps" rewritten for Phase 10; deferred
  ledger updated; "last reviewed" date updated.
- ✅ `docs/API_REFERENCE.md` updated: `GET /api/dashboard/current` (response shape, error codes,
  cache behavior) and `GET /hubs/weather` (auth, group isolation, `ReadingUpdated` event, frontend
  hook reference) added.
- ✅ `docs/SECURITY.md` updated: Realtime pipeline section expanded with Phase 9 implementation
  — credential isolation, user-hash scoping, SignalR auth, latest-reading cache security.
- ✅ `docs/PHASE_8_COMPLETION_PLAN.md` — no Phase 8 deferrals were closed or retargeted; no
  update required.
- ✅ This Phase 9 plan updated with final checklist status before closeout.
- ✅ `.claude/settings.local.json` is explicitly ignored in `.gitignore`.

### 9. Verification And Closeout ✅

- ✅ `dotnet build backend/AmbientWeather.slnx --no-restore` → **Build succeeded.**
- ✅ `dotnet test backend/AmbientWeather.slnx --no-build` → **263 unit + 107 integration = 370 passed, 0 failed.**
- ✅ `dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal` → **No changes required.**
- ✅ `npm run lint` (frontend) → **0 errors, 0 warnings.**
- ✅ `npm run test` (frontend) → **18 files, 96 tests passed.**
- ✅ `npm run build` (frontend, tsc + Vite) → **Build succeeded, ✓ built in 3.92 s.**
- ✅ `dotnet test tests/AmbientWeather.E2E --configuration Release` → **10 passed, 0 failed**
  (5 dashboard P0 + 5 settings smoke). Page objects use explicit `[data-test-id="..."]`
  locators so the suite is not dependent on Playwright's custom test-id selector setting.
- ✅ `git diff --check` → **No trailing whitespace or line-ending issues.**
- ✅ **EF migrations check:** `dotnet ef migrations list` → 3 migrations applied (`InitialCreate`, `AddSchemaInvariants`, `AddDateFormatPreference`), **0 pending**. No model changes in Phase 9.

## Deferred Work Ledger

Items closed in Phase 9:

- ✅ Phase 3 SignalR client — `useWeatherHub` implemented.
- ✅ Phase 4 real browser E2E activation — P0 smoke tests with trace artifacts activated.
- ✅ Phase 7/8 realtime SignalR pipeline — fully implemented end-to-end.
- ✅ Phase 8 realtime current-data path — `GET /api/dashboard/current` implemented.

Items carried forward from Phase 9 to Phase 10+:

- Phase 9 PR review closeout gate — Phase 10 (all resolved):
  - ✅ duplicate/shared MAC realtime routing — routing table was already list-based from Phase 9 commits;
  - ✅ raw Auth0 subject-prefix logging — log message corrected to say "user hash prefix" (was misleadingly labelled "subject prefix" even though it logged a hash);
  - ✅ Redis subscriber queue-loop supervision — `ProcessQueueAsync` task now tracked per user hash; unexpected loop exit clears ref-count/queue/task so next `SubscribeAsync` resubscribes cleanly;
  - ✅ frontend/backend `CurrentReadingDto` parity — all missing fields (`dewPoint`, `dewPointIn`, `eventRainIn`, `totalRainIn`, `lastRain`, `tz`) were added in Phase 9 commits;
  - ✅ P0 settings credential-save E2E — `SettingsPage_CredentialsSave_ShowsSuccessAndDoesNotRenderSecrets` added in Phase 9 commits;
  - ✅ E2E page-object action cleanup — all test bodies use business-method POM actions (completed in Phase 9 commits).
- React Router pre-mount navigation concern — no regression found; formal test deferred to Phase 10.
- Redis→SignalR E2E push test (Testcontainers-Redis + real WebSocket) — Phase 10.
- `useWeatherHub` reconnecting-state transition test — real SignalR connection needed; Phase 10 E2E.
- Dashboard tiles consuming current-reading data visually — Phase 10. The Phase 9 dashboard shell
  already mounts `useDashboardCurrent` / `useWeatherHub`.
- CI-owned API+frontend server startup for Playwright runs — Phase 10.
- `GET /api/dashboard/current` assembled-response cache invalidation on credential rotation — no
  separate assembled cache exists yet; keep with Phase 10+ cache optimization work.

Carried from earlier phases (unchanged):

- Phase 3 dashboard tiles/layout → Phase 10.
- Phase 3 neighbor UI → Phase 11.
- Phase 3 chart/detail UI → Phase 12.
- Phase 4 OpenAPI snapshot/type contract → Phase 12.
- Phase 5 Cloudflare R2/export asset work → Phase 12 local CSV/PNG export; future remote persistence only if needed.
- Phase 6 `AmbientOpenApiClient` neighbor discovery → Phase 11.
- Phase 6 optional local raw-reading sync hardening → optional future optimization.
- Phase 8 assembled history-response cache → Phase 10 optional optimization.
- Phase 8 credential-rotation cache invalidation → Phase 10+ optional optimization.
- Phase 8 `useMetricHistory` hook → Phase 12 chart UI unless Phase 10 dashboard needs it first.
- Phase 8 nearby public station comparison → Phase 11.
- Phase 8 ECharts-rich metric detail page and exports → Phase 12.
- Historical neighbor charts → deferred until provider support or cached samples exist.

Items that should remain deferred:

- Dashboard product UI and layout editing.
- Shared metric registry promotion and unit conversion UI.
- Nearby public station discovery/averaging.
- Full metric chart detail, export, and OpenAPI contract snapshot.
- Local time-series persistence hardening.

## Completion Criteria

- ✅ Browser never connects directly to Ambient Socket.IO.
- ✅ Ambient credentials remain server-side and secret-safe in logs/errors.
- ✅ Realtime subscriber receives Ambient events and publishes sanitized user-scoped messages.
- ✅ Latest reading cache is populated with a 5-minute TTL and can serve `/api/dashboard/current`.
- ✅ SignalR `WeatherHub` authenticates users and fans out only to the correct user group.
- ✅ React `useWeatherHub` connects with a bearer token, updates/invalidates current-reading
  query data, and cleans up on unmount.
- ✅ Cross-user realtime isolation is covered by tests.
- ✅ At least one browser E2E path runs with safe mocks and produces traces/videos on failure.
- ✅ README, main development plan, API reference, security docs, and this plan are updated.
- ✅ Build, format, backend tests, frontend lint/tests/build, E2E smoke, whitespace check, and
  EF migration check all pass or have documented intentional exceptions.
