import { describe, expect, it } from 'vitest';
import { buildMetricHistoryChartOption } from './buildMetricHistoryChartOption';

const POINTS = [
  { timestampUtc: '2026-06-01T12:00:00Z', value: 72.4 },
  { timestampUtc: '2026-06-01T13:00:00Z', value: null },
];

const TS_12 = new Date('2026-06-01T12:00:00Z').getTime();
const TS_13 = new Date('2026-06-01T13:00:00Z').getTime();

describe('buildMetricHistoryChartOption', () => {
  it('builds a line chart with dataZoom and aria for scalar metrics', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
    });

    expect(option.aria).toMatchObject({
      enabled: true,
      label: { description: 'Outdoor Temperature history chart with 1 series and 2 primary points.' },
    });
    expect(option.dataZoom).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'inside' }),
      expect.objectContaining({ type: 'slider' }),
    ]));
    expect(option.series).toEqual([
      expect.objectContaining({
        name: 'Outdoor Temperature',
        type: 'line',
        smooth: true,
      }),
    ]);
  });

  it('defaults rainfall metrics to bar charts', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Daily Rainfall',
      unit: 'in',
      category: 'rainfall',
      points: POINTS,
    });

    expect(option.series).toEqual([
      expect.objectContaining({
        type: 'bar',
      }),
    ]);
  });

  it('supports area charts when requested', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
      chartType: 'area',
    });

    expect(option.series).toEqual([
      expect.objectContaining({
        type: 'line',
        areaStyle: {},
      }),
    ]);
  });

  it('enables animations by default', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
    });

    expect(option.animation).toBe(true);
  });

  it('disables animations when reduceMotion is true', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
      reduceMotion: true,
    });

    expect(option.animation).toBe(false);
  });

  it('adds comparison overlay series with matching chart type', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
      comparisonSeries: [{ name: 'Other Station', points: [{ timestampUtc: '2026-06-01T12:00:00Z', value: 71 }] }],
    });

    expect(option.series).toHaveLength(2);
    expect(option.series).toEqual([
      expect.objectContaining({ name: 'Outdoor Temperature', type: 'line' }),
      expect.objectContaining({ name: 'Other Station', type: 'line' }),
    ]);
  });

  it('uses numeric millisecond timestamps in series data for local timezone', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
      timezone: 'local',
    });

    const series = option.series as { data: [number, number | null][] }[];
    expect(series[0].data).toEqual([
      [TS_12, 72.4],
      [TS_13, null],
    ]);
  });

  it('shifts timestamps by UTC offset when timezone is utc so ECharts displays UTC values', () => {
    const option = buildMetricHistoryChartOption({
      metricLabel: 'Outdoor Temperature',
      unit: 'F',
      category: 'scalar',
      points: POINTS,
      timezone: 'utc',
    });

    const series = option.series as { data: [number, number | null][] }[];
    const offsetMs = new Date('2026-06-01T12:00:00Z').getTimezoneOffset() * 60_000;
    expect(series[0].data).toEqual([
      [TS_12 + offsetMs, 72.4],
      [TS_13 + offsetMs, null],
    ]);
  });
});
