import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricDetailPage } from './MetricDetailPage';
import { testDeviceId, testDeviceName } from '../test/weatherTestData';
import type { UseMetricHistoryResult } from '../hooks/useMetricHistory';
import type { UseSettingsDevicesResult } from '../hooks/useSettingsDevices';
import type { UseSettingsPreferencesResult } from '../hooks/useSettingsPreferences';
import type { MetricHistoryResponse } from '../types/metrics';

const mockUseMetricHistory = vi.fn<(
  metricKey: string | undefined,
  params: unknown,
  options?: unknown,
) => UseMetricHistoryResult>();

const mockUseSettingsDevices = vi.fn<() => UseSettingsDevicesResult>();
const mockUseSettingsPreferences = vi.fn<() => UseSettingsPreferencesResult>();
const comparisonDeviceId = '123456ABCDEF';
const comparisonDeviceName = 'Generated comparison station';

vi.mock('../hooks/useMetricHistory', () => ({
  useMetricHistory: (metricKey: string | undefined, params: unknown, options?: unknown) =>
    mockUseMetricHistory(metricKey, params, options),
}));

vi.mock('../hooks/useSettingsDevices', () => ({
  useSettingsDevices: () => mockUseSettingsDevices(),
}));

vi.mock('../hooks/useSettingsPreferences', () => ({
  useSettingsPreferences: () => mockUseSettingsPreferences(),
}));

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="mock-echarts" />,
}));

const HISTORY: MetricHistoryResponse = {
  metricKey: 'outdoor_temp',
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  range: '24h',
  fromUtc: '2026-06-01T00:00:00Z',
  toUtc: '2026-06-02T00:00:00Z',
  granularity: 'raw',
  unit: 'F',
  points: [
    { timestampUtc: '2026-06-01T12:00:00Z', value: 72.4 },
    { timestampUtc: '2026-06-01T13:00:00Z', value: null },
  ],
  warnings: [],
};

describe('MetricDetailPage', () => {
  beforeEach(() => {
    mockUseMetricHistory.mockClear();
    mockUseSettingsDevices.mockClear();
    mockUseSettingsPreferences.mockClear();
    mockUseSettingsDevices.mockReturnValue({
      data: [{
        macAddress: testDeviceId,
        name: testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }, {
        macAddress: comparisonDeviceId,
        name: comparisonDeviceName,
        nickname: null,
        isPrimary: false,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseSettingsPreferences.mockReturnValue({
      data: {
        temperatureUnit: 'F',
        speedUnit: 'mph',
        pressureUnit: 'inhg',
        rainfallUnit: 'in',
        distanceUnit: 'mi',
        theme: 'system',
        dateFormat: 'mdy',
        temperatureDecimals: 1,
        dailyExtremaTimezone: 'local',
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseMetricHistory.mockReturnValue(makeHistoryResult({ data: HISTORY }));
  });

  it('renders history controls, chart, and collapsed data table for a supported metric', () => {
    renderPage('/metrics/outdoor_temp');

    expect(screen.getByTestId('metric-detail-title')).toHaveTextContent('Outdoor Temperature');
    expect(screen.getByTestId('metric-detail-view-mode')).toHaveValue('rolling');
    expect(screen.getByTestId('metric-detail-range')).toHaveValue('24h');
    expect(screen.getByTestId('metric-detail-day')).toHaveTextContent('Today');
    expect(screen.queryByTestId('metric-detail-date')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-detail-granularity')).toHaveValue('auto');
    expect(screen.getByTestId('metric-detail-device')).toHaveTextContent(testDeviceName);
    expect(screen.getByTestId('metric-detail-chart')).toBeInTheDocument();
    // table section is always present; content is hidden until toggled
    expect(screen.getByTestId('metric-detail-history-table')).toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-history-table-content')).not.toBeInTheDocument();
  });

  it('expands data table to show history values when toggle is clicked', () => {
    renderPage('/metrics/outdoor_temp');

    fireEvent.click(screen.getByTestId('metric-detail-history-table-toggle'));

    const values = screen.getAllByTestId('metric-detail-history-value').map((cell) => cell.textContent);
    expect(values).toContain('72.4 F');
    expect(values).toContain('—');
  });

  it('updates query params when controls change', () => {
    renderPage('/metrics/outdoor_temp');

    fireEvent.change(screen.getByTestId('metric-detail-day'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByTestId('metric-detail-date'), { target: { value: '2026-06-02' } });
    fireEvent.change(screen.getByTestId('metric-detail-granularity'), { target: { value: 'hour' } });
    fireEvent.change(screen.getByTestId('metric-detail-device'), { target: { value: testDeviceId } });

    expectMetricHistoryCalledWith(
      'outdoor_temp',
      expect.objectContaining({
        range: 'date',
        date: '2026-06-02',
        granularity: 'hour',
        deviceId: testDeviceId,
        source: 'my',
      }),
      { enabled: true },
    );
  });

  it('lets users choose a recent day directly from a preset range', () => {
    renderPage('/metrics/outdoor_temp');

    const daySelect = screen.getByTestId('metric-detail-day');
    expect(daySelect).toBeInstanceOf(HTMLSelectElement);
    const todayValue = daySelect instanceof HTMLSelectElement ? daySelect.value : '';
    expect(screen.getByTestId('metric-detail-range')).toHaveValue('24h');

    fireEvent.change(screen.getByTestId('metric-detail-day'), { target: { value: todayValue } });

    expect(screen.getByTestId('metric-detail-view-mode')).toHaveValue('day');
    expectMetricHistoryCalledWith(
      'outdoor_temp',
      expect.objectContaining({
        range: 'date',
        date: todayValue,
        source: 'my',
      }),
      { enabled: true },
    );
  });

  it('reveals a custom date picker from the day dropdown', () => {
    renderPage('/metrics/outdoor_temp');

    fireEvent.change(screen.getByTestId('metric-detail-day'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByTestId('metric-detail-date'), { target: { value: '2026-06-02' } });

    expect(screen.getByTestId('metric-detail-view-mode')).toHaveValue('day');
    expectMetricHistoryCalledWith(
      'outdoor_temp',
      expect.objectContaining({
        range: 'date',
        date: '2026-06-02',
        source: 'my',
      }),
      { enabled: true },
    );
  });

  it('fetches and displays an owned-station comparison overlay when selected', () => {
    renderPage('/metrics/outdoor_temp');

    fireEvent.change(screen.getByTestId('metric-detail-comparison-device'), { target: { value: comparisonDeviceId } });

    expectMetricHistoryCalledWith(
      'outdoor_temp',
      expect.objectContaining({
        range: '24h',
        deviceId: comparisonDeviceId,
        source: 'my',
      }),
      { enabled: true },
    );
    expect(screen.getByTestId('metric-detail-overlay-state')).toHaveTextContent(testDeviceName);
  });

  it('renders warnings returned with history data', () => {
    mockUseMetricHistory.mockReturnValue(makeHistoryResult({
      data: { ...HISTORY, warnings: ['Generated warning.'] },
    }));

    renderPage('/metrics/outdoor_temp');

    const warnings = screen.getByTestId('metric-detail-warnings');
    expect(warnings).toHaveTextContent('1 warning');
    expect(warnings).toHaveTextContent('Generated warning.');
    expect(warnings).toHaveAttribute('role', 'status');
    expect(warnings).toHaveAttribute('aria-live', 'polite');
    expect(warnings).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders empty state when no points are returned', () => {
    mockUseMetricHistory.mockReturnValue(makeHistoryResult({ data: { ...HISTORY, points: [] } }));

    renderPage('/metrics/outdoor_temp');

    expect(screen.getByTestId('metric-detail-empty-title')).toHaveTextContent('No chartable outdoor temperature history found.');
    expect(screen.getByTestId('metric-detail-empty-description')).toHaveTextContent('sensor is missing or offline');
  });

  it('renders retryable error state', () => {
    const refetch = vi.fn();
    mockUseMetricHistory.mockReturnValue(makeHistoryResult({
      data: undefined,
      isError: true,
      error: new Error('Generated failure'),
      refetch,
    }));

    renderPage('/metrics/outdoor_temp');

    expect(screen.getByTestId('metric-detail-error')).toHaveTextContent('Generated failure');
    fireEvent.click(screen.getByTestId('metric-detail-retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders back link pointing to the dashboard root', () => {
    renderPage('/metrics/outdoor_temp');

    const link = screen.getByTestId('metric-detail-back-link');
    expect(link).toHaveTextContent('Back to dashboard');
    expect(link).toHaveAttribute('href', '/');
  });

  it('uses the saved timezone preference without rendering an in-page timezone toggle', () => {
    mockUseSettingsPreferences.mockReturnValue({
      data: {
        temperatureUnit: 'F',
        speedUnit: 'mph',
        pressureUnit: 'inhg',
        rainfallUnit: 'in',
        distanceUnit: 'mi',
        theme: 'system',
        dateFormat: 'mdy',
        temperatureDecimals: 1,
        dailyExtremaTimezone: 'utc',
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage('/metrics/outdoor_temp');

    expect(screen.queryByTestId('metric-detail-timezone-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-timezone-utc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-timezone-local')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-detail-history-context')).toHaveTextContent('UTC');
  });

  it('removes mock stations from comparison options', () => {
    mockUseSettingsDevices.mockReturnValue({
      data: [{
        macAddress: testDeviceId,
        name: testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }, {
        macAddress: 'mock-runtime-1',
        name: 'Mock Station',
        nickname: null,
        isPrimary: false,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
        isMock: true,
      }, {
        macAddress: 'mock-runtime-2',
        name: 'Mock Station 2',
        nickname: null,
        isPrimary: false,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }, {
        macAddress: comparisonDeviceId,
        name: comparisonDeviceName,
        nickname: null,
        isPrimary: false,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage('/metrics/outdoor_temp');

    const compare = screen.getByTestId('metric-detail-comparison-device');
    expect(compare).toHaveTextContent(comparisonDeviceName);
    expect(compare).not.toHaveTextContent('Mock Station');
    expect(compare).not.toHaveTextContent('Mock Station 2');
  });

  it('hides comparison controls when there is no other owned station', () => {
    mockUseSettingsDevices.mockReturnValue({
      data: [{
        macAddress: testDeviceId,
        name: testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: null,
        longitude: null,
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage('/metrics/outdoor_temp');

    expect(screen.queryByTestId('metric-detail-comparison-device')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-overlay-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-detail-provider-overlay-state')).not.toBeInTheDocument();
  });

  it('does not fetch unsupported metric keys', () => {
    renderPage('/metrics/not_real');

    expect(screen.getByTestId('metric-detail-invalid')).toHaveTextContent('not supported');
    expectMetricHistoryCalledWith(
      'not_real',
      expect.objectContaining({ range: '24h', source: 'my' }),
      { enabled: false },
    );
  });

  it('shows unsupported state for text metrics', () => {
    renderPage('/metrics/nws_text_description');

    expect(screen.getByTestId('metric-detail-unsupported')).toHaveTextContent('does not have chartable history');
    expectMetricHistoryCalledWith(
      'nws_text_description',
      expect.objectContaining({ range: '24h', source: 'my' }),
      { enabled: false },
    );
  });

  it('shows unsupported state for Open-Meteo current-only metrics instead of fetching history', () => {
    renderPage('/metrics/om_cloud_cover');

    expect(screen.getByTestId('metric-detail-unsupported')).toHaveTextContent('does not have chartable history');
    expectMetricHistoryCalledWith(
      'om_cloud_cover',
      expect.objectContaining({ range: '24h', source: 'my' }),
      { enabled: false },
    );
  });
});

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/metrics/:metricKey" element={<MetricDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectMetricHistoryCalledWith(
  metricKey: string | undefined,
  params: unknown,
  options?: unknown,
) {
  expect(mockUseMetricHistory).toHaveBeenCalledWith(metricKey, params, options);
}

function makeHistoryResult(overrides: Partial<UseMetricHistoryResult> = {}): UseMetricHistoryResult {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}
