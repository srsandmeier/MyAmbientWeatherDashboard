import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppAuthProvider } from './AppAuthProvider';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

interface CapturedAuth0ProviderProps {
  readonly children: ReactNode;
  readonly domain: string;
  readonly clientId: string;
  readonly cacheLocation?: 'memory' | 'localstorage';
  readonly authorizationParams?: {
    readonly redirect_uri?: string;
    readonly audience?: string;
  };
  readonly onRedirectCallback?: (appState?: { readonly returnTo?: string }) => void;
}

let capturedProps: CapturedAuth0ProviderProps | null = null;

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: (props: CapturedAuth0ProviderProps) => {
    capturedProps = props;
    return <>{props.children}</>;
  },
}));

vi.mock('../config/app', () => ({
  getAuthConfig: () => ({
    domain: 'example.auth0.test',
    clientId: 'example-spa-client-id',
    audience: 'https://ambient-weather-dashboard-api',
  }),
}));

vi.mock('../lib/auth', () => ({
  Auth0AuthBridge: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
}));

vi.mock('../router', () => ({
  router: {
    navigate: routerMocks.navigate,
  },
}));

describe('AppAuthProvider', () => {
  const originalWebdriver = navigator.webdriver;

  beforeEach(() => {
    capturedProps = null;
    routerMocks.navigate.mockReset();
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'webdriver', {
      configurable: true,
      value: originalWebdriver,
    });
  });

  it('persists Auth0 cache in development so reloads do not require reauthorization', () => {
    render(
      <AppAuthProvider>
        <span>Dashboard</span>
      </AppAuthProvider>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(capturedProps).toMatchObject({
      domain: 'example.auth0.test',
      clientId: 'example-spa-client-id',
      cacheLocation: 'localstorage',
      authorizationParams: {
        redirect_uri: 'http://localhost:3000/auth/callback',
        audience: 'https://ambient-weather-dashboard-api',
      },
    });
  });

  it('uses the GitHub Pages base path for Auth0 callback URLs', () => {
    vi.stubEnv('BASE_URL', '/MyAmbientWeatherDashboard/');

    render(
      <AppAuthProvider>
        <span>Dashboard</span>
      </AppAuthProvider>,
    );

    expect(capturedProps?.authorizationParams?.redirect_uri).toBe(
      'http://localhost:3000/MyAmbientWeatherDashboard/auth/callback',
    );
  });

  it('normalizes Auth0 returnTo values before navigating with React Router', () => {
    vi.stubEnv('BASE_URL', '/MyAmbientWeatherDashboard/');

    render(
      <AppAuthProvider>
        <span>Dashboard</span>
      </AppAuthProvider>,
    );

    capturedProps?.onRedirectCallback?.({
      returnTo: '/MyAmbientWeatherDashboard/settings?tab=stations',
    });

    expect(routerMocks.navigate).toHaveBeenCalledWith('/settings?tab=stations');
  });

  it('uses memory cache in automated browsers so Playwright Auth0 mocks stay isolated', () => {
    Object.defineProperty(navigator, 'webdriver', {
      configurable: true,
      value: true,
    });

    render(
      <AppAuthProvider>
        <span>Dashboard</span>
      </AppAuthProvider>,
    );

    expect(capturedProps).toMatchObject({
      cacheLocation: 'memory',
    });
  });
});
