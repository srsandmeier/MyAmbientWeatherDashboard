import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { SolarTile } from './SolarTile';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import type { CurrentReadingDto } from '../../types/dashboard';
import { testDeviceId, testDeviceName } from '../../test/weatherTestData';

function makeReading(overrides: Partial<CurrentReadingDto> = {}): CurrentReadingDto {
  return {
    deviceId: testDeviceId,
    deviceName: testDeviceName,
    timestampUtc: '2026-06-01T00:00:00Z',
    receivedAtUtc: '2026-06-01T00:00:00Z',
    tempF: null, tempInF: null, feelsLike: null, feelsLikeIn: null,
    dewPoint: null, dewPointIn: null, humidity: null, humidityIn: null,
    baromRelIn: null, baromAbsIn: null, battOut: null,
    windDir: null, windSpeedMph: null, windGustMph: null, maxDailyGust: null,
    solarRadiation: null, uv: null,
    hourlyRainIn: null, eventRainIn: null, dailyRainIn: null,
    weeklyRainIn: null, monthlyRainIn: null, yearlyRainIn: null,
    totalRainIn: null, lastRain: null, dailyHighTempF: null, dailyLowTempF: null,
    nwsSkyConditions: null, nwsPresentWeather: null, nwsTextDescription: null, nwsRawMetar: null,
    omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
    omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
    omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
    tz: null,
    ...overrides,
  };
}

describe('SolarTile', () => {
  it('renders solar radiation and UV index', () => {
    renderWithRouter(
      <SolarTile
        reading={makeReading({ solarRadiation: 450.5, uv: 6 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['solar_radiation', 'uv_index']}
      />,
    );

    const values = screen.getAllByTestId('dashboard-solar-value');
    expect(values[0]).toHaveTextContent('450.5');
    expect(values[1]).toHaveTextContent('6');
  });

  it('renders Open-Meteo daily UV max', () => {
    renderWithRouter(
      <SolarTile
        reading={makeReading({ omUvIndexMax: 9 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_uv_index_max']}
      />,
    );

    expect(screen.getByTestId('dashboard-solar-value')).toHaveTextContent('9');
  });

  it('renders all three solar rows together', () => {
    renderWithRouter(
      <SolarTile
        reading={makeReading({ solarRadiation: 320.0, uv: 5, omUvIndexMax: 8 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['solar_radiation', 'uv_index', 'om_uv_index_max']}
      />,
    );

    const values = screen.getAllByTestId('dashboard-solar-value');
    expect(values).toHaveLength(3);
  });

  it('shows — for null OM UV max', () => {
    renderWithRouter(
      <SolarTile
        reading={makeReading({ omUvIndexMax: null })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_uv_index_max']}
      />,
    );

    expect(screen.getByTestId('dashboard-solar-value')).toHaveTextContent('—');
  });

  it('shows loading state', () => {
    renderWithRouter(
      <SolarTile
        reading={undefined}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['uv_index']}
        isLoading
      />,
    );

    expect(screen.getByTestId('dashboard-solar-loading')).toBeInTheDocument();
  });

  it('shows empty state when no keys selected', () => {
    renderWithRouter(
      <SolarTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={[]}
      />,
    );

    expect(screen.queryByTestId('dashboard-solar-value')).not.toBeInTheDocument();
  });

  it('does not link OM UV max to history', () => {
    renderWithRouter(
      <SolarTile
        reading={makeReading({ omUvIndexMax: 7 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_uv_index_max']}
        canOpenHistory={false}
      />,
    );

    expect(screen.queryByTestId('dashboard-metric-history-link')).not.toBeInTheDocument();
  });
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
