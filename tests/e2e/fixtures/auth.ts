import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext } from '@playwright/test';

interface Auth0Config {
  readonly domain: string;
  readonly clientId: string;
}

function parseEnvValue(lines: readonly string[], key: string): string {
  const line = lines.find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : '';
}

function readAuth0Config(): Auth0Config {
  // auth.ts lives at tests/e2e/fixtures/ — go up 3 levels to reach the repo root
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const envLocal = path.join(repoRoot, 'frontend', '.env.local');
  if (fs.existsSync(envLocal)) {
    const lines = fs.readFileSync(envLocal, 'utf-8').split('\n');
    const domain = parseEnvValue(lines, 'VITE_AUTH0_DOMAIN');
    const clientId = parseEnvValue(lines, 'VITE_AUTH0_CLIENT_ID');
    if (domain && clientId) return { domain, clientId };
  }
  console.warn('[E2E] frontend/.env.local not found — using fallback Auth0 config (auth mocks will not intercept real requests)');
  return { domain: 'example.auth0.test', clientId: 'example-spa-client-id' };
}

const auth0Config = readAuth0Config();

interface TestKey {
  privateKey: crypto.KeyObject;
  jwks: string;
  kid: string;
}

let cachedKey: TestKey | undefined;

function getTestKey(): TestKey {
  if (!cachedKey) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const pub = publicKey.export({ format: 'jwk' }) as JsonWebKey;
    const jwks = JSON.stringify({
      keys: [{ kty: 'RSA', kid, use: 'sig', alg: 'RS256', n: pub.n, e: pub.e }],
    });
    cachedKey = { privateKey, jwks, kid };
  }
  return cachedKey;
}

function b64url(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signJwt(payload: Record<string, unknown>): string {
  const { privateKey, kid } = getTestKey();
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const body = b64url(JSON.stringify(payload));
  const toSign = `${header}.${body}`;
  const sig = crypto
    .createSign('SHA256')
    .update(toSign)
    .sign(privateKey)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${toSign}.${sig}`;
}

/**
 * Registers Auth0 OIDC mock routes on the browser context so no real Auth0 tenant is
 * contacted. The `capturedNonce` object is mutated by the /authorize handler so the
 * /oauth/token handler can embed the correct nonce in the id_token.
 */
export async function setupAuth0MockRoutes(
  ctx: BrowserContext,
  capturedNonce: { value: string },
): Promise<void> {
  const { domain, clientId } = auth0Config;
  const { jwks } = getTestKey();
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

  await ctx.route(`**/${domain}/.well-known/openid-configuration**`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        issuer: `https://${domain}/`,
        authorization_endpoint: `https://${domain}/authorize`,
        token_endpoint: `https://${domain}/oauth/token`,
        userinfo_endpoint: `https://${domain}/userinfo`,
        jwks_uri: `https://${domain}/.well-known/jwks.json`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'email'],
      }),
    }),
  );

  await ctx.route(`**/${domain}/.well-known/jwks.json**`, (route) =>
    route.fulfill({ contentType: 'application/json', body: jwks }),
  );

  await ctx.route(`**/${domain}/authorize**`, async (route) => {
    const url = new URL(route.request().url());
    const nonce = url.searchParams.get('nonce') ?? capturedNonce.value;
    capturedNonce.value = nonce;
    const mode = url.searchParams.get('response_mode') ?? '';
    const state = url.searchParams.get('state') ?? '';

    if (mode === 'web_message') {
      const redirectUri = url.searchParams.get('redirect_uri') ?? baseUrl;
      const origin = new URL(redirectUri).origin;
      await route.fulfill({
        contentType: 'text/html',
        body: `<html><body><script>
window.parent.postMessage({
  type:'authorization_response',
  response:{code:'smoke-code',state:'${state}'}
}, '${origin}');
</script></body></html>`,
      });
    } else {
      const redirectUri = url.searchParams.get('redirect_uri') ?? `${baseUrl}/auth/callback`;
      await route.fulfill({
        status: 302,
        headers: { Location: `${redirectUri}?code=smoke-code&state=${encodeURIComponent(state)}` },
      });
    }
  });

  await ctx.route(`**/${domain}/oauth/token**`, (route) => {
    const now = Math.floor(Date.now() / 1000);
    const idToken = signJwt({
      iss: `https://${domain}/`,
      sub: 'smoke|test-user',
      aud: clientId,
      azp: clientId,
      iat: now,
      exp: now + 86400,
      email: 'smoke@test.local',
      name: 'Smoke Test',
      nonce: capturedNonce.value,
    });
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'smoke-access-token',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 86400,
        scope: 'openid profile email',
      }),
    });
  });

  await ctx.route(`**/${domain}/userinfo**`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ sub: 'smoke|test-user', email: 'smoke@test.local', name: 'Smoke Test' }),
    }),
  );
}
