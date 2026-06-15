import { useMemo, useSyncExternalStore } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  buildMetricHistoryChartOption,
  type MetricHistoryChartType,
  type MetricHistoryComparisonSeries,
} from './buildMetricHistoryChartOption';
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
  const option = useMemo(
    () => buildMetricHistoryChartOption({ metricLabel, unit, category, points, comparisonSeries, chartType, reduceMotion, timezone }),
    [category, chartType, comparisonSeries, metricLabel, points, reduceMotion, timezone, unit],
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
