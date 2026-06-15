import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPublicSource,
  deletePublicSource,
  getPublicSources,
  updatePublicSource,
} from '../api/publicSources';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type {
  CreatePublicWeatherSourceRequest,
  PublicWeatherSourceDto,
  UpdatePublicWeatherSourceRequest,
} from '../types/publicSources';

export function usePublicSources(enabled = true) {
  const { getAccessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.settings.publicSources.list(),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getPublicSources(token, signal);
      if (!result.ok) {
        throw new Error(`GET /api/public-sources failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: enabled && isAuthenticated,
    staleTime: 60_000,
  });
}

export function useCreatePublicSource() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreatePublicWeatherSourceRequest) => {
      const token = await getAccessToken();
      const result = await createPublicSource(body, token);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (source) => {
      queryClient.setQueryData<readonly PublicWeatherSourceDto[] | undefined>(
        queryKeys.settings.publicSources.list(),
        (current) => [...(current ?? []), source],
      );
    },
  });
}

export function useUpdatePublicSource() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body }: { readonly id: string; readonly body: UpdatePublicWeatherSourceRequest }) => {
      const token = await getAccessToken();
      const result = await updatePublicSource(id, body, token);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (source) => {
      queryClient.setQueryData<readonly PublicWeatherSourceDto[] | undefined>(
        queryKeys.settings.publicSources.list(),
        (current) => (current ?? []).map((item) => (item.id === source.id ? source : item)),
      );
    },
  });
}

export function useDeletePublicSource() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const result = await deletePublicSource(id, token);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<readonly PublicWeatherSourceDto[] | undefined>(
        queryKeys.settings.publicSources.list(),
        (current) => (current ?? []).filter((item) => item.id !== id),
      );
    },
  });
}
