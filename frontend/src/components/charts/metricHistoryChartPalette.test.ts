import { afterEach, describe, expect, it } from 'vitest';
import { readMetricHistoryChartPalette } from './metricHistoryChartPalette';

const TOKENS = {
  'chart-1': 'oklch(0.5 0.17 255)',
  'chart-2': 'oklch(0.55 0.15 45)',
  'chart-3': 'oklch(0.5 0.12 160)',
  'muted-foreground': 'oklch(0 0 0)',
  border: 'oklch(0.6 0 0)',
  popover: 'oklch(1 0 0)',
  'popover-foreground': 'oklch(0 0 0)',
};

function setTokens(tokens: Record<string, string>) {
  for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(`--${name}`, value);
}

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('readMetricHistoryChartPalette', () => {
  it('reads every chart colour from the theme tokens as rgb()', () => {
    setTokens(TOKENS);
    const palette = readMetricHistoryChartPalette('light');

    expect(palette).toMatchObject({
      theme: 'light',
      text: 'rgb(0, 0, 0)',
      line: 'rgb(128, 128, 128)',
      tooltipBackground: 'rgb(255, 255, 255)',
      tooltipText: 'rgb(0, 0, 0)',
    });
    expect(palette?.series).toHaveLength(3);
    for (const color of palette?.series ?? []) expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('is undefined when any token is missing, so the chart keeps ECharts defaults', () => {
    const { 'chart-3': _missing, ...rest } = TOKENS;
    setTokens(rest);
    expect(readMetricHistoryChartPalette('dark')).toBeUndefined();
  });
});
