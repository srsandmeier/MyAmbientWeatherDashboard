import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('getAuthConfig', () => {
  it('throws a clear setup error when Auth0 env values are missing', async () => {
    vi.stubEnv('VITE_AUTH0_DOMAIN', '');
    vi.stubEnv('VITE_AUTH0_CLIENT_ID', '');
    vi.stubEnv('VITE_AUTH0_AUDIENCE', '');

    const { getAuthConfig } = await import('./app');

    expect(() => getAuthConfig()).toThrow(
      'Missing required environment variable: VITE_AUTH0_DOMAIN. Copy frontend/.env.example to frontend/.env.local and set your Auth0 SPA values.',
    );
  });

  it('returns explicit Auth0 env values', async () => {
    vi.stubEnv('VITE_AUTH0_DOMAIN', 'example.auth0.test');
    vi.stubEnv('VITE_AUTH0_CLIENT_ID', 'example-spa-client-id');
    vi.stubEnv('VITE_AUTH0_AUDIENCE', 'https://ambient-weather-dashboard-api');

    const { getAuthConfig } = await import('./app');

    expect(getAuthConfig()).toEqual({
      domain: 'example.auth0.test',
      clientId: 'example-spa-client-id',
      audience: 'https://ambient-weather-dashboard-api',
    });
  });
});
