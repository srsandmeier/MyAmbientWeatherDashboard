import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { WindTile } from './WindTile';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import type { CurrentReadingDto } from '../../types/dashboard';
import { testDeviceId, testDeviceName } from '../../test/weatherTestData';

const ALL_WIND_KEYS = ['wind_dir', 'wind_speed', 'wind_gust', 'max_daily_gust'] as const;
const OM_WIND_KEYS = ['om_wind_speed_max', 'om_wind_gust_max', 'om_wind_dir_dominant'] as const;

function makeReading(overrides: Partial<CurrentReadingDto> = {}): CurrentReadingDto {
  return {
    deviceId: testDeviceId,
    deviceName: testDeviceName,
    timestampUtc: '2026-06-01T00:00:00Z',
    receivedAtUtc: '2026-06-01T00:00:00Z',
    tempF: null, tempInF: null, feelsLike: null, feelsLikeIn: null,
    dewPoint: null, dewPointIn: null, humidity: null, humidityIn: null,
    baromRelIn: null, baromAbsIn: null, battOut: null,
    windDir: 207, windSpeedMph: 10.5, windGustMph: 15.2, maxDailyGust: 18.0,
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

describe('WindTile', () => {
  it('renders direction as cardinal with degree suffix', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading({ windDir: 207 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={ALL_WIND_KEYS}
      />,
    );

    const values = screen.getAllByTestId('dashboard-wind-value');
    expect(values[0]).toHaveTextContent('SSW 207°');
  });

  it('converts N boundary correctly (360° → N)', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading({ windDir: 360 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['wind_dir']}
      />,
    );

    expect(screen.getByTestId('dashboard-wind-value')).toHaveTextContent('N 360°');
  });

  it('renders speed in user-preferred unit', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading({ windSpeedMph: 10 })}
        preferences={{ ...DEFAULT_USER_PREFERENCES, speedUnit: 'kmh' }}
        selectedKeys={ALL_WIND_KEYS}
      />,
    );

    const values = screen.getAllByTestId('dashboard-wind-value');
    const speedValue = values.find((el) => el.textContent?.includes('km/h'));
    expect(speedValue).toBeDefined();
  });

  it('shows — for null wind direction', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading({ windDir: null })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['wind_dir']}
      />,
    );

    expect(screen.getByTestId('dashboard-wind-value')).toHaveTextContent('—');
  });

  it('filters rows to selectedKeys only', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['wind_speed']}
      />,
    );

    const values = screen.getAllByTestId('dashboard-wind-value');
    expect(values).toHaveLength(1);
  });

  it('shows loading state', () => {
    renderWithRouter(
      <WindTile
        reading={undefined}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={ALL_WIND_KEYS}
        isLoading
      />,
    );

    expect(screen.getByTestId('dashboard-wind-loading')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithRouter(
      <WindTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={ALL_WIND_KEYS}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('links chartable wind values to metric history for owned stations', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['wind_speed']}
        historyDeviceId={testDeviceId}
      />,
    );

    expect(screen.getByTestId('dashboard-metric-history-link')).toHaveAttribute(
      'href',
      `/metrics/wind_speed?deviceId=${encodeURIComponent(testDeviceId)}`,
    );
  });

  it('renders Open-Meteo daily wind forecast rows when selected', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading({ omWindSpeedMax: 18.5, omWindGustMax: 25.0, omWindDirDominant: 270 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={OM_WIND_KEYS}
      />,
    );

    const values = screen.getAllByTestId('dashboard-wind-value');
    expect(values).toHaveLength(3);
    expect(values.some((v) => v.textContent?.includes('18.5'))).toBe(true);
    expect(values.some((v) => v.textContent?.includes('25.0'))).toBe(true);
    // dominant direction rendered as compass + degrees
    expect(values.some((v) => v.textContent?.includes('270'))).toBe(true);
  });

  it('shows — for null Open-Meteo wind forecast values', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading({ omWindSpeedMax: null })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_wind_speed_max']}
      />,
    );

    expect(screen.getByTestId('dashboard-wind-value')).toHaveTextContent('—');
  });

  it('does not link provider wind values to owned-station history', () => {
    renderWithRouter(
      <WindTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['wind_speed']}
        canOpenHistory={false}
      />,
    );

    expect(screen.queryByTestId('dashboard-metric-history-link')).not.toBeInTheDocument();
  });
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
