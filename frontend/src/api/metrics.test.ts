import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMetricHistory } from './metrics';
import { testDeviceId, testDeviceName } from '../test/weatherTestData';
import type { MetricHistoryResponse } from '../types/metrics';

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => { vi.unstubAllGlobals(); });

const TOKEN = 'test-bearer-token';

const SAMPLE_RESPONSE: MetricHistoryResponse = {
  metricKey: 'outdoor_temp',
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  range: '24h',
  fromUtc: '2026-05-28T00:00:00Z',
  toUtc: '2026-05-29T00:00:00Z',
  granularity: 'raw',
  unit: 'F',
  points: [{ timestampUtc: '2026-05-28T12:00:00Z', value: 72.4 }],
  warnings: [],
};

function makeOkResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('getMetricHistory', () => {
  it('sends GET with bearer token and default range', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    const result = await getMetricHistory('outdoor_temp', {}, TOKEN);

    expect(result.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/metrics/outdoor_temp/history');
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it('appends preset range to query string', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    await getMetricHistory('outdoor_temp', { range: '7d' }, TOKEN);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('range=7d');
  });

  it('appends deviceId when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    await getMetricHistory('outdoor_temp', { deviceId: testDeviceId }, TOKEN);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`deviceId=${encodeURIComponent(testDeviceId)}`);
  });

  it('appends custom range parameters', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    await getMetricHistory(
      'outdoor_temp',
      { range: 'custom', from: '2026-01-01T00:00:00Z', to: '2026-01-07T00:00:00Z' },
      TOKEN,
    );

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('range=custom');
    expect(url).toContain('from=');
    expect(url).toContain('to=');
  });

  it('appends date for date mode', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    await getMetricHistory('outdoor_temp', { range: 'date', date: '2026-05-29' }, TOKEN);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('range=date');
    expect(url).toContain('date=2026-05-29');
  });

  it('encodes special characters in metricKey', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    await getMetricHistory('outdoor temp', {}, TOKEN);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('outdoor%20temp');
  });

  it('returns ok:false on 401', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ error: 'Unauthorized' }, 401));

    const result = await getMetricHistory('outdoor_temp', {}, TOKEN);

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('returns ok:false on 428', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ error: 'ambient-credentials-required' }, 428));

    const result = await getMetricHistory('outdoor_temp', {}, TOKEN);

    expect(result).toMatchObject({ ok: false, status: 428 });
  });

  it('passes AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));
    const controller = new AbortController();

    await getMetricHistory('outdoor_temp', {}, TOKEN, controller.signal);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it('omits empty params from query string', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESPONSE));

    await getMetricHistory('outdoor_temp', { range: '24h' }, TOKEN);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('deviceId');
    expect(url).not.toContain('granularity');
  });
});
