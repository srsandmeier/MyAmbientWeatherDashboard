import type { EChartsOption } from 'echarts';
import type { MetricCategory, MetricHistoryPoint } from '../../types/metrics';

export type MetricHistoryChartType = 'line' | 'area' | 'bar';

export interface BuildMetricHistoryChartOptionInput {
  readonly metricLabel: string;
  readonly unit: string;
  readonly category: MetricCategory;
  readonly points: readonly MetricHistoryPoint[];
  readonly comparisonSeries?: readonly MetricHistoryComparisonSeries[];
  readonly chartType?: MetricHistoryChartType;
  /** When true, all ECharts animations are disabled (e.g. prefers-reduced-motion). */
  readonly reduceMotion?: boolean;
  /** Controls how timestamps are displayed on the chart. Defaults to 'utc'. */
  readonly timezone?: 'utc' | 'local';
}

export interface MetricHistoryComparisonSeries {
  readonly name: string;
  readonly points: readonly MetricHistoryPoint[];
}

/** Builds the shared ECharts option used by metric history charts. */
export function buildMetricHistoryChartOption({
  metricLabel,
  unit,
  category,
  points,
  comparisonSeries = [],
  chartType,
  reduceMotion = false,
  timezone = 'local',
}: BuildMetricHistoryChartOptionInput): EChartsOption {
  const resolvedChartType = chartType ?? (category === 'rainfall' ? 'bar' : 'line');
  const seriesType = resolvedChartType === 'bar' ? 'bar' : 'line';
  const totalSeries = 1 + comparisonSeries.length;
  const ariaDescription = `${metricLabel} history chart with ${totalSeries.toString()} series and ${points.length.toString()} primary point${points.length === 1 ? '' : 's'}.`;

  return {
    animation: !reduceMotion,
    aria: {
      enabled: true,
      label: {
        description: ariaDescription,
      },
    },
    color: ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'],
    grid: {
      left: 48,
      right: 24,
      top: 36,
      bottom: 64,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => formatTooltipValue(value, unit),
    },
    dataZoom: [
      { type: 'inside', throttle: 50 },
      { type: 'slider', height: 28, bottom: 16 },
    ],
    xAxis: {
      type: 'time',
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameGap: 12,
    },
    series: [
      buildSeries(metricLabel, points, seriesType, resolvedChartType, timezone),
      ...comparisonSeries.map((series) => buildSeries(series.name, series.points, seriesType, resolvedChartType, timezone)),
    ],
  };
}

/** Converts ISO UTC timestamps to display milliseconds.
 * In UTC mode, timestamps are shifted by the local UTC offset so ECharts renders UTC values
 * even though it formats timestamps in local time internally. */
function toDisplayMs(isoString: string, timezone: 'utc' | 'local'): number {
  const d = new Date(isoString);
  return timezone === 'utc'
    ? d.getTime() + d.getTimezoneOffset() * 60_000
    : d.getTime();
}

function buildSeries(
  name: string,
  points: readonly MetricHistoryPoint[],
  seriesType: 'line' | 'bar',
  resolvedChartType: MetricHistoryChartType,
  timezone: 'utc' | 'local' = 'utc',
) {
  const data: [number, number | null][] = points.map((point) => [toDisplayMs(point.timestampUtc, timezone), point.value]);

  if (seriesType === 'bar') {
    return {
      name,
      type: 'bar' as const,
      emphasis: { focus: 'series' as const },
      data,
    };
  }

  return {
    name,
    type: 'line' as const,
    smooth: true,
    connectNulls: false,
    areaStyle: resolvedChartType === 'area' ? {} : undefined,
    emphasis: { focus: 'series' as const },
    data,
  };
}

function formatTooltipValue(value: unknown, unit: string): string {
  if (value == null || value === '') return 'No data';
  const rawValue: unknown = Array.isArray(value) ? (value as readonly unknown[])[1] : value;
  const text = typeof rawValue === 'number' || typeof rawValue === 'string' || typeof rawValue === 'boolean'
    ? String(rawValue)
    : 'No data';
  return unit.length > 0 ? `${text} ${unit}` : text;
}
