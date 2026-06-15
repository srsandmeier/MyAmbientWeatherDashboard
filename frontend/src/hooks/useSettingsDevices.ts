import { useQuery } from '@tanstack/react-query';
import { getDevices } from '../api/settings';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import { withRuntimeMockStations } from '../lib/runtimeMockStations';
import type { SettingsDeviceDto } from '../types/settings';

export interface UseSettingsDevicesResult {
  readonly data: readonly SettingsDeviceDto[] | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

/**
 * TanStack Query hook for GET /api/settings/devices.
 * Provides the list of synced stations including per-device selectedMetricKeys,
 * used by the dashboard to filter which metric tiles are displayed.
 * Shares the same query cache as the settings page's device list.
 */
export function useSettingsDevices(): UseSettingsDevicesResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.settings.devices(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getDevices(token);
      if (!result.ok) {
        if (result.status === 428) {
          return [];
        }

        throw new Error(`GET /api/settings/devices failed: ${String(result.status)} ${result.error}`);
      }
      return withRuntimeMockStations(result.data);
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  return { data, isPending, isError, refetch: () => { void refetch(); } };
}
