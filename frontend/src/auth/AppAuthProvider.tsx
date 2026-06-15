import { Auth0Provider } from '@auth0/auth0-react';
import type { ReactNode } from 'react';
import { getAuthConfig } from '../config/app';
import { Auth0AuthBridge } from '../lib/auth';
import { router } from '../router';

interface AppAuthProviderProps {
  readonly children: ReactNode;
}

export function AppAuthProvider({ children }: AppAuthProviderProps) {
  // getAuthConfig() is called here (inside render) so any missing-var throw in production
  // is caught by the ErrorBoundary above rather than crashing at module load.
  const { domain, clientId, audience } = getAuthConfig();
  const cacheLocation = import.meta.env.DEV && !navigator.webdriver ? 'localstorage' : 'memory';

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation={cacheLocation}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/auth/callback`,
        audience,
      }}
      onRedirectCallback={(appState) => {
        void router.navigate(appState?.returnTo ?? '/');
      }}
    >
      <Auth0AuthBridge>{children}</Auth0AuthBridge>
    </Auth0Provider>
  );
}
