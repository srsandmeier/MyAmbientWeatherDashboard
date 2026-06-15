import { useQuery } from '@tanstack/react-query';
import { getPinnedStationCurrent } from '../api/neighbors';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { CurrentReadingDto } from '../types/dashboard';

export interface UsePinnedStationCurrentResult {
  readonly data: CurrentReadingDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isNotCached: boolean;
  readonly refetch: () => void;
}

/**
 * Fetches the most recently cached observation for a single pinned neighbor station.
 * Returns `isNotCached: true` when the station has not been discovered yet (HTTP 404).
 */
export function usePinnedStationCurrent(
  provider: string,
  sourceId: string,
): UsePinnedStationCurrentResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.neighbors.stationCurrent(provider, sourceId),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getPinnedStationCurrent(provider, sourceId, token, signal);
      if (!result.ok) {
        if (result.status === 404) return null;
        throw new Error(`GET /api/neighbors/stations/current failed: ${String(result.status)}`);
      }
      return result.data;
    },
    enabled: isAuthenticated && !!provider && !!sourceId,
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  const isNotCached = !isPending && !isError && data === null;

  return {
    data: data ?? undefined,
    isPending,
    isError,
    isNotCached,
    refetch: () => { void refetch(); },
  };
}
