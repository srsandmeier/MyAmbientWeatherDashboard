# Agent: Charts (Apache ECharts)

Handles metric detail views: `frontend/src/components/charts/` and the backend history
query that feeds them.

---

## Stack

| Package | Licence | Purpose |
|---|---|---|
| echarts 6.x | Apache 2.0 | Chart engine |
| echarts-for-react 3.x | MIT | React wrapper |

ScottPlot and other desktop chart libraries are **not** used in this webapp.

---

## Scope

| In scope | Out of scope (v1) |
|---|---|
| Line, area, bar charts | 3D, map overlays |
| Time-range presets + custom picker | Real-time scrolling charts |
| dataZoom (slider + brush) | Annotations / drawing tools |
| Neighbour comparison overlay | Multi-metric combined charts |
| PNG + CSV export | PDF export |

---

## Page flow

```
/metrics/:metricKey
  → useMetricHistory(metricKey, { range, granularity, source })
  → GET /api/metrics/{key}/history?range=7d&source=my|neighbours
  → ChartPanel renders ECharts option object
  → ChartControls updates query params → refetch
```

---

## Chart controls (user customization)

| Control | Options | Persistence |
|---|---|---|
| Time range | 24h, 7d, 30d, 90d, 1y, custom | Session storage initially |
| Granularity | Auto or manual (5m / 1h / 1d) | Session storage |
| Chart type | line, area, bar (default bar for rain) | Session storage |
| Comparison | Overlay neighbour average series | Tied to dashboard neighbour toggle |
| Y-axis | Auto or fixed min/max | Session storage |
| Export | PNG (ECharts `getDataURL`), CSV (from series data) | N/A |

Drive chart type defaults from metric config — rainfall metrics default to bar; others to line.

---

## ECharts option builder (DRY)

Centralize option construction in `buildChartOption.ts`:

```typescript
export function buildChartOption(config: ChartConfig): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    dataZoom: [{ type: 'inside' }, { type: 'slider' }],
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: config.unitLabel },
    series: config.series.map(s => ({
      name: s.label,
      type: config.chartType,
      data: s.points,
      areaStyle: config.chartType === 'area' ? {} : undefined,
    })),
  };
}
```

Do not duplicate ECharts config across metric pages.

---

## Backend history response shape

```typescript
interface MetricHistoryDto {
  metricKey: string;
  unit: string;
  granularity: '5m' | '1h' | '1d';
  series: {
    label: string;       // "My station" | "Neighbour average"
    points: { t: string; v: number | null }[];
  }[];
  warning?: string;      // e.g. "Only 2 of 10 stations had UV data"
}
```

Backend selects from cached history data or aggregates based on range/granularity — never calls Ambient
live for chart requests.

---

## Neighbour overlay

When `source=neighbours` or comparison toggle is on:

- Primary series: user's station (if applicable).
- Secondary series: aggregated neighbour values (mean/median from config) when the selected provider
  supports the requested time range.
- Historical neighbour overlays are deferred until a provider supports historical observations or the app
  has cached enough neighbour samples over time.
- Indoor metrics: no neighbour series — show message instead.

---

## Theming

- Read chart colours from CSS variables (`hsl(var(--chart-1))`, etc.) — match shadcn theme.
- Support dark mode by passing theme tokens into `buildChartOption`.
- No hardcoded hex colours in chart components.

---

## Testing (required)

| Target | Tool |
|---|---|
| `buildChartOption` | Vitest: correct series count, chart type, unit label |
| `ChartControls` | RTL: changing range triggers callback/refetch |
| `ChartPanel` | RTL: loading skeleton, empty state, error state |
| History API | xUnit integration: range query returns correct bucket count |

---

## Must NOT do

- Fetch Ambient directly from chart components.
- Create a separate chart implementation per metric — use `buildChartOption`.
- Use deprecated ECharts APIs — refer to ECharts 6.x docs.
- Block render on full history download — show skeleton via TanStack Query `isLoading`.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name anywhere — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
