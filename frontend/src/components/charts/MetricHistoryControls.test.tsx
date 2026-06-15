import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetricHistoryControls } from './MetricHistoryControls';
import { buildRecentDayOptions } from '../../lib/recentDays';

const recentDayOptions = [
  { value: '2026-06-10', label: 'Today' },
  { value: '2026-06-09', label: 'Yesterday' },
];

const stationOptions = [
  { value: 'ABCDEF123456', label: 'Station A' },
  { value: '123456ABCDEF', label: 'Station B' },
];

describe('MetricHistoryControls', () => {
  it('renders rolling controls without idle overlay placeholder states', () => {
    renderControls();

    expect(screen.getByTestId('metric-detail-control-panel')).toBeInTheDocument();
    expect(screen.getByTestId('metric-detail-view-mode')).toHaveValue('rolling');
    expect(screen.getByTestId('metric-detail-range')).toHaveValue('24h');
    expect(screen.getByTestId('metric-detail-day')).toHaveTextContent('Today');
    expect(screen.queryByTestId('metric-detail-date')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-detail-comparison-device')).toHaveValue('');
    expect(screen.queryByTestId('metric-detail-overlay-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-provider-overlay-state')).not.toBeInTheDocument();
  });

  it('shows comparison status after a comparison station is selected', () => {
    renderControls({
      comparisonDeviceId: '123456ABCDEF',
      comparisonStatus: 'Comparing against Station B.',
    });

    expect(screen.getByTestId('metric-detail-overlay-state')).toHaveTextContent('Comparing against Station B.');
  });

  it('hides comparison controls when there are no comparison stations', () => {
    renderControls({
      showComparison: false,
      comparisonStationOptions: [],
    });

    expect(screen.queryByTestId('metric-detail-comparison-device')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-overlay-state')).not.toBeInTheDocument();
  });

  it('emits a single-day selection when a recent day is chosen', () => {
    const onDayChoiceChange = vi.fn();
    renderControls({ onDayChoiceChange });

    fireEvent.change(screen.getByTestId('metric-detail-day'), { target: { value: '2026-06-09' } });

    expect(onDayChoiceChange).toHaveBeenCalledWith('2026-06-09');
  });

  it('reveals the custom date picker only in custom day mode', () => {
    const onDateChange = vi.fn();
    renderControls({
      viewMode: 'day',
      dayChoice: 'custom',
      onDateChange,
    });

    fireEvent.change(screen.getByTestId('metric-detail-date'), { target: { value: '2026-06-02' } });

    expect(onDateChange).toHaveBeenCalledWith('2026-06-02');
  });

  it('emits comparison station changes', () => {
    const onComparisonDeviceChange = vi.fn();
    renderControls({ onComparisonDeviceChange });

    fireEvent.change(screen.getByTestId('metric-detail-comparison-device'), { target: { value: '123456ABCDEF' } });

    expect(onComparisonDeviceChange).toHaveBeenCalledWith('123456ABCDEF');
  });

  it('builds recent day labels from newest to oldest', () => {
    const options = buildRecentDayOptions();

    expect(options).toHaveLength(14);
    expect(options[0]?.label).toBe('Today');
    expect(options[1]?.label).toBe('Yesterday');
  });
});

function renderControls(overrides: Partial<Parameters<typeof MetricHistoryControls>[0]> = {}) {
  const props: Parameters<typeof MetricHistoryControls>[0] = {
    viewMode: 'rolling',
    range: '24h',
    dayChoice: '2026-06-10',
    date: '2026-06-10',
    granularity: 'auto',
    deviceId: '',
    recentDayOptions,
    stationOptions,
    comparisonDeviceId: '',
    comparisonStationOptions: stationOptions,
    comparisonStatus: 'Select another station to overlay matching history.',
    onViewModeChange: vi.fn(),
    onRangeChange: vi.fn(),
    onDayChoiceChange: vi.fn(),
    onDateChange: vi.fn(),
    onGranularityChange: vi.fn(),
    onDeviceChange: vi.fn(),
    onComparisonDeviceChange: vi.fn(),
    ...overrides,
  };

  return render(<MetricHistoryControls {...props} />);
}
