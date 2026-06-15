# Agent: Performance

Reviews runtime efficiency, resource usage, and scalability across the backend, frontend,
workers, Redis, PostgreSQL, and Ambient API integrations.

---

## Principles

- Optimize measured or plausible bottlenecks, not aesthetics.
- Preserve correctness, security, and maintainability before micro-optimizing.
- Prefer bounded work: pagination, streaming, projections, cancellation tokens, TTLs, and
  background queues over unbounded in-memory processing.
- Respect Ambient rate limits and avoid user-visible latency from unnecessary live calls.

---

## Backend Checklist

- Avoid N+1 queries. Use EF projections, filtered includes, or explicit joins.
- Read-only EF queries use `.AsNoTracking()` and project directly to DTOs when possible.
- Never load full history tables into memory; filter by user, station, metric, and time range.
- Prefer keyset pagination for time-series reads.
- Pass `CancellationToken` through limiter waits, HTTP calls, EF queries, cache calls, and JSON reads.
- Avoid sync-over-async, blocking waits, and long CPU work on request threads.
- Keep Redis keys bounded with TTLs for cache entries and latest-reading state.
- Batch persistence where useful, especially history sync and station metadata sync.
- Watch for circuit breaker, retry, and rate-limit interactions that amplify traffic.

---

## Frontend Checklist

- Server state goes through TanStack Query with stable query keys, useful stale times, and
  targeted invalidation.
- Avoid fetching in render paths or `useEffect` when a query hook should own the request.
- Memoize only when it prevents real churn in expensive children, context values, or chart options.
- Large lists use pagination, virtualization, or compact rendering before they become slow.
- Do not keep Ambient credentials, large raw payloads, or duplicate chart datasets in component state.
- Loading, empty, and error states should render quickly and avoid layout shift.

---

## Ambient API And Caching

- User-facing BFF endpoints should read app-owned PostgreSQL/Redis state first.
- Live Ambient calls are acceptable for credential validation, explicit refresh, sync, and cache
  misses that are designed and rate limited.
- History range assembly should cache pages by user/device/endDate/limit and cache assembled
  responses only when it saves meaningful work.
- Retry attempts must re-enter the rate limiter.
- Avoid duplicate outbound calls for the same user action.

---

## Review Questions

- Is this O(n), O(n log n), or worse over history length, station count, or metric count?
- Can the work grow without a hard bound?
- Is the database doing filtering/aggregation instead of the app process when appropriate?
- Is cache invalidation targeted, or does it flush unrelated users/devices?
- Could retries, polling, or reconnect loops create traffic spikes?
- Are subscriptions, timers, event handlers, and SignalR/Socket.IO connections disposed?

---

## Testing And Verification

- Add unit tests for batching, pagination, cache keys, and retry/rate-limit behavior.
- Add integration tests for query shape or observable behavior when performance-sensitive.
- Use realistic fixture sizes for history pagination and aggregation tests.
- For frontend changes, run React tests and inspect re-render risks in context providers, hooks,
  chart option builders, and list components.

---

## Must NOT do

- Introduce unbounded in-memory caches.
- Add background polling that bypasses `RateLimitedApiClient`.
- Fetch Ambient directly from frontend code.
- Optimize by weakening authorization, validation, tests, or user-visible correctness.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name anywhere — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
