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
- ECharts draws on a canvas, so a series colour must be a resolved colour value: a CSS `var(...)` is not
  read. Resolve theme tokens from the document before building the option, for light and dark.
  Known gap: the builder still passes `hsl(var(--chart-1))`, and `--chart-*` is not defined in
  `frontend/src/index.css`.
- Neighbour or comparison series are labelled as comparisons; indoor metrics have none.

### Tests
`buildMetricHistoryChartOption.test.ts` covers series count, chart type, unit label and comparison
series; component tests cover loading, empty and error states and that controls call back.

### Charts: must not
- Add a second chart library or a per-metric chart implementation.
- Use a deprecated ECharts API (the project is on ECharts 6).
