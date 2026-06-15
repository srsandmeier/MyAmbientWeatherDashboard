import { useQuery } from '@tanstack/react-query';
import { getMetricHistory } from '../api/metrics';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { MetricHistoryParams, MetricHistoryResponse } from '../types/metrics';

interface UseMetricHistoryOptions {
  readonly enabled?: boolean;
}

export interface UseMetricHistoryResult {
  readonly data: MetricHistoryResponse | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

/** TanStack Query hook for GET /api/metrics/{metricKey}/history. */
export function useMetricHistory(
  metricKey: string | undefined,
  params: MetricHistoryParams,
  options: UseMetricHistoryOptions = {},
): UseMetricHistoryResult {
  const { getAccessToken, isAuthenticated } = useAuth();
  const enabled = (options.enabled ?? true) && isAuthenticated && Boolean(metricKey);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.metrics.history(metricKey ?? '', params),
    queryFn: async ({ signal }) => {
      if (!metricKey) {
        throw new Error('Metric key is required.');
      }

      const token = await getAccessToken();
      const result = await getMetricHistory(metricKey, params, token, signal);
      if (!result.ok) {
        throw new Error(`GET /api/metrics/${metricKey}/history failed: ${String(result.status)} ${result.error}`);
      }

      return result.data;
    },
    enabled,
    staleTime: 30_000,
  });

  return {
    data,
    isPending,
    isError,
    error,
    refetch: () => { void refetch(); },
  };
}
