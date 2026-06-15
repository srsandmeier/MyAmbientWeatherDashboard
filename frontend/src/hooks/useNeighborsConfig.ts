import { useQuery } from '@tanstack/react-query';
import { getNeighborsConfig } from '../api/neighbors';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { NeighborConfigDto } from '../types/neighbors';

export interface UseNeighborsConfigResult {
  readonly data: NeighborConfigDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

/** TanStack Query hook for GET /api/neighbors/config. */
export function useNeighborsConfig(enabled = true): UseNeighborsConfigResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, fetchStatus, isError, error, refetch } = useQuery({
    queryKey: queryKeys.neighbors.config(),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getNeighborsConfig(token, signal);
      if (!result.ok) {
        throw new Error(`GET /api/neighbors/config failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated && enabled,
    staleTime: 5 * 60_000,
  });

  // When enabled=false the query stays in status='pending'/fetchStatus='idle' forever in
  // TanStack Query v5. Only expose isPending=true while a real fetch is in-flight so
  // callers can distinguish "not yet enabled" from "loading".
  return { data, isPending: isPending && fetchStatus !== 'idle', isError, error, refetch: () => { void refetch(); } };
}
