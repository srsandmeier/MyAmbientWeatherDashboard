import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getPublicSourceCurrent } from '../api/publicSources';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import { publicSourceStationId, type PublicWeatherSourceDto } from '../types/publicSources';
import type { CurrentReadingDto } from '../types/dashboard';

export interface PublicSourceReadings {
  readonly readings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isLoading: boolean;
}

const EMPTY_SOURCES: readonly PublicWeatherSourceDto[] = [];

export function usePublicSourceCurrentReadings(
  sources: readonly PublicWeatherSourceDto[] | undefined,
): PublicSourceReadings {
  const { getAccessToken, isAuthenticated } = useAuth();

  // Memoize before useQueries so the query array is only rebuilt when sources actually changes.
  const enabledSources = useMemo(
    () => (sources ?? EMPTY_SOURCES).filter((source) => source.isEnabled),
    [sources],
  );

  const results = useQueries({
    queries: enabledSources.map((source) => ({
      queryKey: queryKeys.settings.publicSources.current(source.id),
      queryFn: async ({ signal }: { readonly signal: AbortSignal }) => {
        const token = await getAccessToken();
        const result = await getPublicSourceCurrent(source.id, token, signal);
        if (!result.ok) {
          throw new Error(`GET /api/public-sources/${source.id}/current failed: ${String(result.status)} ${result.error}`);
        }
        return result.data;
      },
      enabled: isAuthenticated,
      staleTime: 2 * 60_000,
      refetchInterval: 2 * 60_000,
    })),
  });

  // Stable map reference — only rebuilt when query results change, not on every render.
  const readings = useMemo(() => {
    const map = new Map<string, CurrentReadingDto>();
    results.forEach((result, index) => {
      const source = enabledSources[index];
      if (result.data) {
        map.set(publicSourceStationId(source.id), result.data);
      }
    });
    return map;
  }, [results, enabledSources]);

  return {
    readings,
    isLoading: results.some((r) => r.isPending),
  };
}
