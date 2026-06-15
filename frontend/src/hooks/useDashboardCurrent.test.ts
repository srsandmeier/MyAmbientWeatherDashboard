import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboardCurrent } from './useDashboardCurrent';
import type { CurrentReadingDto } from '../types/dashboard';
import { createWrapper } from '../test/testUtils';
import { testDeviceId, testDeviceName } from '../test/weatherTestData';

const mockGetAccessToken = vi.fn().mockResolvedValue('test-token');

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: mockGetAccessToken,
  }),
}));

const mockFetch = vi.fn();

const SAMPLE_READING: CurrentReadingDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  timestampUtc: '2026-05-31T12:00:00Z',
  receivedAtUtc: '2026-05-31T12:00:01Z',
  tempF: 72.4,
  battOut: null,
  tempInF: null, feelsLike: null, feelsLikeIn: null, dewPoint: null, dewPointIn: null,
  humidity: 62, humidityIn: null,
  baromRelIn: null, baromAbsIn: null,
  windDir: null, windSpeedMph: null, windGustMph: null, maxDailyGust: null,
  solarRadiation: null, uv: null,
  hourlyRainIn: null, eventRainIn: null, dailyRainIn: null, weeklyRainIn: null,
  monthlyRainIn: null, yearlyRainIn: null, totalRainIn: null, lastRain: null,
  dailyHighTempF: null, dailyLowTempF: null,
  nwsSkyConditions: null, nwsPresentWeather: null, nwsTextDescription: null, nwsRawMetar: null,
  omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
  omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
  omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
  tz: null,
};

describe('useDashboardCurrent', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return data on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_READING),
    });

    const { result } = renderHook(() => useDashboardCurrent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.deviceId).toBe(testDeviceId);
      expect(result.current.data?.tempF).toBe(72.4);
    });
  });

  it('should set isError on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 428,
      statusText: 'Precondition Required',
      text: () => Promise.resolve('no credentials'),
    });

    const { result } = renderHook(() => useDashboardCurrent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it('should use bearer token from getAccessToken', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_READING),
    });

    const { result } = renderHook(() => useDashboardCurrent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => !result.current.isPending);

    expect(mockGetAccessToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/current'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });
});
