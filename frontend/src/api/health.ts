import { apiFetch, type ApiResult } from './client';

export interface HealthStatus {
  readonly status: string;
}

/** Unauthenticated liveness check. No token needed. */
export function getHealth(signal?: AbortSignal): Promise<ApiResult<HealthStatus>> {
  return apiFetch<HealthStatus>('/api/health', { signal });
}
