---
name: api-change
description: Step-by-step procedure for adding or changing a BFF endpoint end to end — MediatR handler, validator, DTO, controller with rate limiting, OpenAPI snapshot, frontend type, API function, query key, hook and tests. Use when adding a route, changing a request or response shape, or changing what a handler returns.
---

# api-change

Every public API change updates the backend DTO, the frontend TypeScript type and the tests in the same
branch (root `CLAUDE.md`, "Best practices"). Work in this order; each step names where the rule lives.

## Backend

1. **Read the route table** in `backend/src/AmbientWeather.Api/CLAUDE.md` and pick the controller and the
   rate-limit policy.
2. **Application** (`AmbientWeather.Application/Features/<Area>/`): the query or command, its handler and,
   for any input, a FluentValidation validator (`ValidationBehavior` runs it; never call it by hand). The
   handler starts with `ICurrentUserService.RequireAuthenticatedUser()` and depends on interfaces from
   `Interfaces/`, never on `AmbientWeatherDbContext` or an HTTP client.
3. **DTO** in `Application/DTOs/`: no key material, no EF entity.
4. **Controller:** thin (`mediator.Send`), with a class-level `[EnableRateLimiting]` and a stricter
   action-level policy when the table says so. New exception → map it in
   `GlobalExceptionHandlerMiddleware` and list it in `backend/CLAUDE.md`.
5. **Tests:** handler unit tests, a validator `[Theory]`, and an integration test through
   `WebApplicationFactory`. A handler with a new dependency needs a mock registered in every test factory
   that reaches it, or it answers 500.
6. **Contract:** `npm run swagger:generate` refreshes `docs/openapi.json`; `npm run test:contract` must pass.
7. **Route table:** add or update the row in `backend/src/AmbientWeather.Api/CLAUDE.md`.

## Frontend

8. **Type** in `frontend/src/types/`, mirroring the DTO exactly.
9. **API function** in `frontend/src/api/`: one per endpoint, returning `ApiResult<T>`.
10. **Query key** in `frontend/src/lib/queryKeys.ts` and a TanStack Query hook in `hooks/`; a conditional
    query guards `isPending` as `frontend/CLAUDE.md` says.
11. **Tests:** the hook with a stubbed `fetch` (error mocks include `status`), and each component state.
    A new screen or control gets `data-test-id`s and, for a user journey, a Playwright spec with the BFF
    mock in `tests/e2e/fixtures/bff.ts`.

## Finish

12. `npm run lint` and `npm run test:quiet`; read `test-results/summary.txt`.
13. Run `npm run self-review` and answer its checklist before asking for a review (`security` for
    anything touching credentials or auth).
