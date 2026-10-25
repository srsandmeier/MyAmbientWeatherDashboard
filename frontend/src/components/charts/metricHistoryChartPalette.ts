import { readThemeColor } from '../../lib/themeColors';
import type { MetricHistoryChartPalette } from './buildMetricHistoryChartOption';

const SERIES_TOKENS = ['chart-1', 'chart-2', 'chart-3'] as const;

/**
 * Reads the chart colours from the theme tokens applied to the document, with one style lookup. Undefined
 * when a token is missing (a stylesheet not applied yet, or a test that does not load index.css), so the
 * chart keeps ECharts defaults and reads again on its next render.
 */
export function readMetricHistoryChartPalette(root: Element = document.documentElement): MetricHistoryChartPalette | undefined {
  const style = getComputedStyle(root);
  const series = SERIES_TOKENS.map((token) => readThemeColor(style, token)).filter((color): color is string => color !== undefined);
  const text = readThemeColor(style, 'muted-foreground');
  const line = readThemeColor(style, 'border');
  const tooltipBackground = readThemeColor(style, 'popover');
  const tooltipText = readThemeColor(style, 'popover-foreground');
  if (series.length !== SERIES_TOKENS.length || !text || !line || !tooltipBackground || !tooltipText) return undefined;
  return { series, text, line, tooltipBackground, tooltipText };
}
