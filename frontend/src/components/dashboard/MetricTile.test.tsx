import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MetricTile } from './MetricTile';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import type { CurrentReadingDto, DailyExtremaDto } from '../../types/dashboard';
import { testDeviceId, testDeviceName, testDeviceTz } from '../../test/weatherTestData';

const navigate = vi.fn();

beforeEach(() => { navigate.mockClear(); });

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useNavigate: () => navigate,
  };
});

const mockExtrema: DailyExtremaDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  dateUtc: '2026-06-03T00:00:00Z',
  dailyHighTempF: 92.3,
  dailyLowTempF: 68.1,
  dailyHighTempInF: 74.5,
  dailyLowTempInF: 65.0,
};

vi.mock('../../hooks/useDashboardExtrema', () => ({
  useDashboardExtrema: () => ({
    data: mockExtrema,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

describe('MetricTile', () => {
  it('renders a converted metric value and navigates on activation', () => {
    const reading = createReading({ tempF: 68.9 });

    render(
      <MemoryRouter>
        <MetricTile
          metricKey="outdoor_temp"
          reading={reading}
          preferences={{ ...DEFAULT_USER_PREFERENCES, temperatureUnit: 'C' }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-tile')).toHaveTextContent('Outdoor Temperature');
    expect(screen.getByTestId('dashboard-metric-value')).toHaveTextContent('20.5');
    expect(screen.getByTestId('dashboard-metric-unit')).toHaveTextContent('°C');

    fireEvent.click(screen.getByTestId('dashboard-metric-tile'));

    expect(navigate).toHaveBeenCalledWith('/metrics/outdoor_temp');
  });

  it('shows an empty value for missing sensors', () => {
    render(
      <MemoryRouter>
        <MetricTile
          metricKey="uv_index"
          reading={createReading({ uv: null })}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-value')).toHaveTextContent('—');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <MetricTile
          metricKey="wind_speed"
          reading={createReading({ windSpeedMph: 6.2 })}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders daily high outdoor temp from extrema and does not navigate', () => {
    render(
      <MemoryRouter>
        <MetricTile
          metricKey="daily_high_temp"
          reading={createReading()}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-tile')).toHaveTextContent('Today Outdoor High');
    expect(screen.getByTestId('dashboard-metric-value')).toHaveTextContent('92.3');
    expect(screen.getByTestId('dashboard-metric-freshness')).toHaveTextContent('Today (UTC)');

    fireEvent.click(screen.getByTestId('dashboard-metric-tile'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders daily low outdoor temp from extrema', () => {
    render(
      <MemoryRouter>
        <MetricTile
          metricKey="daily_low_temp"
          reading={createReading()}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-value')).toHaveTextContent('68.1');
  });

  it('renders daily high indoor temp from extrema', () => {
    render(
      <MemoryRouter>
        <MetricTile
          metricKey="daily_high_temp_in"
          reading={createReading()}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-value')).toHaveTextContent('74.5');
  });

  it('renders daily low indoor temp from extrema', () => {
    render(
      <MemoryRouter>
        <MetricTile
          metricKey="daily_low_temp_in"
          reading={createReading()}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-value')).toHaveTextContent('65.0');
  });

  it('aggregate tile is disabled (no chart navigation)', () => {
    render(
      <MemoryRouter>
        <MetricTile
          metricKey="daily_high_temp"
          reading={createReading()}
          preferences={DEFAULT_USER_PREFERENCES}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-metric-tile')).toBeDisabled();
  });
});

function createReading(overrides: Partial<CurrentReadingDto> = {}): CurrentReadingDto {
  return {
    deviceId: testDeviceId,
    deviceName: testDeviceName,
    timestampUtc: '2026-06-01T12:00:00Z',
    receivedAtUtc: new Date().toISOString(),
    tempF: 72.4,
    battOut: null,
    tempInF: 70.1,
    feelsLike: 74,
    feelsLikeIn: 70,
    dewPoint: 60,
    dewPointIn: 55,
    humidity: 51,
    humidityIn: 45,
    baromRelIn: 29.92,
    baromAbsIn: 29.81,
    windDir: 180,
    windSpeedMph: 5,
    windGustMph: 9,
    maxDailyGust: 12,
    solarRadiation: 450,
    uv: 3,
    hourlyRainIn: 0,
    eventRainIn: 0.12,
    dailyRainIn: 0.2,
    weeklyRainIn: 1.2,
    monthlyRainIn: 2.3,
    yearlyRainIn: 10.5,
    totalRainIn: 50,
    lastRain: '2026-05-30T09:00:00Z',
    dailyHighTempF: null,
    dailyLowTempF: null,
    nwsSkyConditions: null,
    nwsPresentWeather: null,
    nwsTextDescription: null,
    nwsRawMetar: null,
    omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
    omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
    omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
    tz: testDeviceTz,
    ...overrides,
  };
}
