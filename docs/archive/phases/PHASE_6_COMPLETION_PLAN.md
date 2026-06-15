# Phase 6 Completion Plan — Ambient API Client Foundation

Created: 2026-05-30
Status: Complete

## Purpose

Phase 6 should finish the low-level Ambient Weather REST client foundation. It should not build the
full user-facing history feature, dashboard charts, or neighbor workflow.

The important cleanup is to remove the overlap between phases:

- Phase 6 owns authenticated Ambient REST client behavior, rate-limit safety, JSON DTO reliability,
  and Ambient-specific exception mapping.
- Phase 8 owns product history behavior: `GET /api/metrics/{metricKey}/history`, preset ranges,
  specific historical date mode, multi-page aggregation, Redis history cache assembly, rainfall
  bucketing, and chart-facing DTOs.
- Phase 11 owns nearby public data discovery/averaging through a provider abstraction. Ambient's
  undocumented Open REST API may be one provider, but it is not a Phase 6 dependency.
- Local PostgreSQL raw-reading sync remains optional unless Ambient API plus Redis cache is not good
  enough for performance, availability, or long-range aggregation.

## Current State

- `RateLimitedApiClient` exists and enforces the Ambient request budget in-process:
  - 1 request/second per user API key.
  - 3 requests/second per application key.
  - Retry and circuit-breaker behavior are present.
  - Bucket identifiers are hashed instead of storing raw keys.
- `AmbientRestClient` supports:
  - `GetDevicesAsync`.
  - Single-page `GetDeviceHistoryAsync`.
- `DeviceHistoryService` uses server-side credentials and `IDistributedCache`.
- API-key query strings are still required for Ambient outbound calls, so logging suppression and
  redaction remain mandatory.

## Completion Criteria

Phase 6 is complete when all of the following are true:

- Every authenticated Ambient REST call goes through `RateLimitedApiClient`.
- `RateLimitedApiClient` maps final Ambient HTTP failures to project exceptions:
  - 401/403 -> Ambient auth exception.
  - 404 -> Ambient not-found exception.
  - 429 -> Ambient rate-limit exception.
- 401/403 failures are not retried.
- 429 and transient 5xx/network failures are retried according to the existing resilience policy,
  then surface as the correct exception type if retries are exhausted.
- Ambient REST DTOs deserialize documented payloads with `System.Text.Json`, including numeric fields
  returned as strings where Ambient does that.
- History client behavior is explicitly single-page in Phase 6 and documented as the primitive Phase
  8 will page over.
- `endDate` formatting is verified against the Ambient API docs or a manual redacted call, and the
  chosen format preserves the date/time semantics needed by Phase 8 date slicing.
- Unit tests cover rate-limit/error behavior, URL construction, DTO fixture deserialization, and
  basic mapper edge cases.
- `docs/DEVELOPMENT_PLAN.md` points to this plan and no longer treats Phase 8 or Phase 11 work as
  Phase 6 closeout.

## Detailed Checklist

### 1. Rebaseline Phase Ownership

- ✅ Update the main development plan to describe Phase 6 as "Ambient API client foundation."
- ✅ Mark `AmbientHistoryService` range/date/page assembly as deferred to Phase 8.
- ✅ Mark `AmbientOpenApiClient` neighbor discovery as deferred to Phase 11.
- ✅ Keep `weather_readings` local sync as optional future work, not a Phase 6 requirement.
- ✅ Add this file as the Phase 6 closeout reference from the main plan.

### 2. Ambient Exception Model

- ✅ Add or finalize Ambient-specific exception types:
  - ✅ `AmbientApiAuthException`.
  - ✅ `AmbientApiNotFoundException`.
  - ✅ `AmbientApiRateLimitException`.
- ✅ Place exceptions where the API layer can map them consistently without leaking
  Infrastructure details.
- ✅ Ensure exception messages never include full Ambient URLs or query strings.
- ✅ Add tests that assert key material is not present in exception messages.

### 3. Harden `RateLimitedApiClient`

- ✅ Centralize HTTP response handling after the retry/circuit policy completes.
- ✅ Map 401/403 to `AmbientApiAuthException`.
- ✅ Map 404 to `AmbientApiNotFoundException`.
- ✅ Map final 429 to `AmbientApiRateLimitException`.
- ✅ Preserve existing retry/circuit behavior for transient failures.
- ✅ Confirm 401/403 are not retried and do not open the circuit as transient failures.
- ✅ Confirm cancellation tokens flow through limiter waits, HTTP calls, and JSON reads.
- ✅ Confirm no logging writes full request URIs containing `apiKey` or `applicationKey`.
- ✅ Re-enter rate-limit queue on every retry attempt (not only on the first request).
- ✅ Circuit breaker `RecordFailure` called exactly once per failed attempt (not twice on final retry).
- ✅ Regression tests prove retry attempts re-enter the rate-limit queue and final 5xx failures do
  not double-count circuit-breaker failures.

### 4. Tighten `AmbientRestClient`

- ✅ Keep the client thin: URL construction, request execution, and JSON DTO return only.
- ✅ Document that `GetDeviceHistoryAsync` is a single-page history primitive.
- ✅ Encode MAC addresses and query values using structured URI/query APIs.
- ✅ Validate `limit` (throws `ArgumentException` for values outside 1–288); XML docs corrected
  to say "validated" rather than "clamped".
- ✅ `endDate` sent as epoch milliseconds; `DateTimeKind.Unspecified` treated as UTC to prevent
  silent local-timezone offset on non-UTC servers.
- ✅ Add URL-construction tests for devices and history, including encoded MAC, `limit`, and
  `endDate`.

### 5. JSON DTO and Mapper Coverage

- ✅ Add Ambient REST JSON fixtures for:
  - ✅ `GET /devices`.
  - ✅ `GET /devices/{mac}` history page.
  - ✅ Missing optional sensors.
  - ✅ Numeric values encoded as JSON strings.
- ✅ Use shared `System.Text.Json` options (`AmbientJsonOptions.Default`):
  - ✅ Case-insensitive property names.
  - ✅ `JsonNumberHandling.AllowReadingFromString`.
  - ✅ Ignore unknown fields.
- ✅ `AmbientJsonOptions.Default` sealed with `MakeReadOnly()` to prevent shared-instance mutation.
- ✅ `DeviceHistoryService` cache serialize/deserialize aligned to use `AmbientJsonOptions.Default`.
- ✅ Add DTO deserialization tests using fixtures.
- ✅ Add mapper edge-case tests for missing optional fields and unsupported sensors.
- ✅ Keep DTOs separate from domain/application DTOs.

### 6. Preserve Credential Safety

- ✅ Keep Ambient keys server-side only.
- ✅ Keep outbound Ambient query strings out of application logs.
- ✅ Verified HttpClient logging categories stay at Warning or higher.
- ✅ Cache keys and rate-limit bucket names use SHA-256 hashes, not raw key values.
- ✅ Regression tests for key-material-free exception messages.
- ✅ `SettingsController.SaveCredentials` catches `AmbientApiAuthException` and returns
  400 `ambient-credentials-invalid` (not 401) when downstream credential validation fails.
- ✅ Credential store logs no raw or hashed auth-provider subject.

### 7. Verification

- ✅ Backend unit tests pass (155).
- ✅ Backend integration tests pass (48).
- ✅ `dotnet format --verify-no-changes` passes.
- ✅ Frontend lint and Vitest still pass after shared repo/docs updates.
- ✅ `git diff --check` passes.
- ✅ Phase 6 status marked complete in `docs/DEVELOPMENT_PLAN.md`.

## Deferred Work

### Deferred To Phase 8

- `AmbientHistoryService` for multi-page range/date fetches.
- `GET /api/metrics/{metricKey}/history`.
- Preset ranges, custom ranges, and `range=date&date=YYYY-MM-DD`.
- Redis page cache and assembled chart-response cache.
- Rainfall bucket aggregation.
- Progress/loading behavior for uncached long ranges.
- History integration tests from mocked Ambient pages to chart DTOs.

### Deferred To Phase 11

- `INearbyWeatherProvider`.
- Experimental Ambient Open API provider.
- Public fallback providers such as Weather.gov/NWS and Open-Meteo.
- Bounding-box public station discovery where supported.
- Haversine sort and neighbor cache refresh.
- Neighbor current/history source selection.
- Neighbor aggregation and UI.

### Optional Future Optimization

- Local PostgreSQL raw-reading sync with station ownership invariants, idempotency indexes, rollups,
  and sync cursors. This should be introduced only if Ambient API plus Redis cache is not sufficient.

## Completed Implementation Order

1. Update `docs/DEVELOPMENT_PLAN.md` to reflect the cleaned-up Phase 6/8/11 boundaries.
2. Add Ambient exception types and response mapping tests.
3. Harden `RateLimitedApiClient` response handling.
4. Tighten `AmbientRestClient` URL/query/date handling.
5. Add Ambient DTO fixtures and mapper tests.
6. Run backend verification.
7. Mark Phase 6 complete only if all completion criteria are satisfied.
