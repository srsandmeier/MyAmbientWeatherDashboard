import { useQuery } from '@tanstack/react-query';
import { getDashboardDailyExtrema } from '../api/dashboard';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { DailyExtremaDto } from '../types/dashboard';

export interface UseDashboardExtremaResult {
  readonly data: DailyExtremaDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

/**
 * TanStack Query hook for GET /api/dashboard/daily-extremes.
 * Polls every 5 minutes — daily high/low values change slowly and are computed from
 * stored history rather than the live reading stream.
 */
export function useDashboardExtrema(): UseDashboardExtremaResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.extrema(),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getDashboardDailyExtrema(token, signal);
      if (!result.ok) {
        throw new Error(`GET /api/dashboard/daily-extremes failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  return { data, isPending, isError, error };
}
