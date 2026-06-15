// ─── Auth0 SPA config ────────────────────────────────────────────────────────

interface AuthConfig {
  readonly domain: string;
  readonly clientId: string;
  readonly audience: string;
}

/**
 * Returns `value` when it is present and non-empty.
 * Throws when missing in every environment so local setup failures are explicit
 * instead of navigating the browser to placeholder Auth0 domains.
 */
function requireAuthEnv(varName: string, value: string | undefined): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  throw new Error(
    `Missing required environment variable: ${varName}. ` +
      'Copy frontend/.env.example to frontend/.env.local and set your Auth0 SPA values.',
  );
}

let _authConfig: AuthConfig | null = null;

/**
 * Returns the Auth0 SPA configuration.
 * Called lazily inside a component render so any missing-var throw is caught by
 * the nearest React ErrorBoundary rather than crashing at module load.
 */
export function getAuthConfig(): AuthConfig {
  if (_authConfig !== null) return _authConfig;
  _authConfig = {
    domain: requireAuthEnv('VITE_AUTH0_DOMAIN', import.meta.env.VITE_AUTH0_DOMAIN),
    clientId: requireAuthEnv('VITE_AUTH0_CLIENT_ID', import.meta.env.VITE_AUTH0_CLIENT_ID),
    audience: requireAuthEnv('VITE_AUTH0_AUDIENCE', import.meta.env.VITE_AUTH0_AUDIENCE),
  };
  return _authConfig;
}

// ─── General app config ───────────────────────────────────────────────────────

/** Frontend-safe runtime config derived from VITE_* environment variables. */
export const appConfig = {
  /** BFF base URL. Empty string uses the Vite /api proxy in development. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
} as const;
