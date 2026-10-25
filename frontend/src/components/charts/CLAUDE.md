# Chart rules (Apache ECharts)

Loaded when Claude works on files in `frontend/src/components/charts/`: the metric detail chart, its
controls and its data table. Frontend architecture and test rules are in `frontend/CLAUDE.md`.

---

## Charts

### One option builder
- Every ECharts option is built by `buildMetricHistoryChartOption` (`line`, `area` or `bar`, comparison
  series, unit label, timezone, reduced motion). A new chart need extends it; no component writes its own
  ECharts option.
- `MetricHistoryChart` renders the option; `MetricHistoryControls` owns range, day and station choices;
  `MetricHistoryTable` is the data-table alternative to the chart and stays in step with it.
- Data comes from `useMetricHistory` (TanStack Query) over the BFF history route; a chart never calls a
  provider, and never blocks render on the full history: show the loading state.
- Rainfall is drawn from summed `hourlyrainin` buckets; snapshot fields (`dailyrainin`, …) are for tiles.

### Accessibility and theming
- The option keeps ECharts `aria` enabled with a description of the series, and turns animation off when
  the user prefers reduced motion.
- ECharts draws on a canvas and parses colours itself: it reads neither CSS variables nor `oklch()`.
  `MetricHistoryChart` reads the `--chart-N`, `--muted-foreground`, `--border` and `--popover` tokens with
  `readMetricHistoryChartPalette` (converted to `rgb()` by `lib/themeColors.ts`) and passes them to the
  builder as `palette`; it reads them again when `useAppliedTheme` sees the `dark` class change. The
  builder never emits a `var(...)`; a new colour in the option comes from the palette.
- The `--chart-N` tokens are in `frontend/src/index.css` for both themes, and `npm run ui:contrast` holds
  each at 3:1 or more on the background and card.
- Neighbour or comparison series are labelled as comparisons; indoor metrics have none.

### Tests
`buildMetricHistoryChartOption.test.ts` covers series count, chart type, unit label and comparison
series; component tests cover loading, empty and error states and that controls call back.

### Charts: must not
- Add a second chart library or a per-metric chart implementation.
- Use a deprecated ECharts API (the project is on ECharts 6).
