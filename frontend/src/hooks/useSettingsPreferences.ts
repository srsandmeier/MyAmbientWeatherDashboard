import { useQuery } from '@tanstack/react-query';
import { getPreferences } from '../api/settings';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { UserPreferencesDto } from '../types/settings';

export interface UseSettingsPreferencesResult {
  readonly data: UserPreferencesDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

/** TanStack Query hook for GET /api/settings/preferences. */
export function useSettingsPreferences(): UseSettingsPreferencesResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.settings.preferences(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getPreferences(token);
      if (!result.ok) {
        throw new Error(`GET /api/settings/preferences failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return { data, isPending, isError, refetch: () => { void refetch(); } };
}
