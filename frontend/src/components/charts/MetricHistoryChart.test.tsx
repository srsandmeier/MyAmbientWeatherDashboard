import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricHistoryChart } from './MetricHistoryChart';

interface MockOption {
  readonly animation?: boolean;
  readonly aria?: { readonly label?: { readonly description?: string } };
  readonly series?: readonly unknown[];
}

vi.mock('echarts-for-react', () => ({
  default: ({ option }: { readonly option: MockOption }) => (
    <div
      data-test-id="mock-echarts"
      data-animation={String(option.animation ?? true)}
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
});
