import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { HumidityTile } from './HumidityTile';
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

describe('HumidityTile', () => {
  it('renders outdoor and indoor humidity', () => {
    renderWithRouter(
      <HumidityTile
        reading={makeReading({ humidity: 62, humidityIn: 45 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['outdoor_humidity', 'indoor_humidity']}
      />,
    );

    const values = screen.getAllByTestId('dashboard-humidity-value');
    expect(values[0]).toHaveTextContent('62');
    expect(values[1]).toHaveTextContent('45');
  });

  it('renders Open-Meteo cloud cover', () => {
    renderWithRouter(
      <HumidityTile
        reading={makeReading({ omCloudCover: 55 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_cloud_cover']}
      />,
    );

    expect(screen.getByTestId('dashboard-humidity-value')).toHaveTextContent('55');
  });

  it('renders Open-Meteo precipitation probability', () => {
    renderWithRouter(
      <HumidityTile
        reading={makeReading({ omPrecipProbability: 30 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_precip_probability']}
      />,
    );

    expect(screen.getByTestId('dashboard-humidity-value')).toHaveTextContent('30');
  });

  it('shows — for null OM values', () => {
    renderWithRouter(
      <HumidityTile
        reading={makeReading({ omCloudCover: null })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_cloud_cover']}
      />,
    );

    expect(screen.getByTestId('dashboard-humidity-value')).toHaveTextContent('—');
  });

  it('shows loading state', () => {
    renderWithRouter(
      <HumidityTile
        reading={undefined}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['outdoor_humidity']}
        isLoading
      />,
    );

    expect(screen.getByTestId('dashboard-humidity-loading')).toBeInTheDocument();
  });

  it('renders pressure alongside OM metrics', () => {
    renderWithRouter(
      <HumidityTile
        reading={makeReading({ baromRelIn: 29.92, omCloudCover: 40 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['pressure', 'om_cloud_cover']}
      />,
    );

    expect(screen.getByTestId('dashboard-pressure-value')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-humidity-value')).toHaveTextContent('40');
  });

  it('shows empty state when no keys selected', () => {
    renderWithRouter(
      <HumidityTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={[]}
      />,
    );

    expect(screen.queryByTestId('dashboard-humidity-value')).not.toBeInTheDocument();
  });
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
