import { useMemo, useState, useSyncExternalStore } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  buildMetricHistoryChartOption,
  type MetricHistoryChartType,
  type MetricHistoryComparisonSeries,
} from './buildMetricHistoryChartOption';
import { readMetricHistoryChartPalette } from './metricHistoryChartPalette';
import { useResolvedTheme } from '../../providers/ThemeProvider';
import type { MetricCategory, MetricHistoryPoint } from '../../types/metrics';

function subscribeToReducedMotion(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => { mq.removeEventListener('change', callback); };
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface MetricHistoryChartProps {
  readonly metricLabel: string;
  readonly unit: string;
  readonly category: MetricCategory;
  readonly points: readonly MetricHistoryPoint[];
  readonly comparisonSeries?: readonly MetricHistoryComparisonSeries[];
  readonly chartType?: MetricHistoryChartType;
  readonly timezone?: 'utc' | 'local';
}

/** ECharts metric history panel. */
export function MetricHistoryChart({
  metricLabel,
  unit,
  category,
  points,
  comparisonSeries,
  chartType,
  timezone = 'local',
}: MetricHistoryChartProps) {
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  // The canvas cannot read CSS variables, so the theme colours are read from the document: again when the
  // theme changes (ThemeProvider applies the class before this renders), and on each render while a token
  // is still missing (a stylesheet applied late). Adjusting state during render keeps the palette stable.
  const theme = useResolvedTheme();
  const [read, setRead] = useState(() => ({ theme, palette: readMetricHistoryChartPalette() }));
  if (read.theme !== theme || read.palette === undefined) {
    const palette = readMetricHistoryChartPalette();
    if (read.theme !== theme || palette !== undefined) setRead({ theme, palette });
  }
  const { palette } = read;
  const option = useMemo(
    () => buildMetricHistoryChartOption({ metricLabel, unit, category, points, comparisonSeries, chartType, reduceMotion, timezone, palette }),
    [category, chartType, comparisonSeries, metricLabel, palette, points, reduceMotion, timezone, unit],
  );

  return (
    <div className="min-h-72 rounded-md border border-border bg-background p-2" data-test-id="metric-detail-chart">
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        style={{ height: 320, width: '100%' }}
        aria-label={`${metricLabel} history chart`}
      />
    </div>
  );
}
