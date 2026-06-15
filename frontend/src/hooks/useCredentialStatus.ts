import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import { getCredentialStatus } from '../api/settings';
import type { AmbientCredentialStatusDto } from '../types/settings';

export interface UseCredentialStatusResult {
  readonly data: AmbientCredentialStatusDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
}

export function useCredentialStatus(): UseCredentialStatusResult {
  const { getAccessToken, isAuthenticated } = useAuth();

  const { data, isPending, fetchStatus, isError } = useQuery({
    queryKey: queryKeys.settings.credentialsStatus(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getCredentialStatus(token);
      if (!result.ok) {
        throw new Error(`GET /api/settings/credentials failed: ${String(result.status)} ${result.error}`);
      }
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // When enabled:false the query parks at {isPending:true, fetchStatus:'idle'} without ever fetching.
  // Guard against that so callers see isPending=false for unauthenticated sessions.
  return { data, isPending: isPending && fetchStatus !== 'idle', isError };
}
