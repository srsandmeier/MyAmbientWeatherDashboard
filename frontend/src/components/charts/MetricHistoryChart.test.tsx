import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricHistoryChart } from './MetricHistoryChart';
import { ThemeProvider, useTheme } from '../../providers/ThemeProvider';

interface MockOption {
  readonly animation?: boolean;
  readonly aria?: { readonly label?: { readonly description?: string } };
  readonly series?: readonly unknown[];
  readonly color?: readonly string[];
  readonly textStyle?: { readonly color?: string };
}

vi.mock('echarts-for-react', () => ({
  default: ({ option }: { readonly option: MockOption }) => (
    <div
      data-test-id="mock-echarts"
      data-animation={String(option.animation ?? true)}
      data-color={option.color?.join(',') ?? ''}
      data-text-color={option.textStyle?.color ?? ''}
    >
      {option.aria?.label?.description} {option.series?.length.toString()}
    </div>
  ),
}));

const POINTS = [{ timestampUtc: '2026-06-01T12:00:00Z', value: 72.4 }];

function setupMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && prefersReducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

beforeEach(() => {
  setupMatchMedia(false);
});

describe('MetricHistoryChart', () => {
  it('renders the ECharts wrapper with an accessible option description', () => {
    render(
      <MetricHistoryChart
        metricLabel="Outdoor Temperature"
        unit="F"
        category="scalar"
        points={POINTS}
      />,
    );

    expect(screen.getByTestId('metric-detail-chart')).toBeInTheDocument();
    expect(screen.getByTestId('mock-echarts')).toHaveTextContent('Outdoor Temperature history chart with 1 series and 1 primary point.');
  });

  it('passes comparison series into the chart option', () => {
    render(
      <MetricHistoryChart
        metricLabel="Outdoor Temperature"
        unit="F"
        category="scalar"
        points={POINTS}
        comparisonSeries={[{ name: 'Other Station', points: [{ timestampUtc: '2026-06-01T12:00:00Z', value: 71 }] }]}
      />,
    );

    expect(screen.getByTestId('mock-echarts')).toHaveTextContent('2');
  });

  it('enables animations when prefers-reduced-motion is not active', () => {
    setupMatchMedia(false);
    render(<MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={POINTS} />);

    expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-animation', 'true');
  });

  it('disables animations when prefers-reduced-motion is active', () => {
    setupMatchMedia(true);
    render(<MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={POINTS} />);

    expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-animation', 'false');
  });

  describe('theme colours', () => {
    let themeStyle: HTMLStyleElement;

    beforeEach(() => {
      // Light tokens on :root, dark tokens under .dark, as in index.css.
      themeStyle = document.createElement('style');
      themeStyle.textContent = [
        ':root { --chart-1: oklch(0 0 0); --chart-2: oklch(0 0 0); --chart-3: oklch(0 0 0); --muted-foreground: oklch(0 0 0); --border: oklch(0 0 0); --popover: oklch(1 0 0); --popover-foreground: oklch(0 0 0); }',
        '.dark { --chart-1: oklch(1 0 0); --muted-foreground: oklch(1 0 0); }',
      ].join('\n');
      document.head.appendChild(themeStyle);
    });

    afterEach(() => {
      themeStyle.remove();
      document.documentElement.classList.remove('dark');
    });

    it('passes the theme tokens to the chart as rgb() colours, never CSS variables', () => {
      render(<MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={POINTS} />);

      const chart = screen.getByTestId('mock-echarts');
      expect(chart).toHaveAttribute('data-color', 'rgb(0, 0, 0),rgb(0, 0, 0),rgb(0, 0, 0)');
      expect(chart).toHaveAttribute('data-text-color', 'rgb(0, 0, 0)');
    });

    it('picks up the colours on the next render when the stylesheet is applied after the first', () => {
      themeStyle.remove();
      const { rerender } = render(<MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={POINTS} />);
      expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-color', '');

      document.head.appendChild(themeStyle);
      rerender(<MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={[...POINTS]} />);

      expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-color', 'rgb(0, 0, 0),rgb(0, 0, 0),rgb(0, 0, 0)');
    });

    it('draws the dark colours in the same render that ThemeProvider switches to dark', () => {
      function ThemeSwitch() {
        const { setTheme } = useTheme();
        return <button type="button" data-test-id="switch-dark" onClick={() => { setTheme('dark'); }}>dark</button>;
      }
      render(
        <ThemeProvider>
          <ThemeSwitch />
          <MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={POINTS} />
        </ThemeProvider>,
      );
      expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-text-color', 'rgb(0, 0, 0)');

      fireEvent.click(screen.getByTestId('switch-dark'));

      expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-text-color', 'rgb(255, 255, 255)');
      expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-color', 'rgb(255, 255, 255),rgb(0, 0, 0),rgb(0, 0, 0)');
    });

    it('reads the colours again when the dark class is applied after the chart rendered', async () => {
      render(<MetricHistoryChart metricLabel="Temperature" unit="F" category="scalar" points={POINTS} />);

      act(() => { document.documentElement.classList.add('dark'); });

      await waitFor(() => {
        expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-color', 'rgb(255, 255, 255),rgb(0, 0, 0),rgb(0, 0, 0)');
      });
      expect(screen.getByTestId('mock-echarts')).toHaveAttribute('data-text-color', 'rgb(255, 255, 255)');
    });
  });
});
