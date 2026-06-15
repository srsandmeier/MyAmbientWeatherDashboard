import { apiFetch, type ApiResult } from './client';
import type {
  CreatePublicWeatherSourceRequest,
  DiscoveredPublicSourceDto,
  PublicWeatherSourceDto,
  UpdatePublicWeatherSourceRequest,
} from '../types/publicSources';
import type { CurrentReadingDto } from '../types/dashboard';

export async function getPublicSources(
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<PublicWeatherSourceDto[]>> {
  return apiFetch<PublicWeatherSourceDto[]>('/api/public-sources', { token, signal });
}

export async function createPublicSource(
  body: CreatePublicWeatherSourceRequest,
  token: string,
): Promise<ApiResult<PublicWeatherSourceDto>> {
  return apiFetch<PublicWeatherSourceDto>('/api/public-sources', { method: 'POST', body, token });
}

export async function updatePublicSource(
  id: string,
  body: UpdatePublicWeatherSourceRequest,
  token: string,
): Promise<ApiResult<PublicWeatherSourceDto>> {
  return apiFetch<PublicWeatherSourceDto>(`/api/public-sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
    token,
  });
}

export async function deletePublicSource(
  id: string,
  token: string,
): Promise<ApiResult<undefined>> {
  return apiFetch<undefined>(`/api/public-sources/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export async function discoverPublicSources(
  q: string,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<DiscoveredPublicSourceDto[]>> {
  return apiFetch<DiscoveredPublicSourceDto[]>(
    `/api/public-sources/discover?q=${encodeURIComponent(q)}`,
    { token, signal },
  );
}

export async function getPublicSourceCurrent(
  id: string,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<CurrentReadingDto>> {
  return apiFetch<CurrentReadingDto>(`/api/public-sources/${encodeURIComponent(id)}/current`, { token, signal });
}
