import { apiFetch, type ApiResult } from './client';
import type { NeighborConfigDto, NeighborStationDto, UpdateNeighborConfigRequest } from '../types/neighbors';
import type { CurrentReadingDto } from '../types/dashboard';

/**
 * GET /api/neighbors/config
 *
 * Returns the user's neighbor comparison configuration, seeding defaults on first access.
 */
export async function getNeighborsConfig(
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<NeighborConfigDto>> {
  return apiFetch<NeighborConfigDto>('/api/neighbors/config', { token, signal });
}

/**
 * PUT /api/neighbors/config
 *
 * Saves the user's neighbor comparison configuration.
 */
export async function putNeighborsConfig(
  body: UpdateNeighborConfigRequest,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<NeighborConfigDto>> {
  return apiFetch<NeighborConfigDto>('/api/neighbors/config', {
    method: 'PUT',
    token,
    signal,
    body,
  });
}

/**
 * GET /api/neighbors/stations/current?provider=X&sourceId=Y
 *
 * Returns the most recently cached observation for a single pinned station.
 */
export async function getPinnedStationCurrent(
  provider: string,
  sourceId: string,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<CurrentReadingDto>> {
  const params = new URLSearchParams({ provider, sourceId });
  return apiFetch<CurrentReadingDto>(`/api/neighbors/stations/current?${params.toString()}`, { token, signal });
}

/**
 * GET /api/neighbors/comparison-stations?macAddress=X
 *
 * Returns the Ambient Weather stations contributing to neighbor comparison.
 */
export async function getNeighborComparisonStations(
  token: string,
  macAddress?: string,
  signal?: AbortSignal,
): Promise<ApiResult<readonly NeighborStationDto[]>> {
  const params = new URLSearchParams();
  if (macAddress) params.set('macAddress', macAddress);
  const query = params.toString();
  return apiFetch<readonly NeighborStationDto[]>(
    `/api/neighbors/comparison-stations${query.length > 0 ? `?${query}` : ''}`,
    { token, signal },
  );
}

/**
 * POST /api/neighbors/refresh
 *
 * Clears the neighbor cache and triggers re-discovery. Returns the refreshed station list.
 */
export async function postNeighborsRefresh(
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<readonly NeighborStationDto[]>> {
  return apiFetch<readonly NeighborStationDto[]>('/api/neighbors/refresh', {
    method: 'POST',
    token,
    signal,
  });
}
