# Phase 7 Completion Plan - Security, Credentials, Devices, And Settings UI

Created: 2026-05-30
Status: Complete

## Purpose

Phase 7 closes the user settings loop. After this phase, an authenticated user can manage
Ambient credentials, display preferences, owned stations/devices, default station, dashboard
visibility, and per-device metric selections from the React settings page without exposing
Ambient key material to the browser.

Phase 7 is not a dashboard, history, realtime, charting, or neighbor phase. Those remain in
later phases.

## Current State

Already complete before Phase 7:

- Auth0 JWT backend/frontend foundation.
- `GET/POST/DELETE /api/settings/credentials`.
- `GET/PUT /api/settings/preferences` for unit and theme preferences.
- Encrypted credential storage with Data Protection.
- Ambient credential validation through backend-only Ambient REST calls.
- Integration tests for credential save/delete/status, invalid key handling, user isolation,
  and redaction.
- `WeatherStation` schema fields for nickname, default/primary, dashboard visibility, and
  selected metric keys.

Still missing:

- React settings forms.
- Typed frontend settings API functions and TanStack Query hooks.
- User-owned station/device API surface.
- Station metadata sync from Ambient `GET /devices` after credentials are saved.
- Validation and persistence of default station, nickname, dashboard visibility, and selected
  metric keys.
- Cleanup of the obsolete `ApplicationKeyAuthMiddleware` class/comment retained from earlier
  phases.

## Scope

In scope:

- Complete settings frontend UI for credentials and preferences.
- Add settings-device backend/application surface for owned Ambient stations.
- Sync owned station metadata through `IAmbientRestClient.GetDevicesAsync`.
- Preserve user-controlled station settings across resyncs.
- Add validators, DTOs, MediatR handlers, store/repository methods, and tests.
- Remove stale application-key middleware code and comments.
- Update docs/tests to reflect Phase 7 completion.

Out of scope:

- Metric history endpoint and Redis history page assembly - Phase 8.
- Realtime Socket.IO/Redis/SignalR pipeline - Phase 9.
- Dashboard current/rainfall tiles and layout editor - Phase 10.
- Nearby public station discovery/averaging - Phase 11.
- ECharts metric detail pages, chart exports, and OpenAPI snapshot test - Phase 12.
- Historical neighbor charts - deferred until provider support or cached samples exist.
- Local PostgreSQL raw-reading sync hardening - optional future optimization unless Ambient API
  plus Redis cache proves insufficient.

## Gap Assessment

### Phase 3 Gaps

- Full Settings forms are still relevant and move into Phase 7.
- SignalR client remains Phase 9.
- Dashboard tiles/layout remain Phase 10.
- Neighbor UI remains Phase 11.
- Charts remain Phase 12.
- The React Router pre-mount navigation concern from Phase 3 remains deferred to Phase 9, where
  browser E2E and realtime/auth flows will be activated.

### Earlier Deferred Items

- Phase 4 real browser E2E activation remains Phase 9/10.
- Phase 4 OpenAPI snapshot/type contract remains Phase 12, after product DTOs stabilize.
- Phase 5 Cloudflare R2/export asset work is re-scoped: Phase 12 owns local CSV/PNG export, while R2 remote persistence remains future deployment work.
- Phase 6 `AmbientHistoryService` remains Phase 8.
- Phase 6 `AmbientOpenApiClient` remains Phase 11.
- Phase 6 optional local raw-reading sync remains optional future work.

No earlier deferred item needs to be implemented in Phase 7 unless it directly supports settings
or owned station configuration.

## API Shape

Keep existing endpoints:

- `GET /api/settings/credentials`
- `POST /api/settings/credentials`
- `DELETE /api/settings/credentials`
- `GET /api/settings/preferences`
- `PUT /api/settings/preferences`

Add Phase 7 endpoints:

- `GET /api/settings/devices`
  - Returns user-owned stations known to the app.
  - Never returns Ambient credentials.
- `POST /api/settings/devices/sync`
  - Requires saved Ambient credentials.
  - Calls Ambient `GET /devices` through `IAmbientRestClient`.
  - Upserts owned `weather_stations` rows for the authenticated user.
  - Preserves nickname, dashboard visibility, selected metric keys, and user-selected primary
    station when possible.
  - **Also triggered automatically on successful `POST /api/settings/credentials`**: the
    `GetDevicesAsync` validation call already fetches the device list; discarding it would
    require a second Ambient call. `SaveAmbientCredentialsCommandHandler` should capture the
    validated device list and call the same sync logic so the user's devices are populated
    immediately without requiring a separate "Sync" click.
- `PUT /api/settings/devices/{stationId}`
  - Updates nickname, dashboard visibility, primary/default station flag, and selected metric keys.
  - Rejects cross-user station access with 404.

Defer device registry UI integration with dashboard layout until Phase 10.

## Data Rules

- `WeatherStation.UserId` must be the authenticated user's app user id for owned stations.
- MAC addresses are normalized through `MacAddressValidator.Normalize`.
- Ambient device names/coordinates/elevation are provider metadata and may be refreshed.
- User-managed fields are not overwritten by sync:
  - `Nickname`
  - `DisplayOnDashboard`
  - `SelectedMetricKeysJson`
  - `IsPrimary`, except when no primary exists and a default must be seeded.
- `UserPreferences.DefaultWeatherStationId` must point to a station owned by the same user.
- Only one primary/default station per user remains enforced by the existing filtered unique
  index.
- Selected metric keys must come from the shared metric registry once available. Until the full
  registry lands in Phase 10, Phase 7 should use a small centralized allowed-key list and mark it
  as temporary in code/docs. Phase 7 allowed keys (matches the metric catalog in
  `DEVELOPMENT_PLAN.md`):
  `outdoor_temp`, `indoor_temp`, `outdoor_humidity`, `indoor_humidity`, `pressure`,
  `uv_index`, `solar_radiation`, `wind_speed`, `rainfall_event`, `rainfall_day`,
  `rainfall_week`, `rainfall_month`, `rainfall_year`.

## Implementation Checklist

### 1. Backend Cleanup

- ✅ Delete obsolete `ApplicationKeyAuthMiddleware` — file deleted; was already removed from the pipeline.
- ✅ Remove stale Phase 7 comments in `Program.cs` and `HistorySyncWorkerOptions.cs`.
- ✅ Swagger and integration tests describe JWT-only protected APIs — confirmed by existing tests.
- ✅ `/api/v1/devices/{mac}/history` remains JWT-protected until Phase 8.

### 2. Application DTOs And Contracts

- ✅ `SettingsDeviceDto` — MacAddress, Name, Nickname, IsPrimary, DisplayOnDashboard, SelectedMetricKeys, LastSyncAtUtc.
  - **Design note:** Station UUID and lat/lon/elevation omitted from Phase 7 DTO. Dashboard layout will reference these via MAC in Phase 10; add fields then if needed. `PUT` routes use MAC (not station ID) as the URL identifier — MAC is stable, visible to users, and avoids leaking internal UUIDs.
- ✅ `UpdateSettingsDeviceRequest` controller model + `UpdateSettingsDeviceCommand` MediatR record.
- ✅ `SyncSettingsDevicesCommand` returns `IReadOnlyList<SettingsDeviceDto>` (device list conveys count implicitly).
- ✅ No endpoint returns `apiKey`, `applicationKey`, or decrypted values — confirmed by existing credential tests.
- ✅ Frontend TypeScript types in `frontend/src/types/settings.ts`.

### 3. Store/Repository Layer

- ✅ `IUserStationStore` interface in `Application/Interfaces/`.
- ✅ `WeatherStationRepository` in `Infrastructure/Repositories/`.
- ✅ `.AsNoTracking()` on `GetOwnedStationsAsync`.
- ✅ Upsert by `(UserId, MacAddress)` — provider metadata refreshed; user-managed fields preserved.
- ✅ `UserPreferences.DefaultWeatherStationId` seeded on first sync and updated when primary station changes via `SaveAsync` and `SeedDefaultStationIfAbsentAsync`.
  - Post-review note: current code creates the preferences row when first sync happens before
    `GET /preferences`; Phase 8 must add repository-level tests to lock this invariant.
- ✅ 404 returned for stations not owned by the current user.
- ✅ Transaction safety: EF Core's `SaveChangesAsync` is transactional within each unit of work. `ExecuteUpdateAsync` uses separate DB commands (no multi-table distributed transaction needed for Phase 7).

### 4. MediatR Handlers And Validators

- ✅ `GetSettingsDevicesQuery` + handler.
- ✅ `SyncSettingsDevicesCommand` + handler.
- ✅ `UpdateSettingsDeviceCommand` + handler.
- ✅ `UpdateSettingsDeviceCommandValidator` — nickname ≤128 chars, ≤20 metric keys, each ≤64 chars, from allowed list.
- ✅ `UpdateSettingsDeviceCommandHandler` blocks demoting the only primary station.
- ✅ Every handler calls `ICurrentUserService.RequireAuthenticatedUser()`.
- ✅ Missing credentials → `AmbientCredentialsRequiredException` → 428.
- ✅ All Ambient calls through `IAmbientRestClient`.

### 5. Controller Surface

- ✅ `GET /api/settings/devices`, `POST /api/settings/devices/sync`, `PUT /api/settings/devices/{mac}` added to `SettingsController`.
- ✅ Controllers thin — construct commands/queries and delegate to MediatR.
- ✅ XML docs and Swagger `ProducesResponseType` annotations on all three routes.
- ✅ `[Authorize]` inherited from controller; `[EnableRateLimiting("per-user")]` inherited.
- ✅ Ambient auth failure on sync → 400 `ambient-credentials-invalid` (no key material in response).

### 6. Frontend API And Hooks

- ✅ Typed API functions in `frontend/src/api/settings.ts`: `getCredentialStatus`, `saveCredentials`, `deleteCredentials`, `getPreferences`, `updatePreferences`, `getDevices`, `syncDevices`, `updateDevice`.
- ✅ Centralized query keys: `queryKeys.settings.credentialsStatus()`, `queryKeys.settings.preferences()`, `queryKeys.settings.devices()`.
- ✅ TanStack Query mutations invalidate dependent queries on success.
- ✅ Form state cleared on successful save; no key values held after submit.
- ✅ API errors surfaced as user-visible messages — no secrets in error text.

### 7. Settings Page UI

- ✅ `SettingsPage` replaces placeholder with `CredentialsCard`, `PreferencesCard`, `DevicesCard`.
- ✅ `CredentialsCard`: saved/not-saved status; API key + application key inputs; save with loading state; **confirmation dialog before delete** (`settings-credentials-confirm-delete`, `settings-credentials-confirm-delete-button`, `settings-credentials-cancel-delete-button`); error message on 400 (no key echo).
- ✅ `PreferencesCard`: temperature, speed, pressure, rainfall unit selects; theme select **wired to `ThemeProvider.setTheme`** so the active theme updates immediately on save.
- ✅ `DevicesCard`: sync button with **sync failure error** (`settings-devices-sync-error`); device rows with nickname input, primary radio, visibility toggle, metric checkboxes; empty states for no-credentials, no-devices-synced.
- ✅ All interactive/dynamic elements carry `data-test-id` per the spec.
- ✅ `jest-axe` zero violations on all three card components.

### 8. Tests

- ✅ `UpdateSettingsDeviceCommandValidatorTests` — 12 unit tests covering MAC format, nickname length, metric key count, unrecognised keys, key length, null handling.
- ✅ `SaveAmbientCredentialsCommandHandlerTests` updated for new `IUserStationStore` parameter.
- ✅ `SettingsDevicesApiTests` — 12 integration tests: auth enforcement, empty list, mapped stations, user isolation (GET and PUT), 428 on missing credentials, 400 on Ambient auth failure, 400 on invalid MAC/bad nickname/unrecognised key, 404 on unknown MAC, 204 + save call on happy path.
- ✅ Frontend: 8 `CredentialsCard` tests, 4 `PreferencesCard` tests, 8 `DevicesCard` tests — all with axe assertions.
- **Completed in Phase 8 carry-in:** Repository-level EF tests for "sync preserves user-managed
  fields", "first sync creates default preferences", "updating primary station changes
  `DefaultWeatherStationId`", repairing missing primary state, and creating missing preferences
  during primary promotion.

### 9. Documentation

- ✅ `docs/DEVELOPMENT_PLAN.md` Phase 7 marked ✅ COMPLETED with full itemised checklist.
- ✅ `README.md` — no new env vars or commands added; no update needed.
- ✅ `docs/SECURITY.md` — new device routes follow the same JWT + per-user auth model; existing security guidance covers them without change.
- ✅ Deferred-work ledger accurate for Phases 8-12.
- ✅ LF line endings enforced by `.editorconfig` + `.gitattributes`.

### 10. Verification

- ✅ `dotnet test backend/AmbientWeather.slnx --configuration Release` — 172 unit + 63 integration, all pass.
- ✅ `dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal` — no diff, no analyzer warnings.
- ✅ `npm run lint:frontend` — zero errors, zero warnings.
- ✅ `npm run test:frontend` — 63 tests, all pass.
- ✅ `npm run build --prefix frontend` — clean Vite production build.
- ✅ `git diff --check` — no whitespace errors.
- ✅ Browser smoke test scaffold for `/settings` added and updated for six preference selects.
  Full CI E2E activation remains Phase 9/10.

## Completion Criteria

- ✅ An authenticated user can save/delete Ambient credentials from the settings page (with confirmation before delete).
- ✅ An authenticated user can load and update unit/theme preferences from the settings page; theme change takes effect immediately.
- ✅ An authenticated user can sync owned Ambient devices from saved credentials (auto-synced on credential save; explicit sync button also available).
- ✅ An authenticated user can update nickname/default/dashboard visibility/metric selections for their own devices only.
- ✅ `UserPreferences.DefaultWeatherStationId` is set to the primary station on first sync and kept in sync when primary changes.
- ✅ Ambient keys never leave the backend and never appear in logs, responses, frontend state after submit, or tests.
- ✅ Backend and frontend tests cover the controller/UI paths.
- [>] Real EF repository invariant tests for station sync/default/primary behavior move to
  Phase 8 carry-in.
- ✅ Main development plan and this closeout plan agree on status and deferrals.
