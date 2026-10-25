import { readThemeColor } from '../../lib/themeColors';
import type { MetricHistoryChartPalette } from './buildMetricHistoryChartOption';

const SERIES_TOKENS = ['chart-1', 'chart-2', 'chart-3'] as const;

/**
 * Reads the chart colours from the theme tokens applied to the document. `theme` is the theme applied
 * right now (`useAppliedTheme`): call this again when it changes. Undefined when a token is missing
 * (for example in tests that do not load index.css), so the chart falls back to ECharts defaults.
 */
export function readMetricHistoryChartPalette(theme: 'light' | 'dark'): MetricHistoryChartPalette | undefined {
  const series = SERIES_TOKENS.map((token) => readThemeColor(token)).filter((color): color is string => color !== undefined);
  const text = readThemeColor('muted-foreground');
  const line = readThemeColor('border');
  const tooltipBackground = readThemeColor('popover');
  const tooltipText = readThemeColor('popover-foreground');
  if (series.length !== SERIES_TOKENS.length || !text || !line || !tooltipBackground || !tooltipText) return undefined;
  return { theme, series, text, line, tooltipBackground, tooltipText };
}
