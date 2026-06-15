import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts } from '../api/alerts';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';

export function useActiveAlerts(areaCode?: string | null) {
  const { getAccessToken, isAuthenticated } = useAuth();
  const normalizedAreaCode = areaCode?.trim() ?? null;

  return useQuery({
    queryKey: queryKeys.alerts.active(normalizedAreaCode),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      const result = await getActiveAlerts(token, normalizedAreaCode, signal);
      if (!result.ok) {
        throw new Error(`GET /api/alerts/active failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  });
}
