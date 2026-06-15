import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboardExtrema } from './useDashboardExtrema';
import type { DailyExtremaDto } from '../types/dashboard';
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

const SAMPLE_EXTREMA: DailyExtremaDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  dateUtc: '2026-06-03T00:00:00Z',
  dailyHighTempF: 92.3,
  dailyLowTempF: 68.1,
  dailyHighTempInF: 74.5,
  dailyLowTempInF: 65.0,
};

describe('useDashboardExtrema', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return data on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_EXTREMA),
    });

    const { result } = renderHook(() => useDashboardExtrema(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.deviceId).toBe(testDeviceId);
      expect(result.current.data?.dailyHighTempF).toBe(92.3);
      expect(result.current.data?.dailyLowTempF).toBe(68.1);
      expect(result.current.data?.dailyHighTempInF).toBe(74.5);
      expect(result.current.data?.dailyLowTempInF).toBe(65.0);
    });
  });

  it('should return null fields when no readings exist today', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        ...SAMPLE_EXTREMA,
        dailyHighTempF: null,
        dailyLowTempF: null,
        dailyHighTempInF: null,
        dailyLowTempInF: null,
      } satisfies DailyExtremaDto),
    });

    const { result } = renderHook(() => useDashboardExtrema(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.data?.dailyHighTempF).toBeNull();
      expect(result.current.data?.dailyLowTempF).toBeNull();
    });
  });

  it('should set isError on 428 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 428,
      statusText: 'Precondition Required',
      text: () => Promise.resolve('no credentials'),
    });

    const { result } = renderHook(() => useDashboardExtrema(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.data).toBeUndefined();
  });

  it('should call GET /api/dashboard/daily-extremes with bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_EXTREMA),
    });

    const { result } = renderHook(() => useDashboardExtrema(), { wrapper: createWrapper() });

    await waitFor(() => !result.current.isPending);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/daily-extremes'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });
});
