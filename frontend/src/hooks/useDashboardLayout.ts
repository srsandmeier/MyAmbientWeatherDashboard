import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardLayout, putDashboardLayout } from '../api/dashboard';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { DashboardLayoutDto, SaveDashboardLayoutRequest } from '../types/dashboard';

export interface UseDashboardLayoutResult {
  readonly data: DashboardLayoutDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

/**
 * TanStack Query hook for GET /api/dashboard/layout.
 * Fetched once on mount; not polled on a schedule since layout only changes on save.
 * Window-focus refetch is enabled so an error state recovers when the user returns to the tab.
 * @param enabled - set to false to skip fetching (e.g. when credentials are absent).
 */
export function useDashboardLayout(enabled = true): UseDashboardLayoutResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.layout(),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getDashboardLayout(token, signal);
      if (!result.ok) {
        throw new Error(`GET /api/dashboard/layout failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
    refetchInterval: false,
  });

  return { data, isPending, isError, error, refetch: () => { void refetch(); } };
}

export interface UseSaveDashboardLayoutResult {
  readonly mutateAsync: (request: SaveDashboardLayoutRequest) => Promise<DashboardLayoutDto>;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
}

/** Mutation hook for PUT /api/dashboard/layout. Writes the saved layout into the query cache on success. */
export function useSaveDashboardLayout(): UseSaveDashboardLayoutResult {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, isSuccess } = useMutation({
    mutationFn: async (request: SaveDashboardLayoutRequest) => {
      const token = await getAccessToken();
      const result = await putDashboardLayout(request, token);
      if (!result.ok) {
        throw new Error(`PUT /api/dashboard/layout failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.dashboard.layout(), saved);
    },
  });

  return { mutateAsync, isPending, isError, isSuccess };
}
