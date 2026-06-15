import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboardRainfall } from './useDashboardRainfall';
import type { DashboardRainfallDto } from '../types/dashboard';
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

const SAMPLE_RAINFALL: DashboardRainfallDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  timestampUtc: '2026-06-01T12:00:00Z',
  receivedAtUtc: '2026-06-01T12:00:01Z',
  eventRainIn: 0.12,
  dailyRainIn: 0.25,
  weeklyRainIn: 1.50,
  monthlyRainIn: 3.00,
  yearlyRainIn: 12.75,
  lastRain: '2026-06-01T10:00:00Z',
};

describe('useDashboardRainfall', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return data on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_RAINFALL),
    });

    const { result } = renderHook(() => useDashboardRainfall(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.deviceId).toBe(testDeviceId);
      expect(result.current.data?.dailyRainIn).toBe(0.25);
      expect(result.current.data?.yearlyRainIn).toBe(12.75);
    });
  });

  it('should set isError on 428 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 428,
      statusText: 'Precondition Required',
      text: () => Promise.resolve('no credentials'),
    });

    const { result } = renderHook(() => useDashboardRainfall(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.data).toBeUndefined();
  });

  it('should use bearer token from getAccessToken', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_RAINFALL),
    });

    const { result } = renderHook(() => useDashboardRainfall(), { wrapper: createWrapper() });

    await waitFor(() => !result.current.isPending);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/rainfall'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });
});
