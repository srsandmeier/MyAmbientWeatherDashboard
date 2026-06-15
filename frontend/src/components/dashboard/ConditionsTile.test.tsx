import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConditionsTile } from './ConditionsTile';
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

describe('ConditionsTile', () => {
  it('renders NWS string fields', () => {
    render(
      <ConditionsTile
        reading={makeReading({ nwsSkyConditions: 'FEW @ 1,800ft', nwsTextDescription: 'Mostly cloudy' })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['nws_sky_conditions', 'nws_text_description']}
      />,
    );

    const values = screen.getAllByTestId('dashboard-conditions-value');
    expect(values[0]).toHaveTextContent('FEW @ 1,800ft');
    expect(values[1]).toHaveTextContent('Mostly cloudy');
  });

  it('renders Open-Meteo weather description', () => {
    render(
      <ConditionsTile
        reading={makeReading({ omWeatherDescription: 'Partly cloudy' })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_weather_description']}
      />,
    );

    expect(screen.getByTestId('dashboard-conditions-value')).toHaveTextContent('Partly cloudy');
  });

  it('renders Open-Meteo sunrise and sunset text', () => {
    render(
      <ConditionsTile
        reading={makeReading({ omSunrise: '5:40 AM', omSunset: '8:30 PM' })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_sunrise', 'om_sunset']}
      />,
    );

    const values = screen.getAllByTestId('dashboard-conditions-value');
    expect(values[0]).toHaveTextContent('5:40 AM');
    expect(values[1]).toHaveTextContent('8:30 PM');
  });

  it('renders Open-Meteo precip sum as formatted rainfall', () => {
    render(
      <ConditionsTile
        reading={makeReading({ omPrecipSumIn: 0.12 })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_precip_sum']}
      />,
    );

    expect(screen.getByTestId('dashboard-conditions-value')).toHaveTextContent('0.12');
  });

  it('shows — for null OM string values', () => {
    render(
      <ConditionsTile
        reading={makeReading({ omWeatherDescription: null })}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['om_weather_description']}
      />,
    );

    expect(screen.getByTestId('dashboard-conditions-value')).toHaveTextContent('—');
  });

  it('shows empty state when no keys selected', () => {
    render(
      <ConditionsTile
        reading={makeReading()}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={[]}
      />,
    );

    expect(screen.queryByTestId('dashboard-conditions-value')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <ConditionsTile
        reading={undefined}
        preferences={DEFAULT_USER_PREFERENCES}
        selectedKeys={['nws_sky_conditions']}
        isLoading
      />,
    );

    expect(screen.getByTestId('dashboard-conditions-loading')).toBeInTheDocument();
  });
});
