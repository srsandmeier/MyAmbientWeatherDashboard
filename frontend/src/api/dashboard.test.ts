import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboardCurrent, getDashboardDailyExtrema } from './dashboard';
import type { CurrentReadingDto, DailyExtremaDto } from '../types/dashboard';
import { testDeviceId, testDeviceName, testDeviceTz } from '../test/weatherTestData';

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const TOKEN = 'test-bearer-token';

const SAMPLE_READING: CurrentReadingDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  timestampUtc: '2026-05-31T12:00:00Z',
  receivedAtUtc: '2026-05-31T12:00:01Z',
  tempF: 72.4,
  battOut: 1,
  tempInF: 71.0,
  feelsLike: 70.0,
  feelsLikeIn: null,
  dewPoint: 55.0,
  dewPointIn: null,
  humidity: 62,
  humidityIn: null,
  baromRelIn: 29.92,
  baromAbsIn: 29.90,
  windDir: 180,
  windSpeedMph: 5.0,
  windGustMph: 8.0,
  maxDailyGust: 12.0,
  solarRadiation: 300,
  uv: 4,
  hourlyRainIn: 0,
  eventRainIn: null,
  dailyRainIn: 0.1,
  weeklyRainIn: 0.5,
  monthlyRainIn: 1.2,
  yearlyRainIn: 8.0,
  totalRainIn: null,
  lastRain: null,
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

const SAMPLE_EXTREMA: DailyExtremaDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  dateUtc: '2026-06-03T00:00:00Z',
  dailyHighTempF: 92.3,
  dailyLowTempF: 68.1,
  dailyHighTempInF: 74.5,
  dailyLowTempInF: 65.0,
};

describe('getDashboardDailyExtrema', () => {
  it('sends GET to /api/dashboard/daily-extremes with bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_EXTREMA),
    });

    const result = await getDashboardDailyExtrema(TOKEN);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.dailyHighTempF).toBe(92.3);
    expect(result.ok && result.data.dailyLowTempF).toBe(68.1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/daily-extremes'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });
});

describe('getDashboardCurrent', () => {
  it('sends GET with bearer token and returns reading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_READING),
    });

    const result = await getDashboardCurrent(TOKEN);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.deviceId).toBe(testDeviceId);
    expect(result.ok && result.data.tempF).toBe(72.4);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/current'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it('returns error result on non-200 status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 428,
      statusText: 'Precondition Required',
      text: () => Promise.resolve('{"error":"ambient-credentials-required"}'),
    });

    const result = await getDashboardCurrent(TOKEN);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.status).toBe(428);
  });

  it('forwards AbortSignal to fetch', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_READING),
    });

    await getDashboardCurrent(TOKEN, controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
