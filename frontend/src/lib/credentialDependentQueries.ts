import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

/** Clears cached data that depends on saved Ambient credentials. */
export function clearCredentialDependentQueries(queryClient: QueryClient): void {
  queryClient.setQueryData(queryKeys.settings.credentialsStatus(), { hasCredentials: false });
  queryClient.setQueryData(queryKeys.settings.devices(), []);
  queryClient.removeQueries({ queryKey: queryKeys.dashboard.current(), exact: true });
  queryClient.removeQueries({ queryKey: queryKeys.dashboard.rainfall(), exact: true });
  queryClient.removeQueries({ queryKey: queryKeys.dashboard.extrema(), exact: true });

  void queryClient.invalidateQueries({ queryKey: queryKeys.settings.credentialsStatus() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.settings.devices() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.current() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.rainfall() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.extrema() });
}
