import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postNeighborsRefresh } from '../api/neighbors';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { NeighborStationDto } from '../types/neighbors';

export interface UseNeighborsRefreshResult {
  readonly mutateAsync: () => Promise<readonly NeighborStationDto[]>;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly data: readonly NeighborStationDto[] | undefined;
}

/** Mutation hook for POST /api/neighbors/refresh. Invalidates config and dashboard on success. */
export function useNeighborsRefresh(): UseNeighborsRefreshResult {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, isSuccess, data } = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await postNeighborsRefresh(token);
      if (!result.ok) {
        throw new Error(`POST /api/neighbors/refresh failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    onSuccess: (stations) => {
      queryClient.setQueryData(queryKeys.neighbors.stations(), stations);
      void queryClient.invalidateQueries({ queryKey: queryKeys.neighbors.config() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.current() });
    },
  });

  return { mutateAsync, isPending, isError, isSuccess, data };
}
