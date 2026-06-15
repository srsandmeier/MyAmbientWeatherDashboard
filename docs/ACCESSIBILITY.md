# Accessibility — WCAG 2.2 AA Conformance

## Conformance Claim

Ambient Weather Dashboard targets **WCAG 2.2 Level AA** conformance.

Automated checks: Vitest + jest-axe component-level audits run on every CI build.
Phase 12 also adds Playwright Test TypeScript page-level axe audits plus representative keyboard,
theme, and retry/error-recovery paths.

Manual sweeps (light and dark mode, keyboard-only navigation, screen-reader spot-checks) are
conducted before each phase release.

---

## Keyboard Navigation

All interactive elements are keyboard reachable with a logical tab order:

- **Dashboard metric tiles** — `Enter` or `Space` activates the tile and navigates to Metric Detail.
- **Dashboard source toggle** — on the Default dashboard layout, `Enter` or `Space` switches
  between owned and neighbor sources. Custom layouts hide the neighbor source toggle because
  neighbor comparison is a Default-layout aggregate view.
- **Theme menu** — keyboard open plus `Escape` close are covered at E2E level.
- **Header/footer ticker controls** — `Enter` or `Space` pauses/resumes scrolling ticker content.
- **Collapse toggles** (alert banner, data table) — `Enter` or `Space` expands/collapses.
- **Settings accordion cards** — `Enter` or `Space` toggles the card open/closed.
- **Neighbor station drawer** — `Escape` closes the drawer without losing context.
- **Credentials confirmation** — `Escape` closes the inline delete confirmation without deleting.
- **Custom layout builder move controls** — Up/Down arrow buttons are keyboard reachable and labeled.
- **Chart data table toggle** — `Enter` or `Space`; the toggle button exposes `aria-expanded` and `aria-controls`.
- **Date picker (Metric Detail)** — native `<input type="date">` with full keyboard support.

### Known Gaps

- Drag-and-drop reordering in the Custom Layout builder does not have a keyboard-only drag
  alternative (WCAG 2.2 SC 2.5.7). The Up/Down move buttons on each metric row serve as the
  keyboard-first reorder mechanism; ARIA drag-and-drop is a future enhancement.

---

## Semantic Grouping

- Chart controls are wrapped in a `role="group"` element with `aria-labelledby` pointing to a
  visible (or sr-only) heading so screen readers announce the group name when focus enters.
- Dashboard station sections and collapsed accordion rows expose `aria-expanded` for their
  toggle state.
- Tables use `<caption>` (visually hidden via `sr-only`) and `scope="col"` on header cells.

---

## Live Regions

Realtime weather metric values update via SignalR. The following elements use `aria-live="polite"`
so screen readers announce changes without interrupting the user:

- Metric tile primary value (`MetricTile`).
- Conditions fields (`ConditionsTile`, `HumidityTile`, `WindTile`, `SolarTile`, `TemperatureTile`).
- Rainfall summary values (`RainfallSummaryTile`).
- Custom dashboard metric value cells (`CustomDashboardRenderer`).
- Alert ticker region (polite, not assertive, to avoid repeated interruptions).

The scrolling ticker content region uses `aria-live="off"` — the visual ticker is decoration;
alert text is also available in the expandable alert banner.

---

## Reduced Motion

ECharts animations are disabled when `prefers-reduced-motion: reduce` is active. The chart
data table (always available beneath the chart) provides a non-animated alternative for any
metric history view.

Header and footer tickers pause when `prefers-reduced-motion: reduce` is active, showing only
the first item as static text.

---

## Icon-Only Controls

All icon-only buttons (move-up, move-down, remove metric, pin station, close drawer) carry an
`aria-label` that describes the action and the item it acts on (e.g., "Move Temperature up",
"Remove Humidity"). SVG icons are marked `aria-hidden="true"`.

---

## Focus Appearance

Tailwind CSS `focus-visible` ring utilities apply a 2px ring to all focusable controls.
Shadcn/ui primitives include focus rings by default. No custom control removes the default
browser focus indicator without providing an equivalent replacement.

---

## Color and Contrast

All text and icon colors are defined through Tailwind CSS design tokens (CSS custom properties)
rather than hardcoded hex values. Dark mode is class-based: `ThemeProvider` toggles `.dark` on
the root element. The light theme uses warm neutral surface tokens for page, card, popover,
input, border, and nested section layers so light-mode sections remain visually distinct.

The Dashboard renders correctly in both light and dark mode. Muted/secondary text uses
`text-muted-foreground` which is set to meet the WCAG 1.4.3 enhanced contrast ratio of 4.5:1
against its background in both themes.

Current TS Playwright coverage checks Dashboard, Metric Detail chart controls, Settings, the theme
menu, and representative disabled, empty, and error states in both themes. Page-level axe audits
cover Dashboard, Metric Detail, Settings, Custom Layout builder, the neighbor drawer, and the
credentials delete dialog.

---

## Known Limitations and Future Work

| Area | Limitation | Target |
|---|---|---|
| Playwright axe dependency | Page-level axe sweeps are automated through the existing frontend `axe-core` dependency because `@axe-core/playwright` and `axe-core` metadata checks timed out on 2026-06-12 and again on 2026-06-13. | Revisit only if a dedicated Playwright axe wrapper becomes necessary |
| Custom Layout drag-and-drop | No ARIA drag-and-drop keyboard alternative (keyboard move buttons exist as a workaround). | Post-v1 |
| Form validation announcements | Inline validation messages in Settings forms are not yet wrapped in live regions. | Post-v1 |
| Color-contrast verification | Programmatic contrast ratio testing is not yet automated. Manual sweeps are done per release. | Post-v1 |
