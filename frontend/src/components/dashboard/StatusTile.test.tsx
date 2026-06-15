import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { StatusTile } from './StatusTile';
import type { CurrentReadingDto } from '../../types/dashboard';
import { testDeviceId, testDeviceName, testDeviceTz } from '../../test/weatherTestData';

describe('StatusTile', () => {
  it('renders live state and freshness for the current station', () => {
    render(<StatusTile hubState="connected" reading={reading} />);

    expect(screen.getByTestId('dashboard-status-realtime')).toHaveTextContent('Live');
    expect(screen.getByTestId('dashboard-status-tile')).toHaveTextContent(testDeviceName);
  });

  it('shows partial data errors', () => {
    render(<StatusTile hubState="disconnected" reading={undefined} isCurrentError />);

    expect(screen.getByTestId('dashboard-status-realtime')).toHaveTextContent('Offline');
    expect(screen.getByTestId('dashboard-status-error')).toHaveTextContent(
      'Dashboard data is partially unavailable.',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<StatusTile hubState="connected" reading={reading} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

const reading: CurrentReadingDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  timestampUtc: '2026-06-01T12:00:00Z',
  receivedAtUtc: new Date().toISOString(),
  tempF: 72.4,
  battOut: 1,
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
};
