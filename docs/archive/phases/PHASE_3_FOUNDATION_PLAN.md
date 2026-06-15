# Phase 3 Foundation Plan

Phase 3 builds the React frontend foundation. It should produce a real app shell with
auth, routing, providers, typed BFF access, an accessibility baseline, tests, and setup
docs. It should not implement the dashboard, charting, realtime, neighbor, or full
settings product features yet.

**Status: COMPLETE** — Initial implementation done 2026-05-29. Post-review fixes applied
same day. See `docs/PHASE_3_FIXES_PLAN.md` for the full fix log.

**Final verified counts:** 35/35 frontend tests · 93 unit + 38 integration backend tests ·
lint clean · build clean.

---

## Goal

Create a production-shaped frontend shell that later phases can build on without
rewiring app fundamentals.

---

## Scope

In scope:

- Frontend dependency preflight and approved package choices.
- Tailwind CSS and shadcn/ui foundation.
- React Router app shell and route placeholders.
- Provider composition for auth, TanStack Query, theme, and error handling.
- Auth login/logout/callback plumbing and protected routes.
- Typed BFF API client foundation.
- WCAG 2.2 AA shell baseline.
- Frontend tests for providers, routing, auth, API client, and accessibility.
- README and `.env.example` updates for local frontend setup.

Out of scope:

- Ambient history pagination, metric history endpoint, specific-date data retrieval, Redis
  history cache, and history slicing tests. These remain Phase 6/8.
- Full Settings page forms for credentials, preferences, device options, and dashboard
  visibility. These remain Phase 7, though Phase 3 may add a protected placeholder route.
- SignalR client and realtime hook. These remain Phase 9.
- Dashboard metric tiles, layout editor, current/rainfall BFF routes, unit conversion UI,
  and dashboard E2E. These remain Phase 10.
- Neighbor discovery, configuration UI, and aggregation. These remain Phase 11.
- Full metric detail charts, ECharts integration, date picker chart controls, exports, and
  chart accessibility polish. These remain Phase 12.

---

## Step 1 — Dependency And License Preflight

- Verify every new npm package is MIT, Apache 2.0, or BSD-3-Clause.
- Verify each package is actively maintained and not deprecated.
- Expected candidates:
  - Tailwind CSS
  - shadcn/ui and Radix primitives
  - `class-variance-authority`
  - `clsx`
  - `tailwind-merge`
  - `lucide-react`
  - React Router
  - TanStack Query
  - Auth0 React SDK or an approved OIDC client
  - `jest-axe`
- Record final package/version/license choices in the docs if they affect project rules
  or local setup.

Exit criteria:

- Package candidates are confirmed free, safe, maintained, and compatible with React 19,
  Vite, TypeScript strict mode, and existing lint/test tooling.

---

## Step 2 — Tailwind CSS And shadcn/ui Foundation

- Configure Tailwind for the Vite React app.
- Remove placeholder Vite styles.
- Add shadcn-compatible design tokens and CSS variables.
- Add light/dark theme support.
- Add initial UI primitives:
  - Button
  - Card
  - Input
  - Label
  - Alert
  - Skeleton
  - Tooltip
  - Dropdown/menu or select
- Keep colors centralized in theme/config files.
- Do not hardcode hex colors in components outside theme/config files.

Exit criteria:

- The app has a reusable UI foundation and no longer depends on default Vite styling.

---

## Step 3 — App Shell And Routing

- Add React Router.
- Add route modules for:
  - Dashboard/home placeholder
  - Settings placeholder
  - Metric detail placeholder
  - Auth callback
  - Not found
- Add semantic landmarks:
  - `header`
  - `nav`
  - `main`
  - `footer`
- Add responsive navigation suitable for future dashboard/settings/chart pages.
- Add route-level loading, error, and not-found states.
- Add a React error boundary with a user-safe fallback.

Exit criteria:

- The first screen is the actual app shell, not a landing page.
- Routes work and placeholders clearly reserve space for future phase features.

---

## Step 4 — Provider Composition

- Add `AppProviders`.
- Compose:
  - Router
  - Auth provider
  - TanStack Query provider
  - Theme provider
  - Error handling
- Configure TanStack Query defaults for:
  - Retry behavior
  - Stale time
  - Refetch behavior
  - Error handling appropriate for BFF calls
- Add a centralized query key factory under `frontend/src/api` or
  `frontend/src/lib/queryKeys`.

Exit criteria:

- App-wide providers are centralized and testable.
- Future hooks can reuse stable query keys instead of inventing local strings.

---

## Step 5 — Auth Foundation

- Add frontend-safe `VITE_*` environment variables for:
  - Auth domain
  - Client ID
  - Audience
  - BFF base URL, if needed outside the existing Vite proxy
- Use local Auth0 SPA values from developer-local environment files:
  - `VITE_AUTH0_DOMAIN=<your-auth0-domain>`
  - `VITE_AUTH0_CLIENT_ID=<your-auth0-spa-client-id>`
  - `VITE_AUTH0_AUDIENCE=https://ambient-weather-dashboard-api`
- Add a typed frontend configuration module that validates required `VITE_*` values at
  startup.
- Ensure server-only secrets never enter the browser bundle.
- Implement:
  - Login
  - Logout
  - Auth callback handling
  - Protected routes
  - A small authenticated-user/session surface
- Add a deterministic test/dev auth adapter or mock provider so Vitest and local shell
  tests do not depend on live Auth0 redirects.
- Send frontend auth only as `Authorization: Bearer` headers to the BFF.
- Keep Ambient `apiKey` and `applicationKey` server-side only.

Exit criteria:

- Shell routes can be protected by user auth.
- Tests can exercise auth behavior without calling Auth0.
- No Ambient credential values or config keys are exposed to the frontend.

---

## Step 6 — Typed BFF API Client Foundation

- Add a typed fetch wrapper with:
  - Base URL support
  - Bearer-token injection
  - Cancellation support
  - Typed success results
  - Typed error results
  - No secret logging
- Add typed client functions only for shell-needed endpoints, such as health/settings
  status and auth-aware placeholder flows.
- Defer dashboard metrics, historical chart data, neighbor data, and SignalR clients to
  later phases.

Exit criteria:

- The frontend has one standard path for BFF calls.
- Token handling and error handling are centralized before product endpoints arrive.

---

## Step 7 — Accessibility Baseline

- Add skip-navigation link at the top of every page.
- Use semantic HTML landmarks in the shell.
- Add globally visible focus styles with Tailwind `focus-visible:ring`.
- Ensure focused elements are not obscured by sticky chrome.
- Validate color palette against WCAG AA contrast ratios:
  - 4.5:1 for normal text
  - 3:1 for large text and UI components
- Move focus to main content after client-side route changes.
- Keep `eslint-plugin-jsx-a11y` errors blocking CI.
- Add `jest-axe` to Vitest setup.
- Add `toHaveNoViolations()` assertions for new shell component tests.

Exit criteria:

- Phase 3 establishes the accessibility baseline that later UI phases inherit.

---

## Step 8 — Frontend Tests

- Add Vitest/React Testing Library tests for:
  - Provider composition
  - Shell rendering
  - Navigation
  - Protected-route behavior
  - Auth button states
  - API client bearer header injection
  - Query key stability
  - Accessibility checks for shell components
- Keep ESLint React/a11y/test rules at zero warnings.

Exit criteria:

- Shell behavior is covered before feature pages are built on it.

---

## Step 9 — Documentation And Local Setup

- Update `README.md` with:
  - Frontend dev-server commands
  - Required `VITE_*` auth variables
  - Existing Vite `/api` and `/hubs` proxy behavior
  - Credential setup workflow now that auth is visible in the shell
- Update `.env.example` with frontend-safe auth variables only.
- Keep `frontend/.env.example` aligned with Vite's local env file location.
- Update project rules/docs if Phase 3 establishes new frontend conventions.
- Keep LF line endings.

Exit criteria:

- A developer can configure and run the frontend shell locally without guessing.

---

## Step 10 — Verification

Run:

```bash
npm run lint
npm test
npm run build
```

After UI work lands:

- Start the Vite dev server.
- Browser-smoke the shell at desktop and mobile widths.
- Verify there is no text overlap, broken layout, or blank primary screen.

Run backend verification only if backend auth/API contracts change:

```bash
dotnet test backend/AmbientWeather.slnx
dotnet format backend/AmbientWeather.slnx --verify-no-changes --verbosity minimal
```

---

## Completion Checklist

- [x] Dependencies verified for license, maintenance, and compatibility.
- [x] Tailwind and shadcn/ui foundation configured.
- [x] Placeholder Vite styling removed.
- [x] App routes and semantic shell implemented.
- [x] Error boundary and route states implemented.
- [x] App providers centralized.
- [x] Query key factory added.
- [x] Auth login/logout/callback/protected route flow implemented.
- [x] Test/dev auth strategy implemented.
- [x] Typed frontend config validation added.
- [x] Typed BFF API client foundation added.
- [x] Accessibility baseline implemented.
- [x] Shell/provider/auth/API/accessibility tests added.
- [x] README and `.env.example` updated.
- [x] `npm run lint` passes.
- [x] `npm test` passes (35/35).
- [x] `npm run build` passes.
- [x] Browser smoke check passes at desktop and mobile widths.

---

## Post-Review Fixes Applied

After initial implementation, a full code review and PR review surfaced 23 additional
items addressed before merge. Key changes (full detail in `docs/PHASE_3_FIXES_PLAN.md`):

**Security**
- `ApplicationKeyAuthMiddleware` removed from `/api/v1/devices` pipeline — route is
  protected by `[Authorize]`. 5 integration tests updated to assert JWT-401 behavior.
- HttpClient logging suppressed for the Ambient REST client to prevent API keys leaking
  through request URI logs.

**Correctness**
- `getAuthConfig()` is now a lazy function called inside `AppAuthProvider`'s render so
  missing-var throws in production are caught by `ErrorBoundary`.
- `Auth0AuthBridge` now surfaces `useAuth0().error` via `AuthContextValue.error`.
- `Auth0AuthBridge` wraps `login`/`logout`/`getAccessToken` in `useCallback` and the
  context `value` in `useMemo` — eliminates unnecessary re-renders of all auth consumers.
- `ThemeProvider` matchMedia `useEffect` restructured to always return cleanup, fixing a
  listener leak if anything after `addEventListener` throws. Stored theme values are
  validated before use; invalid values fall back to `system`.
- `HttpContextCurrentUserService` dev fallback now respects `DevAuthBypass`: with Auth0
  configured and bypass disabled, real claims are required even in Development; with
  explicit bypass enabled, local Swagger/dev calls get the synthetic identity.
- `AuthCallbackPage` and `RouteErrorPage` changed inner `<main>` to `<div>` — `AppShell`
  owns the single `<main id="main-content">` landmark.

**DRY / cleanup**
- `config/auth.ts` and `lib/config.ts` merged into `config/app.ts`.
- `safeStorage` helper extracted in `ThemeProvider` — shared by read and write paths.
- Page default exports added; router `lazy()` adapters simplified.
- Dead `test:` block removed from `vite.config.ts`.
- Rate-limit bucket IDs hashed (SHA-256) — raw key material no longer in memory.

**UX**
- Login button added to `Navigation` for unauthenticated users.

**Docs / tests**
- Test counts, E2E locator, ignore comment, and stale text updated throughout.
