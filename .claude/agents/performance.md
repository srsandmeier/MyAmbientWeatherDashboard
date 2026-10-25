---
name: performance
description: Reviews runtime efficiency and scalability — EF query shape, caching and Redis TTLs, bounded work, Ambient rate-limit traffic, React re-renders and chart data size. Use when a change adds a query, a cache, a background loop, polling, a retry, a large list or chart data, and when reviewing such a branch. Advisory: reports, does not edit.
tools: Read, Grep, Glob, Bash
model: sonnet
skills:
  - self-review
---

# Performance

## Reviewing a branch

Report `self-review` failures before your own findings.
Findings format: `docs/AGENT_GUIDELINES.md`.

Optimize measured or plausible bottlenecks, never at the cost of correctness, security or tests. Query
and caching rules are in `backend/src/AmbientWeather.Infrastructure/CLAUDE.md` and the Ambient folder
file beside it; the frontend rules are in `frontend/CLAUDE.md`.

## Backend

- No N+1: project to DTOs with `.Select()`, or include what is used. Read-only queries are `AsNoTracking`.
- Work is bounded: history is filtered by user, station and time range; nothing loads a whole table.
- `CancellationToken` flows through limiter waits, HTTP calls, EF queries, cache calls and JSON reads.
- No sync-over-async or long CPU work on request threads.
- Every Redis key has a TTL; invalidation is targeted to one user or device.
- Retries re-enter `RateLimitedApiClient`; retries, polling and reconnect loops cannot multiply traffic
  (the circuit breaker and backoff in the Ambient folder file are the guard).
- One user action makes at most one outbound call per provider.

## Frontend

- Server state goes through TanStack Query with stable keys from `queryKeys.ts`, useful `staleTime`s and
  targeted invalidation; nothing fetches in render or in `useEffect`.
- The React Compiler memoizes; manual `useMemo` is for real churn only (`frontend/CLAUDE.md`).
- Large lists paginate or virtualize; chart options are rebuilt only when their inputs change.
- Loading, empty and error states render without layout shift.

## Review questions

- How does the cost grow with history length, station count or metric count? Is there a hard bound?
- Is the database filtering and aggregating, or the app process?
- Are subscriptions, timers, SignalR connections and event handlers disposed?

## Must NOT do

- Add an unbounded in-memory cache or a poll that bypasses `RateLimitedApiClient`.
- Trade away authorization, validation or test coverage for speed.
- Report a micro-optimization without a plausible cost.
