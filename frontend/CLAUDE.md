# Frontend rules

Loaded when Claude works on files under `frontend/`. Repo-wide rules (privacy, licences, secrets,
phase closeout, shell safety, test tooling, commit format) are in the root `CLAUDE.md`.
BFF routes: read the table in `backend/src/AmbientWeather.Api/CLAUDE.md` (or `docs/openapi.json`) before
adding or changing a function in `src/api/` or a type in `src/types/`.

---

## Rules

### Frontend architecture
- TypeScript strict mode; **never use `any`**. All API responses have matching interfaces.
- **Type predicate narrowing**: `(k): k is T` is only valid when `T` is assignable to the parameter's type. When filtering a const array whose element type is narrower than the target union, TypeScript rejects the predicate (TS2677). Fix: drop the predicate and cast the result — `array.filter((k) => allowed.includes(k)) as T[]`.
- **`ApiResult` error mocks must include `status`**: the `ok: false` branch of `ApiResult<T>` is `{ readonly ok: false; readonly status: number; readonly error: string }`. Always include `status` when mocking failures — e.g. `{ ok: false, status: 500, error: '...' }`.
- Separate presentation components from data hooks (TanStack Query).
- Server state goes through TanStack Query with a centralized query key factory.
- Use shadcn/ui primitives and Tailwind CSS — no hardcoded hex colours outside the theme. The `no-restricted-syntax` ESLint rule rejects hex literals in JSX `className` strings; use Tailwind semantic tokens (`text-foreground`, `text-destructive`, …) or CSS variables instead. Non-semantic colour utilities (e.g. `text-green-800`) must always be paired with a `dark:` counterpart (e.g. `dark:text-green-300`).
- **React Compiler is active** (`react-hooks/preserve-manual-memoization` is enforced). `useMemo`/`useCallback` dependency arrays must exactly match what the compiler infers. A common pitfall: using `obj.property` as a dep when the compiler tracks the parent object (`obj`). Fix: use the object reference as the dep and access the property inside the callback. `// eslint-disable-next-line react-hooks/exhaustive-deps` suppresses the exhaustive-deps rule but does **not** suppress `preserve-manual-memoization` — the lint error will still fail CI.
- **TanStack Query v5 disabled-query pattern**: when `enabled: false` a query parks at `{ isPending: true, fetchStatus: 'idle' }` without fetching. Any hook that conditionally enables a query must guard its exposed `isPending` as `isPending && fetchStatus !== 'idle'` so callers can distinguish "not yet enabled" from "actively loading". See `useNeighborsConfig.ts` and `useCredentialStatus.ts` for the established pattern.
- `@typescript-eslint/switch-exhaustiveness-check` is enforced. Every `switch` on a discriminated union must be exhaustive — cover all members or add a `default` that throws or narrows to `never`.
- `DevAuthBypass=true` in `appsettings.Development.json` injects a mock user so the backend
  accepts requests without a real Auth0 token. Set to `false` to require real JWT.
- Telemetry: use `ITelemetry` from `src/telemetry/index.ts` — never import
  `@microsoft/applicationinsights-web` or any RUM SDK directly into page/component/hook code.
- Every interactive element (buttons, inputs, selects, toggles, links, form fields) and every
  dynamic/data-driven element (tiles, chart panels, list rows, status indicators) **must** carry
  a `data-test-id` attribute with a stable, kebab-case, human-readable value.
  Use the pattern `<area>-<element>[-<qualifier>]` (e.g. `dashboard-metric-tile`,
  `settings-save-credentials-button`, `chart-range-selector`). Never derive the value from
  dynamic data (indices, IDs, timestamps). Playwright E2E tests and RTL component tests must
  locate interactive/dynamic elements via `data-test-id` — not by CSS class, XPath, or text
  that is likely to change.

### Frontend tests
Frontend HTTP mocking: use `vi.stubGlobal('fetch', vi.fn())` returning typed `Response` objects. MSW is not installed; do not add it without a deliberate decision.

---

## Folder responsibilities

```
frontend/src/
├── api/                             Typed BFF endpoint functions (one per route)
├── components/                      UI components with co-located *.test.tsx files
├── hooks/                           TanStack Query hooks, useWeatherHub
├── lib/                             Centralized query key factory, utilities
├── pages/                           Route-level page components
├── telemetry/                       ITelemetry abstraction (never import RUM SDK directly)
└── types/                           TypeScript interfaces mirroring backend DTOs
```
