import { apiFetch, type ApiResult } from './client';
import type { WeatherAlertDto } from '../types/alerts';

export async function getActiveAlerts(
  token: string,
  areaCode?: string | null,
  signal?: AbortSignal,
): Promise<ApiResult<WeatherAlertDto[]>> {
  const query = areaCode && areaCode.trim().length > 0
    ? `?area=${encodeURIComponent(areaCode.trim())}`
    : '';
  return apiFetch<WeatherAlertDto[]>(`/api/alerts/active${query}`, { token, signal });
}
