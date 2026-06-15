/* eslint-disable react-refresh/only-export-components */
import { useAuth0 } from '@auth0/auth0-react';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

export interface AuthUser {
  readonly sub: string;
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string;
}

export interface AuthContextValue {
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly user: AuthUser | undefined;
  /** Defined when Auth0 returns an error (failed login, revoked token, bad callback). */
  readonly error: Error | undefined;
  readonly login: (returnTo?: string) => void;
  readonly logout: () => void;
  readonly getAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Reads the auth context. Must be used inside AppAuthProvider or MockAuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an auth provider');
  }
  return ctx;
}

/** Bridges Auth0's useAuth0 hook into our AuthContext. Rendered inside Auth0Provider. */
export function Auth0AuthBridge({ children }: { readonly children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const mappedUser: AuthUser | undefined = useMemo(
    () =>
      user
        ? { sub: user.sub ?? '', email: user.email, name: user.name, picture: user.picture }
        : undefined,
    [user],
  );

  const login = useCallback(
    (returnTo?: string) => { void loginWithRedirect({ appState: { returnTo } }); },
    [loginWithRedirect],
  );

  const logout = useCallback(
    () => { void auth0Logout({ logoutParams: { returnTo: window.location.origin } }); },
    [auth0Logout],
  );

  const getAccessToken = useCallback(
    () => getAccessTokenSilently(),
    [getAccessTokenSilently],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isLoading, error, user: mappedUser, login, logout, getAccessToken }),
    [isAuthenticated, isLoading, error, mappedUser, login, logout, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const MOCK_USER: AuthUser = {
  sub: 'test|mock-user',
  email: 'dev@localhost',
  name: 'Dev User',
};

/**
 * Drops in place of AppAuthProvider in Vitest tests and Storybook.
 * Avoids needing vi.mock('@auth0/auth0-react') in every test file.
 */
export function MockAuthProvider({
  children,
  authenticated = true,
  loading = false,
  user = MOCK_USER,
  error,
  onLogin,
}: {
  readonly children: ReactNode;
  readonly authenticated?: boolean;
  readonly loading?: boolean;
  readonly user?: AuthUser;
  readonly error?: Error;
  readonly onLogin?: (returnTo?: string) => void;
}) {
  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: authenticated,
      isLoading: loading,
      error,
      user: authenticated ? user : undefined,
      login: onLogin ?? (() => undefined),
      logout: () => undefined,
      getAccessToken: () => Promise.resolve('mock-token'),
    }),
    [authenticated, loading, error, user, onLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
