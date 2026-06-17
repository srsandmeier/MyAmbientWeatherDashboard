import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppUrl, getCurrentRouterPath, normalizeRouterPath } from './deploymentBase';

describe('deployment base helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('builds app URLs at the site root by default', () => {
    vi.stubEnv('BASE_URL', '/');

    expect(getAppUrl('/auth/callback')).toBe('http://localhost:3000/auth/callback');
  });

  it('builds app URLs under the GitHub Pages base path', () => {
    vi.stubEnv('BASE_URL', '/MyAmbientWeatherDashboard/');

    expect(getAppUrl('/auth/callback')).toBe(
      'http://localhost:3000/MyAmbientWeatherDashboard/auth/callback',
    );
  });

  it('strips the GitHub Pages base path before navigating with React Router', () => {
    vi.stubEnv('BASE_URL', '/MyAmbientWeatherDashboard/');

    expect(normalizeRouterPath('/MyAmbientWeatherDashboard/settings?tab=stations')).toBe(
      '/settings?tab=stations',
    );
  });

  it('returns the current location in React Router coordinates', () => {
    vi.stubEnv('BASE_URL', '/MyAmbientWeatherDashboard/');
    window.history.replaceState(null, '', '/MyAmbientWeatherDashboard/metrics/temp?range=24h#chart');

    expect(getCurrentRouterPath()).toBe('/metrics/temp?range=24h#chart');
  });
});
