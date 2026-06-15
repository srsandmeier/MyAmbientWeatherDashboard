import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PinnedStationTileGroup } from './PinnedStationTileGroup';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import type { CurrentReadingDto } from '../../types/dashboard';

const mockReading: CurrentReadingDto = {
  deviceId: 'WeatherGov:KGEN',
  deviceName: 'Generated pinned station',
  timestampUtc: '2026-06-09T12:00:00Z',
  receivedAtUtc: '2026-06-09T12:00:01Z',
  tempF: 70.2,
  battOut: null,
  tempInF: null,
  feelsLike: 70.2,
  feelsLikeIn: null,
  dewPoint: 55.1,
  dewPointIn: null,
  humidity: 58,
  humidityIn: null,
  baromRelIn: 29.92,
  baromAbsIn: 29.81,
  windDir: 180,
  windSpeedMph: 8,
  windGustMph: 13,
  maxDailyGust: null,
  solarRadiation: null,
  uv: null,
  dailyHighTempF: 74,
  dailyLowTempF: 49,
  nwsSkyConditions: 'FEW @ 1,800ft',
  nwsPresentWeather: 'Light rain',
  nwsTextDescription: 'Generated weather description.',
  nwsRawMetar: 'KGEN 091200Z 18008KT 10SM -RA FEW018',
  hourlyRainIn: null,
  eventRainIn: null,
  dailyRainIn: null,
  weeklyRainIn: null,
  monthlyRainIn: null,
  yearlyRainIn: null,
  totalRainIn: null,
  lastRain: null,
  omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
  omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
  omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
  tz: 'UTC',
  source: 'neighbor',
};

vi.mock('../../hooks/usePinnedStationCurrent', () => ({
  usePinnedStationCurrent: () => ({
    data: mockReading,
    isPending: false,
    isError: false,
    isNotCached: false,
    refetch: vi.fn(),
  }),
}));

describe('PinnedStationTileGroup', () => {
  it('hides metric sections that have no selected metrics', () => {
    render(
      <MemoryRouter>
        <PinnedStationTileGroup
          pin={{
            provider: 'WeatherGov',
            sourceId: 'KGEN',
            displayLabel: 'Generated pinned station',
            selectedMetricKeys: ['outdoor_temp', 'nws_sky_conditions'],
          }}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-temperature-tile')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-conditions-tile')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-solar-tile')).not.toBeInTheDocument();
    expect(screen.queryByText('No solar metrics selected.')).not.toBeInTheDocument();
  });

  it('renders pinned station cards in a collapsible group', async () => {
    render(
      <MemoryRouter>
        <PinnedStationTileGroup
          pin={{
            provider: 'WeatherGov',
            sourceId: 'KGEN',
            displayLabel: 'Generated pinned station',
            selectedMetricKeys: ['outdoor_temp'],
          }}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    const group = screen.getByTestId('dashboard-pinned-station-group');
    const summary = within(group).getByTestId('dashboard-source-summary');
    const content = within(group).getByTestId('dashboard-tile-grid');

    expect(group).toHaveAttribute('open');
    expect(group).toHaveClass('border', 'border-border', 'bg-surface-layer-3');
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(summary).toHaveAttribute('aria-controls', content.id);

    fireEvent.click(summary);

    await waitFor(() => {
      expect(group).not.toHaveAttribute('open');
    });
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(within(group).getByTestId('dashboard-source-heading')).toHaveTextContent('Generated pinned station');
  });

  it('hides the pinned station group when no metrics are selected', () => {
    render(
      <MemoryRouter>
        <PinnedStationTileGroup
          pin={{
            provider: 'WeatherGov',
            sourceId: 'KGEN',
            displayLabel: 'Generated pinned station',
            selectedMetricKeys: [],
          }}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('dashboard-pinned-station-group')).not.toBeInTheDocument();
  });
});
