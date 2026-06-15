# Phase 3 — Post-Review Fix Plan

Consolidated from code review, PR findings, and document review (Word doc on desktop).
All 23 items completed 2026-05-29. Follow-up review fixes completed 2026-05-30.

**Final verified counts:** 35/35 frontend tests · 93 unit + 38 integration = 131/131 backend tests · lint clean · build clean.

---

## P0 — Security

- [x] **S-1** `backend/src/AmbientWeather.Api/Middleware/ApplicationKeyAuthMiddleware.cs:63`
  Removed `app.UseMiddleware<ApplicationKeyAuthMiddleware>()` from `Program.cs`. Route
  is protected by `[Authorize]` + per-user credential flow. Class retained for Phase 7
  reference. 5 integration tests updated to assert the new JWT-401 behavior (no longer
  expecting `applicationKey-invalid` JSON body).

- [x] **S-2** `backend/src/AmbientWeather.Api/appsettings.json`
  Added `System.Net.Http.HttpClient.AmbientWeatherRest: Warning` logging filter.
  Suppresses HttpClientFactory's Info-level request URI logs that contained raw
  `apiKey`/`applicationKey` query parameters.

---

## P1 — Correctness bugs

- [x] **B-1** `frontend/src/config/app.ts` (replaces `config/auth.ts`)
  `getAuthConfig()` is now a lazy function called inside `AppAuthProvider`'s render.
  Any missing-var throw in production is caught by `ErrorBoundary` above the provider.
  Combined with D-4 — `config/auth.ts` and `lib/config.ts` merged into `config/app.ts`.

- [x] **B-2** `frontend/src/lib/auth.tsx`
  Added `error: Error | undefined` to `AuthContextValue`. `Auth0AuthBridge` reads
  `useAuth0().error` and includes it in the memoised context value. `MockAuthProvider`
  accepts an optional `error` prop for testing error states.

- [x] **B-3** `frontend/src/providers/ThemeProvider.tsx`
  Restructured the system-preference `useEffect` so `cleanup` is captured as a
  `let` variable before the `try/catch`. Both success and failure paths return it,
  preventing listener leaks when anything after `addEventListener` throws. Follow-up:
  stored theme values are now validated before use; invalid local storage data falls
  back to `system`.

- [x] **B-4** `frontend/src/auth/AppAuthProvider.tsx` — **retained as-is**
  The router.navigate-before-RouterProvider-mounts concern was assessed as PLAUSIBLE
  but low risk in practice: React Router v7's `createBrowserRouter` singleton accepts
  `navigate()` calls before `RouterProvider` mounts and applies them on mount.
  Restructuring would require moving `Auth0Provider` into a nested layout route with
  significant complexity. Deferred — re-evaluate if navigation issues are observed.

- [x] **B-5** `frontend/src/lib/auth.tsx`
  Wrapped `login`, `logout`, and `getAccessToken` in `useCallback` inside
  `Auth0AuthBridge`. Combined with P-1 — the full `value` object is now `useMemo`'d.

- [x] **M-1** `backend/src/AmbientWeather.Api/Services/HttpContextCurrentUserService.cs`
  Injected `IConfiguration`. `DevBypassActive` property is `true` only when
  `environment.IsDevelopment() && (!IsJwtConfigured || DevAuthBypass=true)`. With
  Auth0 configured and bypass disabled, `IsAuthenticated`, `AuthProviderSubject`, and
  `Email` now return real claim values or `null` — never the `dev|swagger-user`
  synthetic identity. With explicit bypass enabled, Swagger-local dev calls still get
  the synthetic identity.

- [x] **M-2** `frontend/src/pages/AuthCallbackPage.tsx` and `RouteErrorPage.tsx`
  Changed inner `<main id="main-content" tabIndex={-1}>` to `<div>` in both pages.
  `AppShell` owns the outer `<main>` landmark. Duplicate IDs and nested `<main>`
  elements eliminated.

---

## P2 — Performance / UX

- [x] **P-1** `frontend/src/lib/auth.tsx`
  `Auth0AuthBridge` now wraps the context `value` object in `useMemo` with Auth0
  state as dependencies. All `useAuth()` consumers only re-render when auth state
  actually changes.

- [x] **P-2** `frontend/src/components/layout/Navigation.tsx`
  Added a Login button (with `LogIn` icon) visible when `!isAuthenticated && !isLoading`.
  Unauthenticated users on non-protected routes (e.g. 404) now have a visible
  entry point to initiate the Auth0 login flow.

---

## P3 — DRY / cleanup

- [x] **D-1** `frontend/vite.config.ts`
  Removed `test:` block and the `/// <reference types="vitest/config" />` triple-slash
  directive. Vitest uses `vitest.config.ts` exclusively when both files exist. Left a
  comment explaining this.

- [x] **D-2** `frontend/src/pages/` and `frontend/src/router.tsx`
  Added `export default PageName` to `DashboardPage`, `SettingsPage`, and
  `MetricDetailPage`. Simplified `lazy()` calls from
  `.then(m => ({ default: m.PageName }))` adapter to plain
  `lazy(() => import('./pages/PageName'))`.

- [x] **D-3** `frontend/src/providers/ThemeProvider.tsx`
  Extracted `safeStorage` helper (`get` / `set` with try/catch) shared by
  `readStoredTheme` and the theme persistence effect. Eliminated duplicated
  localStorage error-handling patterns.

- [x] **D-4** `frontend/src/config/app.ts`
  Merged `frontend/src/config/auth.ts` and `frontend/src/lib/config.ts` into a single
  `frontend/src/config/app.ts`. Exports `getAuthConfig()` (lazy) and `appConfig`
  (API base URL). Old files deleted. Imports updated in `AppAuthProvider.tsx` and
  `api/client.ts`.

- [x] **L-1** `backend/src/AmbientWeather.Infrastructure/Ambient/RateLimitedApiClient.cs`
  `GetApiKeyBucket()` and `GetApplicationKeyBucket()` now hash the key strings with
  SHA-256 (lower hex) before using them as bucket identifiers. Raw key material no
  longer present in in-process memory structures.

---

## P4 — Docs / tests

- [x] **T-1** `docs/DEVELOPMENT_PLAN.md:681,695` — Updated `26 tests` / `26/26` → `33 tests` / `33/33`.

- [x] **T-2** `docs/DEVELOPMENT_PLAN.md:569` — Updated snapshot: `88 unit, 26+ integration`
  → `89 unit, 38 integration`. (Unit count subsequently rose to 91 after DeviceHistory
  test updates from S-1; snapshot updated separately.)

- [x] **T-3** `tests/AmbientWeather.E2E/Pages/HomePage.cs:8` — Updated locator from
  `"Ambient Weather Dashboard"` → `"Dashboard"` to match `DashboardPage.tsx` heading.

- [x] **T-4** `tests/AmbientWeather.E2E/DashboardSmokeTests.cs` — Updated `[Ignore]`
  comment from "Phase 4" → "Phase 9 when frontend dev server with real Auth0 runs in CI".

- [x] **T-5** `docs/DEVELOPMENT_PLAN.md` — Removed stale bypass comment
  ("Phase 3 wires up the frontend login flow. Until then…") from the auth policy section.

- [x] **T-6** `frontend/src/test/setup.ts` — Added two-line comment explaining why
  `testIdAttribute: 'data-test-id'` overrides the default `data-testid`, linking to
  the `CLAUDE.md` convention.

- [x] **L-2** `README.md:83` — Replaced "once Phase 3 auth code lands" with
  "Copy to frontend/.env.local for local development".

- [x] **T-7** Added regression tests for the follow-up fixes:
  `HttpContextCurrentUserServiceTests` covers `DevAuthBypass=true` with Auth0
  configured, and `ThemeProvider.test.tsx` covers invalid stored theme fallback.

---

## Summary

| Priority | Count | Theme |
|---|---|---|
| P0 — Security | 2 | Key exposure on browser route + in logs |
| P1 — Correctness | 7 | Module-load throw, dropped auth errors, listener leak, routing timing (deferred), unstable callback, Dev user service, duplicate landmarks |
| P2 — Perf / UX | 2 | Unnecessary re-renders, missing login button |
| P3 — DRY | 5 | Dead config, named-export adapter, localStorage helper, config merge, bucket hash |
| P4 — Docs / tests | 8 | Test counts, E2E locator, ignore comment, stale comments, regression tests |
| **Total** | **24** | |

**Note on B-4:** The router.navigate timing issue was PLAUSIBLE but not reproduced in
practice. React Router v7's router singleton handles pre-mount navigate calls. Deferred
to Phase 9 for re-evaluation when the realtime/auth flow is fully exercised in CI.
