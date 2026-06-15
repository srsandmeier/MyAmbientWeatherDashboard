import { apiFetch, type ApiResult } from './client';
import type { MetricHistoryParams, MetricHistoryResponse } from '../types/metrics';

/**
 * GET /api/metrics/{metricKey}/history
 *
 * Returns chart-ready metric history for a single metric.
 * All Ambient credentials stay server-side; the bearer token authenticates the BFF call.
 */
export async function getMetricHistory(
  metricKey: string,
  params: MetricHistoryParams,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<MetricHistoryResponse>> {
  const query = buildQueryString(params);
  return apiFetch<MetricHistoryResponse>(
    `/api/metrics/${encodeURIComponent(metricKey)}/history${query}`,
    { token, signal },
  );
}

function buildQueryString(params: MetricHistoryParams): string {
  const entries: [string, string][] = [];

  if (params.range)       entries.push(['range',       params.range]);
  if (params.deviceId)    entries.push(['deviceId',    params.deviceId]);
  if (params.from)        entries.push(['from',        params.from]);
  if (params.to)          entries.push(['to',          params.to]);
  if (params.date)        entries.push(['date',        params.date]);
  if (params.granularity) entries.push(['granularity', params.granularity]);
  if (params.source)      entries.push(['source',      params.source]);

  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}
