# Agent: Frontend (React + TypeScript)

Handles `frontend/src/` — components, hooks, pages, API clients, and types.

---

## Stack

| Package | Licence | Purpose |
|---|---|---|
| React 19 + TypeScript | MIT | UI framework |
| Node 24 LTS | MIT | Frontend toolchain runtime |
| Vite | MIT | Build tool |
| shadcn/ui + Tailwind CSS | MIT | Accessible UI primitives |
| TanStack Query | MIT | Server state |
| react-grid-layout | MIT | Customizable dashboard grid |
| echarts | Apache 2.0 | Metric detail chart engine |
| echarts-for-react | MIT | React wrapper for metric detail charts |
| @microsoft/signalr | Apache 2.0 | Realtime hub client |
| Vitest + React Testing Library | MIT | Component and hook tests |
| ESLint + React/a11y/test plugins | MIT | React + TypeScript + accessibility + test linting |

No paid packages. No deprecated React APIs (class components, legacy context, etc.).
Prefer the current Active LTS Node.js line for local tooling and CI; use Maintenance LTS
only for a documented dependency or hosting constraint.

---

## Folder structure

```
frontend/src/
├── components/
│   ├── dashboard/       MetricTile, RainfallSummaryTile, StatusTile, LayoutEditor
│   ├── charts/          ChartPanel, ChartControls, ECharts wrapper
│   ├── settings/        CredentialsForm, PreferencesForm, NeighbourConfigForm
│   └── ui/              shadcn primitives (do not edit generated files lightly)
├── hooks/
│   ├── useDashboard.ts  TanStack Query wrappers
│   ├── useMetricHistory.ts
│   └── useWeatherHub.ts SignalR → query invalidation
├── pages/               DashboardPage, MetricDetailPage, SettingsPage
├── api/                 Typed fetch functions (one module per BFF area)
├── types/               Interfaces mirroring backend DTOs exactly
├── lib/
│   ├── queryKeys.ts     Centralized TanStack Query key factory
│   └── units.ts         Display unit conversion (mirrors backend logic)
└── test/                Shared test utilities, MSW handlers
```

---

## Core directives

- **Strict TypeScript** — `strict: true`; never use `any`. Every API response has an interface in `types/`.
- **Container / presentation split** — pages and container components call hooks; presentational
  components receive typed props only.
- **TanStack Query for all server state** — no `fetch` in `useEffect`. Centralize keys in `queryKeys.ts`.
- **No Ambient keys in the browser** — Settings form POSTs to `/api/settings/credentials` and clears local state.
- **Theme colours** — use Tailwind/shadcn CSS variables only; no hardcoded hex values in components.
  Verify component visibility in both light and dark themes for headings, labels, icon-only
  buttons, dropdown/menu contents, status text, dashboard tiles, and station/source headers.
  Prefer explicit theme-token utilities (`text-foreground`, `text-card-foreground`,
  `text-muted-foreground`, `bg-card`, `bg-background`) over fragile inherited colours.
- **DRY** — reuse `MetricTile` for all metrics; drive labels/units from shared metric config, not per-tile duplication.
- **Accessibility** — interactive tiles and chart controls use semantic HTML and shadcn primitives with labels.
- **`data-test-id` on every interactive and dynamic element** — buttons, inputs, selects, toggles,
  links, form fields, metric tiles, chart panels, list rows, status indicators, and loading/error
  skeletons all require a `data-test-id`. Use `<area>-<element>[-<qualifier>]` kebab-case naming
  (e.g. `dashboard-metric-tile`, `settings-save-credentials-button`, `chart-range-selector`).
  Never use array indices, database IDs, or other dynamic values in the attribute name.
  Component tests (RTL) and E2E tests (Playwright) must reach interactive/dynamic elements via
  `data-test-id`; do not rely on CSS classes, XPath, or brittle text selectors.

---

## Key pages

| Route | Page | Data sources |
|---|---|---|
| `/` | Dashboard | `GET /api/dashboard/current`, `/rainfall`, `/layout`; SignalR |
| `/metrics/:metricKey` | Metric detail | `GET /api/metrics/{key}/history`; chart controls |
| `/settings` | Settings | Preferences, credentials, neighbour config |

---

## Dashboard layout

- Use `react-grid-layout` with a 12-column responsive grid.
- Edit mode: toggle "Customize layout" → drag, resize, add/remove tiles from palette.
- Persist via `PUT /api/dashboard/layout`.
- First login seeds a suggested layout; user can fully rearrange.
- Tile types: `MetricTile`, `RainfallSummaryTile`, `StatusTile`.

---

## Realtime (browser side)

```typescript
// useWeatherHub.ts — connect to /hubs/weather with JWT
// On ReadingUpdated → queryClient.invalidateQueries(dashboardKeys.current)
```

Browsers must **not** connect to Ambient Socket.IO directly. See **realtime** agent.

---

## API client pattern

```typescript
// api/dashboard.ts
export async function getDashboardCurrent(token: string): Promise<DashboardCurrentDto> {
  const res = await fetch('/api/dashboard/current', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<DashboardCurrentDto>;
}
```

One typed function per BFF endpoint. Share `ApiError` helper — do not copy error handling per file.

---

## Testing (required)

Every component gets a co-located `*.test.tsx`:

| Target | Approach |
|---|---|
| Tiles | RTL: renders value, unit, loading/error states |
| Settings forms | RTL: validation messages; credentials never echoed back |
| Hooks | Vitest + MSW or mock query client |
| Layout editor | RTL: drag handler callbacks (mock react-grid-layout) |
| Unit converters | Pure function tests in `lib/units.test.ts` |

Use MSW to mock BFF responses in component tests — never call Ambient from frontend tests.

## Linting

- Run `npm run lint` before handing off frontend changes.
- ESLint uses flat config in `frontend/eslint.config.js`.
- Production code uses strict typed TypeScript rules, React Hooks rules, React Refresh checks, and JSX accessibility rules.
- Test files add Testing Library and Vitest rules.
- `@typescript-eslint/no-explicit-any` and non-null assertions are errors; prefer precise interfaces and explicit guards.

---

## Must NOT do

- Store Ambient API keys in localStorage, sessionStorage, or React state after save.
- Use `any` or unchecked `as` casts on API JSON.
- Fetch data outside TanStack Query (except one-off downloads).
- Duplicate metric field mappings — import from shared `types/metrics.ts`.
- Add CSS-in-JS libraries or paid UI kits.
- Ship an interactive or dynamic element without a `data-test-id`.
- Use dynamic values (array index, database ID, timestamp) as a `data-test-id` value.
- Locate elements in tests by CSS class, XPath, or display text when a `data-test-id` is available.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name in code or tests — not even as an "example."
- TypeScript tests: use `@faker-js/faker` — `faker.location.latitude()`, `faker.location.longitude()`, `faker.location.buildingNumber()`, `faker.location.street()`, `faker.location.city()`, `faker.location.state({ abbreviated: true })`, `faker.location.zipCode()`. State output must be real US state abbreviations (faker default).
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list — never hardcode a single airport every time.
- Every test run must produce different location values. No hardcoded addresses, coordinates, or station IDs anywhere.
- Never save any address, GPS coordinate, or station ID that a user enters.
