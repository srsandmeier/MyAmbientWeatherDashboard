import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getPinnedStationCurrent } from '../api/neighbors';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import { pinnedStationId, type PinnedNeighborStationDto } from '../types/neighbors';
import type { CurrentReadingDto } from '../types/dashboard';

export interface PinnedStationReadings {
  readonly readings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isLoading: boolean;
}

/**
 * Fetches current readings for all pinned neighbor stations in parallel.
 * Keys the result map by `pinnedStationId(provider, sourceId)`.
 */
const EMPTY_PINS: readonly PinnedNeighborStationDto[] = [];

export function usePinnedStationsCurrentReadings(
  pins: readonly PinnedNeighborStationDto[] | undefined,
): PinnedStationReadings {
  const { getAccessToken, isAuthenticated } = useAuth();

  // Stable reference when pins is undefined; delegates stability to the caller when defined.
  const activePins = useMemo(() => pins ?? EMPTY_PINS, [pins]);

  const results = useQueries({
    queries: activePins.map((pin) => ({
      queryKey: queryKeys.neighbors.stationCurrent(pin.provider, pin.sourceId),
      queryFn: async ({ signal }: { readonly signal: AbortSignal }) => {
        const token = await getAccessToken();
        const result = await getPinnedStationCurrent(pin.provider, pin.sourceId, token, signal);
        if (!result.ok) {
          if (result.status === 404) return null;
          throw new Error(`GET /api/neighbors/stations/current failed: ${String(result.status)}`);
        }
        return result.data;
      },
      enabled: isAuthenticated && !!pin.provider && !!pin.sourceId,
      staleTime: 5 * 60_000,
      refetchInterval: 60_000,
    })),
  });

  // Stable map reference — only rebuilt when query results change, not on every render.
  const readings = useMemo(() => {
    const map = new Map<string, CurrentReadingDto>();
    results.forEach((result, index) => {
      const pin = activePins[index];
      if (result.data) {
        map.set(pinnedStationId(pin.provider, pin.sourceId), result.data);
      }
    });
    return map;
  }, [results, activePins]);

  return {
    readings,
    isLoading: results.some((r) => r.isPending),
  };
}
