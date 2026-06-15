# Ambient Weather Dashboard - Codebase Improvement Plan

## Overview
This plan addresses critical and medium-priority issues identified in the code review to improve production-readiness, security, and maintainability.

**Estimated Total Time:** ~7-9 hours
**Priority Focus:** Production-readiness and stability

---

## Action Items (Priority Order)

### 1. ✅ Remove Duplicate HttpClient Registration
- **Severity:** High
- **Estimated Time:** 5 minutes
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Api/Program.cs` (remove duplicate)
  - `backend/src/AmbientWeather.Infrastructure/DependencyInjection.cs` (consolidate)
- **Details:**
  - HttpClient for `AmbientRestClient` is registered twice
  - First registration in Program.cs has custom headers configured
  - Second registration in DependencyInjection.cs overrides it
  - **Action:** Remove duplicate; consolidate config to DependencyInjection.cs

---

### 2. ✅ Add Redis Distributed Caching
- **Severity:** High
- **Estimated Time:** 1-2 hours
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Infrastructure/DependencyInjection.cs` (add Redis registration)
  - `backend/src/AmbientWeather.Infrastructure/Services/DeviceHistoryService.cs` (update to use IDistributedCache)
  - Project file: `backend/src/AmbientWeather.Infrastructure/AmbientWeather.Infrastructure.csproj` (add NuGet package)
  - `backend/src/AmbientWeather.Api/appsettings.json` (add Redis instance configuration)
- **Details:**
  - Previous: In-memory `ConcurrentDictionary` cache (not distributed, lost on restart)
  - Implemented Redis-backed `IDistributedCache` registration with Development/Testing memory-cache fallback
  - Replaced `ConcurrentDictionary<string, CachedHistory>` with `IDistributedCache`
  - Updated cache key format to include normalized MAC address, limit, end date, and invalidation namespace versions
  - Added Redis instance configuration without committing a connection string

---

### 3. ✅ Implement Ambient REST Rate Limiting and Resilience
- **Severity:** High
- **Estimated Time:** 1 hour
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Infrastructure/DependencyInjection.cs` (register rate-limited Ambient client)
  - `backend/src/AmbientWeather.Infrastructure/Ambient/RateLimitedApiClient.cs` (rate limit, retry, circuit breaker)
  - `backend/src/AmbientWeather.Infrastructure/Ambient/AmbientRestClient.cs` (route outbound calls through rate-limited client)
  - `backend/src/AmbientWeather.Api/appsettings.json` (add non-secret resilience configuration)
- **Details:**
  - Previous: Comment only—rate limiting not implemented
  - Implemented in-process 1 req/sec throttling per Ambient user API key and 3 req/sec application-key spacing
  - Added retry behavior for transient failures with exponential backoff and jitter
  - Added circuit breaker for repeated transient failure detection
  - Avoided `Microsoft.Extensions.Http.Polly` because the package is deprecated
  - Avoided direct `Polly` package because its BSD-3-Clause license is outside this repo's MIT/Apache-only dependency rule

---

### 4. ✅ Add Application Key Configuration Validation
- **Severity:** Medium
- **Estimated Time:** 15 minutes
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Api/Middleware/ApplicationKeyAuthMiddleware.cs`
- **Details:**
  - Previous: Missing app key silently became an empty string
  - Added `InvalidOperationException` validation in `ApplicationKeyAuthMiddleware`
  - Added integration coverage for missing app key configuration
  - Prevents protected API endpoints from running with missing security configuration

---

### 5. ✅ Fix Test DTO Duplication
- **Severity:** Medium
- **Estimated Time:** 10 minutes
- **Status:** ✅ Completed
- **Files:**
  - `backend/tests/AmbientWeather.IntegrationTests/DeviceHistoryControllerAuthTests.cs`
- **Details:**
  - Current: Test defines local `ErrorResponseDto`
  - Goal: Import from `AmbientWeather.Application` instead
  - Remove duplicate class definition
  - Add reference to application DTO

---

### 6. ✅ Complete MAC Address Format Validation
- **Severity:** Medium
- **Estimated Time:** 15 minutes
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Application/Common/MacAddressValidator.cs`
  - `backend/src/AmbientWeather.Infrastructure/Services/DeviceHistoryService.cs`
  - `backend/src/AmbientWeather.Api/Controllers/DeviceHistoryController.cs`
  - `backend/tests/AmbientWeather.UnitTests/Application/Common/MacAddressValidatorTests.cs`
  - `backend/tests/AmbientWeather.UnitTests/Infrastructure/Services/DeviceHistoryServiceTests.cs`
  - `backend/tests/AmbientWeather.IntegrationTests/DeviceHistoryControllerAuthTests.cs`
- **Details:**
  - Previous: Controller validated MAC format, but `DeviceHistoryService` only checked null/empty
  - Added shared MAC validation and normalization helper
  - Applied validation in controller and service entry points
  - Added unit tests for validator and service behavior
  - Added integration tests for 400 Bad Request on invalid route values

---

### 7. ✅ Implement HistorySyncWorker
- **Severity:** Medium
- **Estimated Time:** 2-3 hours (depends on sync logic requirements)
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Workers/HistorySyncWorker.cs`
  - `backend/src/AmbientWeather.Workers/HistorySyncWorkerOptions.cs`
  - `backend/src/AmbientWeather.Workers/Program.cs` (update service registration)
  - `backend/src/AmbientWeather.Workers/appsettings.json`
  - `backend/tests/AmbientWeather.UnitTests/Workers/HistorySyncWorkerTests.cs`
- **Details:**
  - Previous: Placeholder only—slept every minute
  - Added options-driven `HistorySyncWorker`
  - Sync is disabled by default and requires a configured device MAC address
  - Fetches history through `IAmbientRestClient`
  - Stores readings through `IWeatherReadingRepository` when a repository is registered
  - Handles disabled, invalid config, missing repository, cancellation, and transient failures gracefully

---

### 8. ✅ Add Global Exception Handling Middleware
- **Severity:** Low
- **Estimated Time:** 30 minutes
- **Status:** ✅ COMPLETED
- **Files:**
  - `backend/src/AmbientWeather.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` (new file)
  - `backend/src/AmbientWeather.Api/Program.cs` (register middleware)
- **Details:**
  - Previous: No global exception handler
  - Added middleware to catch unhandled exceptions and return consistent safe error responses
  - Logs exceptions for debugging without returning stack traces to callers
  - Added integration coverage for 500 response shape

---

## Completion Checklist

- [x] Step 1: Remove duplicate HttpClient registration
- [x] Step 2: Add Redis distributed caching
- [x] Step 3: Implement rate limiting and resilience
- [x] Step 4: Add application key configuration validation
- [x] Step 5: Fix test DTO duplication
- [x] Step 6: Add MAC address format validation
- [x] Step 7: Implement HistorySyncWorker
- [x] Step 8: Add global exception handling middleware

---

## Testing Strategy

After each change:
1. Run unit tests: `backend/tests/AmbientWeather.UnitTests/`
2. Run integration tests: `backend/tests/AmbientWeather.IntegrationTests/`
3. Run build to ensure no compilation errors

---

## Notes

- .NET 10 target framework
- Prefer minimal library additions (Redis/Distributed Cache; no Polly package unless the dependency policy is updated)
- Follow existing code style and patterns
- Update XML comments where appropriate
