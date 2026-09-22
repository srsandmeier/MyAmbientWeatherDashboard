import { useAuth0 } from '@auth0/auth0-react';
import { render, renderHook, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Auth0AuthBridge, MockAuthProvider, useAuth } from './auth';

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }));

function mockAuth0Token(token: string | undefined) {
  vi.mocked(useAuth0).mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    error: undefined,
    user: undefined,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue(token),
  } as unknown as ReturnType<typeof useAuth0>);
}

function bridgeWrapper({ children }: { readonly children: ReactNode }) {
  return <Auth0AuthBridge>{children}</Auth0AuthBridge>;
}

function UserDisplay() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <p>Signed out</p>;
  return <p>Signed in as {user?.email}</p>;
}

describe('MockAuthProvider', () => {
  it('provides authenticated state by default', () => {
    render(
      <MockAuthProvider>
        <UserDisplay />
      </MockAuthProvider>,
    );
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
  });

  it('provides unauthenticated state when authenticated=false', () => {
    render(
      <MockAuthProvider authenticated={false}>
        <UserDisplay />
      </MockAuthProvider>,
    );
    expect(screen.getByText('Signed out')).toBeInTheDocument();
  });

  it('exposes the mock user email', () => {
    render(
      <MockAuthProvider user={{ sub: 'test|1', email: 'sky@example.com' }}>
        <UserDisplay />
      </MockAuthProvider>,
    );
    expect(screen.getByText('Signed in as sky@example.com')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MockAuthProvider>
        <UserDisplay />
      </MockAuthProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('useAuth', () => {
  it('throws when used outside a provider', () => {
    const consoleError = console.error;
    console.error = () => undefined;
    expect(() => render(<UserDisplay />)).toThrow('useAuth must be used within an auth provider');
    console.error = consoleError;
  });
});

describe('Auth0AuthBridge', () => {
  it('returns the access token from Auth0', async () => {
    mockAuth0Token('access-token');
    const { result } = renderHook(() => useAuth(), { wrapper: bridgeWrapper });
    await expect(result.current.getAccessToken()).resolves.toBe('access-token');
  });

  it('rejects when Auth0 returns no access token', async () => {
    mockAuth0Token(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper: bridgeWrapper });
    await expect(result.current.getAccessToken()).rejects.toThrow('Auth0 returned no access token');
  });
});
