import { apiFetch, type ApiResult } from './client';
import type { CurrentReadingDto, DailyExtremaDto, DashboardLayoutDto, DashboardRainfallDto, SaveDashboardLayoutRequest } from '../types/dashboard';

/**
 * GET /api/dashboard/current
 *
 * Returns the latest current reading for the user's default weather station.
 * Reads from the server-side latest-reading cache; falls back to Ambient REST on cache miss.
 * Pass `source="neighbors"` to receive an aggregated reading from nearby public stations.
 */
export async function getDashboardCurrent(
  token: string,
  signal?: AbortSignal,
  source?: 'own' | 'neighbors',
): Promise<ApiResult<CurrentReadingDto>> {
  const url = source === 'neighbors'
    ? '/api/dashboard/current?source=neighbors'
    : '/api/dashboard/current';
  return apiFetch<CurrentReadingDto>(url, { token, signal });
}

/**
 * GET /api/dashboard/rainfall
 *
 * Returns rainfall accumulation fields (event/day/week/month/year) for the user's default station.
 * Reads from the same server-side cache as /current; falls back to Ambient REST on cache miss.
 */
export async function getDashboardRainfall(
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<DashboardRainfallDto>> {
  return apiFetch<DashboardRainfallDto>('/api/dashboard/rainfall', { token, signal });
}

/**
 * GET /api/dashboard/daily-extremes
 *
 * Returns the daily high/low outdoor and indoor temperatures for the user's default station,
 * computed from stored readings for the current UTC calendar day.
 */
export async function getDashboardDailyExtrema(
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<DailyExtremaDto>> {
  return apiFetch<DailyExtremaDto>('/api/dashboard/daily-extremes', { token, signal });
}

/**
 * GET /api/dashboard/layout
 *
 * Returns the user's active dashboard tile layout, seeding a default on first access.
 */
export async function getDashboardLayout(
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<DashboardLayoutDto>> {
  return apiFetch<DashboardLayoutDto>('/api/dashboard/layout', { token, signal });
}

/**
 * PUT /api/dashboard/layout
 *
 * Saves the user's active dashboard layout (Default or Custom mode).
 */
export async function putDashboardLayout(
  request: SaveDashboardLayoutRequest,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<DashboardLayoutDto>> {
  return apiFetch<DashboardLayoutDto>('/api/dashboard/layout', {
    method: 'PUT',
    token,
    signal,
    body: request,
  });
}
