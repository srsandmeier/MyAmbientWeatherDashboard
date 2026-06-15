import { useMutation, useQueryClient } from '@tanstack/react-query';
import { putNeighborsConfig } from '../api/neighbors';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { NeighborConfigDto, UpdateNeighborConfigRequest } from '../types/neighbors';

export interface UseSaveNeighborsConfigResult {
  readonly mutateAsync: (request: UpdateNeighborConfigRequest) => Promise<NeighborConfigDto>;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
}

/** Mutation hook for PUT /api/neighbors/config. Updates the cache on success. */
export function useSaveNeighborsConfig(): UseSaveNeighborsConfigResult {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, isSuccess } = useMutation({
    mutationFn: async (request: UpdateNeighborConfigRequest) => {
      const token = await getAccessToken();
      const result = await putNeighborsConfig(request, token);
      if (!result.ok) {
        throw new Error(`PUT /api/neighbors/config failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.neighbors.config(), saved);
    },
  });

  return { mutateAsync, isPending, isError, isSuccess };
}
