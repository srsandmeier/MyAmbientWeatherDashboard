import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePinnedStationsCurrentReadings } from './usePinnedStationsCurrentReadings';
import { pinnedStationId, type PinnedNeighborStationDto } from '../types/neighbors';
import { createWrapper } from '../test/testUtils';
import type { CurrentReadingDto } from '../types/dashboard';
import { faker } from '@faker-js/faker';

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
  }),
}));

const mockFetch = vi.fn();

const PIN_A: PinnedNeighborStationDto = {
  provider: 'WeatherGov',
  sourceId: `KGEN${faker.string.alphanumeric(3).toUpperCase()}`,
  displayLabel: 'Generated station A',
};

const PIN_B: PinnedNeighborStationDto = {
  provider: 'OpenMeteo',
  sourceId: `${faker.number.float({ min: 30, max: 45, fractionDigits: 4 }).toFixed(4)},${faker.number.float({ min: -100, max: -70, fractionDigits: 4 }).toFixed(4)}`,
  displayLabel: 'Generated station B',
};

function makeReading(deviceId: string): CurrentReadingDto {
  return {
    deviceId,
    deviceName: `Generated ${deviceId}`,
    timestampUtc: '2026-06-06T12:00:00Z',
    receivedAtUtc: '2026-06-06T12:00:00Z',
    tempF: faker.number.float({ min: 40, max: 100, fractionDigits: 1 }),
    tempInF: null, feelsLike: null, feelsLikeIn: null, dewPoint: null, dewPointIn: null,
    humidity: null, humidityIn: null,
    baromRelIn: null, baromAbsIn: null,
    windDir: null, windSpeedMph: null, windGustMph: null, maxDailyGust: null,
    solarRadiation: null, uv: null,
    hourlyRainIn: null, eventRainIn: null, dailyRainIn: null, weeklyRainIn: null,
    monthlyRainIn: null, yearlyRainIn: null, totalRainIn: null, lastRain: null,
    battOut: null, dailyHighTempF: null, dailyLowTempF: null,
    nwsSkyConditions: null, nwsPresentWeather: null, nwsTextDescription: null, nwsRawMetar: null,
    omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
    omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
    omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
    tz: null,
  };
}

describe('usePinnedStationsCurrentReadings', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty map and isLoading=false when pins is undefined', () => {
    const { result } = renderHook(
      () => usePinnedStationsCurrentReadings(undefined),
      { wrapper: createWrapper() },
    );
    expect(result.current.readings.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns empty map and isLoading=false when pins is empty', () => {
    const { result } = renderHook(
      () => usePinnedStationsCurrentReadings([]),
      { wrapper: createWrapper() },
    );
    expect(result.current.readings.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns readings keyed by pinnedStationId after successful fetch', async () => {
    const readingA = makeReading(pinnedStationId(PIN_A.provider, PIN_A.sourceId));
    const readingB = makeReading(pinnedStationId(PIN_B.provider, PIN_B.sourceId));

    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(readingA) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(readingB) });

    const { result } = renderHook(
      () => usePinnedStationsCurrentReadings([PIN_A, PIN_B]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.readings.size).toBe(2);
    });

    const keyA = pinnedStationId(PIN_A.provider, PIN_A.sourceId);
    const keyB = pinnedStationId(PIN_B.provider, PIN_B.sourceId);
    expect(result.current.readings.get(keyA)?.tempF).toBe(readingA.tempF);
    expect(result.current.readings.get(keyB)?.tempF).toBe(readingB.tempF);
  });

  it('excludes pins that return 404', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve(null) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(makeReading(PIN_B.sourceId)) });

    const { result } = renderHook(
      () => usePinnedStationsCurrentReadings([PIN_A, PIN_B]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => { expect(result.current.isLoading).toBe(false); });

    expect(result.current.readings.has(pinnedStationId(PIN_A.provider, PIN_A.sourceId))).toBe(false);
    expect(result.current.readings.size).toBe(1);
  });
});
