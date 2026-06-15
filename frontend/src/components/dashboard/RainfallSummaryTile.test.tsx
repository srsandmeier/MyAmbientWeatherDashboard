import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { RainfallSummaryTile } from './RainfallSummaryTile';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import type { DashboardRainfallDto } from '../../types/dashboard';
import { testDeviceId, testDeviceName } from '../../test/weatherTestData';

describe('RainfallSummaryTile', () => {
  it('renders rainfall values using the selected rainfall unit', () => {
    renderWithRouter(
      <RainfallSummaryTile
        rainfall={rainfall}
        preferences={{ ...DEFAULT_USER_PREFERENCES, rainfallUnit: 'mm', dateFormat: 'iso' }}
      />,
    );

    expect(screen.getByTestId('dashboard-rainfall-summary-tile')).toHaveTextContent('Rainfall');
    expect(screen.getAllByTestId('dashboard-rainfall-value')[0]).toHaveTextContent('3.05 mm');
    expect(screen.getByTestId('dashboard-rainfall-last-rain')).toHaveTextContent('2026-05-30');
  });

  it('shows a clear error state when rainfall cannot load', () => {
    renderWithRouter(
      <RainfallSummaryTile
        rainfall={undefined}
        preferences={DEFAULT_USER_PREFERENCES}
        isError
      />,
    );

    expect(screen.getByTestId('dashboard-rainfall-error')).toHaveTextContent('Rainfall is unavailable.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithRouter(
      <RainfallSummaryTile rainfall={rainfall} preferences={DEFAULT_USER_PREFERENCES} />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('links selected rainfall values to metric history for owned stations', () => {
    renderWithRouter(
      <RainfallSummaryTile
        rainfall={rainfall}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['rainfall_day']}
        historyDeviceId={testDeviceId}
      />,
    );

    expect(screen.getByTestId('dashboard-metric-history-link')).toHaveAttribute(
      'href',
      `/metrics/rainfall_day?deviceId=${encodeURIComponent(testDeviceId)}`,
    );
  });
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const rainfall: DashboardRainfallDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  timestampUtc: '2026-06-01T12:00:00Z',
  receivedAtUtc: '2026-06-01T12:00:05Z',
  eventRainIn: 0.12,
  dailyRainIn: 0.2,
  weeklyRainIn: 1.2,
  monthlyRainIn: 2.3,
  yearlyRainIn: 10.5,
  lastRain: '2026-05-30T09:00:00Z',
};
