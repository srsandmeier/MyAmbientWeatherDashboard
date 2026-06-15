import { useQuery } from '@tanstack/react-query';
import { getDashboardRainfall } from '../api/dashboard';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { DashboardRainfallDto } from '../types/dashboard';

export interface UseDashboardRainfallResult {
  readonly data: DashboardRainfallDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

/**
 * TanStack Query hook for GET /api/dashboard/rainfall.
 * Polls every 60 s as a REST fallback; realtime pushes from useWeatherHub write
 * extracted rainfall data into this key on every ReadingUpdated event.
 */
export function useDashboardRainfall(): UseDashboardRainfallResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.rainfall(),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getDashboardRainfall(token, signal);
      if (!result.ok) {
        throw new Error(`GET /api/dashboard/rainfall failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return { data, isPending, isError, error, refetch: () => { void refetch(); } };
}
