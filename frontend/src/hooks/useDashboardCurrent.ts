import { useQuery } from '@tanstack/react-query';
import { getDashboardCurrent } from '../api/dashboard';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { CurrentReadingDto } from '../types/dashboard';

export interface UseDashboardCurrentResult {
  readonly data: CurrentReadingDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  /** True when source=neighbors returns 428 — feature is disabled or not yet configured. Not an error. */
  readonly isNeighborsUnavailable: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

/**
 * TanStack Query hook for GET /api/dashboard/current.
 * Polls every 60 s as a REST fallback; the primary update path is SignalR ReadingUpdated events
 * from useWeatherHub, which write each pushed reading into this query key.
 * Pass `source="neighbors"` to fetch an aggregated reading from nearby public stations.
 */
export function useDashboardCurrent(source?: 'own' | 'neighbors'): UseDashboardCurrentResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  // Own-station uses the base key so SignalR writes from useWeatherHub remain compatible.
  // Neighbors gets a distinct key so the two sources never share a cache entry.
  const queryKey = source === 'neighbors'
    ? ([...queryKeys.dashboard.current(), 'neighbors'] as const)
    : queryKeys.dashboard.current();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getDashboardCurrent(token, signal, source);
      if (!result.ok) {
        // 428 for neighbors means the feature is not yet configured — treat as empty, not an error.
        if (source === 'neighbors' && result.status === 428) {
          return null;
        }
        throw new Error(`GET /api/dashboard/current failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // null means "neighbors not configured" (428); undefined means "still loading".
  const isNeighborsUnavailable = source === 'neighbors' && data === null;

  return {
    data: data ?? undefined,
    isPending,
    isError,
    isNeighborsUnavailable,
    error,
    refetch: () => { void refetch(); },
  };
}
