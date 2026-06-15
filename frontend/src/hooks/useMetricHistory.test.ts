import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMetricHistory } from './useMetricHistory';
import { createWrapper } from '../test/testUtils';
import { testDeviceId, testDeviceName } from '../test/weatherTestData';
import type { MetricHistoryResponse } from '../types/metrics';

const mockGetAccessToken = vi.fn().mockResolvedValue('test-token');
const mockFetch = vi.fn();

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: mockGetAccessToken,
  }),
}));

const SAMPLE_RESPONSE: MetricHistoryResponse = {
  metricKey: 'outdoor_temp',
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  range: '24h',
  fromUtc: '2026-06-01T00:00:00Z',
  toUtc: '2026-06-02T00:00:00Z',
  granularity: 'raw',
  unit: 'F',
  points: [{ timestampUtc: '2026-06-01T12:00:00Z', value: 72.4 }],
  warnings: [],
};

describe('useMetricHistory', () => {
  beforeEach(() => {
    mockGetAccessToken.mockClear();
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches metric history with bearer token and query params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_RESPONSE),
    });

    const { result } = renderHook(
      () => useMetricHistory('outdoor_temp', { range: '7d', granularity: 'hour', deviceId: testDeviceId, source: 'my' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data?.points).toHaveLength(1);
    });

    expect(mockGetAccessToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/metrics/outdoor_temp/history'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('range=7d');
    expect(url).toContain('granularity=hour');
    expect(url).toContain(`deviceId=${encodeURIComponent(testDeviceId)}`);
  });

  it('exposes an error state when the BFF returns a failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 428,
      text: () => Promise.resolve('credentials required'),
    });

    const { result } = renderHook(
      () => useMetricHistory('outdoor_temp', { range: '24h', source: 'my' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when disabled', () => {
    renderHook(
      () => useMetricHistory('outdoor_temp', { range: '24h', source: 'my' }, { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
