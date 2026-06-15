async (page) => {
  const domain = 'dev-t1wzxv2p0akx6pc6.us.auth0.com';
  const clientId = 'o4MDrRaRoWDNNIoujO5f6xz5mPbpAzjv';
  const baseUrl = 'http://localhost:5173';
  const kid = 'test-kid-1';

  // Pre-generated RSA key pair (private key for signing, public key for JWKS)
  const privateJwk = {"kty":"RSA","n":"q9YeZ5GxN7WAeHVAmUzL_Flr-BHl2NIVfEXWyP8eKvblOAh0l6UEybDfaKcIAFzVDIpgG3_iwnKuVqI4v_KzVkQk7Zzfe-vZGZWxJW3AUvSHgR8cU8KF7a0avTIfUrYjbc88KpbUr-4nPQ211QyOQRIOQJN8EzyK_JU-vhOkQKh5opICm_JdpdBGbxVKXlROjPS8aXviF_ZCRSMaoS83mKVEHz7Liaso4nTS9Ov-K69F7v4HJ6TZIso02aGRm3LtUDLNyVounfgKfzd-ptQcDUe87g6-sxwpHJ17MAgGrKSwxkhgEepsUtcLqh1_pr5Zi39I-9gkYTFrqvl4bRHl_w","e":"AQAB","d":"RCsybqXmpxITADaLxQUpW1fiNExtYYGeUmmmVqCWyDagIoWAM3ScnKLVTkANNY-eWVY_4EjwnXE_ZlD-sG9I4-0utTDpm9CplLPEzfNnO8GUTA4af8QIu4xTskDDGl31Wie_V6n0gEK7QEZDH1zWxkuyab3YmA0JmkBe3qsOGzPUd455UEAKIjl6aie6t5PdnbnSAf63_hCdDb45mFsVrSKwXUCV0fWdMk1HH9DQ6F5luF-96vo8Xa0GJ4KXTKfIyZnS45KLWHQ5Ww8AflwhiGQhyF7BfnTZZ2zhAKdA4guyNoqyKvYqamULDmJxMWac06EDzHgNjkSLC6sbiBd4KQ","p":"1LnE86L4sXHpzO6WR-Ldg6WxiG5jkoj5bvcC84Hhn2VYQXFsIVwk_OipVzWMWAOUnTAcM7gOVfPloqW_3UASIn4mThf7ldBJ1rZGjcXd4prllVmuhruFptZNmBLKElNJ3wuHAHpcHoaInXpOBNZmYgcmADTJRgfCSNrrPyIfnqs","q":"zsrv4w9LPNDvxfbAZtrU8Xdmz4xLbJuiadNbNYCZj2pFOg51EBqQtL6zfjfWMbWxu8-Ov3M_1HyjIfn6CYRl3mRBA_AO4VK7JwBYFnghJYCf8yHL2jdZxt9sQDU8SP8qJ7eJVG3uaYU4QGfwzfgnsmlhc-QJsunDfPcqG3IqRf0","dp":"fzF8k_j0HpVwKHrYHK-Hp7mhB2SJ4QpJqpHDj_ou__HG7Yp2DxRbgWVUK7L28YFikQI9Oqdo2vf0bGYS7KXssfcfzD4GzjM2k011rjuLSn03nS98bU8ewP0OdEl3zbFDUDxCQoTnI9FpSk_g6n-PxDll_WWSm270Oj-7vYoXwfU","dq":"Dt_WBXUSKlu1A35ONJfE_WFjScaDnlpLgmUriFupsAEq3ZQwo2nlwrp82rVVeNni4Ol7ERZPHw-gBE-gxpJ5aVe4vXnE-DwlLhb-Pw-BAtuPpcNmkFmu4XkspimuHmoMNDMlc6c8oOZuN2PClG4nHNQrqFRcxju-TfzRUIwTslk","qi":"n0JmRIDW1LSVVGSRbpjqsEyzg0PQsGdaM9YGx1icpC-l-f6ljj9xKo-NUK_jdTLIsieDUomoobhq4ZCdQWnWhxO90r_3DeQTBC0XMBa-UIdDl_3FSnu0dABgHuywz4ZPO-ITDFZyl6yUsp4bUGizASz_Dxd75jUAESRxORqCotQ"};
  const pubN = 'q9YeZ5GxN7WAeHVAmUzL_Flr-BHl2NIVfEXWyP8eKvblOAh0l6UEybDfaKcIAFzVDIpgG3_iwnKuVqI4v_KzVkQk7Zzfe-vZGZWxJW3AUvSHgR8cU8KF7a0avTIfUrYjbc88KpbUr-4nPQ211QyOQRIOQJN8EzyK_JU-vhOkQKh5opICm_JdpdBGbxVKXlROjPS8aXviF_ZCRSMaoS83mKVEHz7Liaso4nTS9Ov-K69F7v4HJ6TZIso02aGRm3LtUDLNyVounfgKfzd-ptQcDUe87g6-sxwpHJ17MAgGrKSwxkhgEepsUtcLqh1_pr5Zi39I-9gkYTFrqvl4bRHl_w';
  const jwks = JSON.stringify({ keys: [{ kty: 'RSA', kid, use: 'sig', alg: 'RS256', n: pubN, e: 'AQAB' }] });

  // Sign JWT payload using WebCrypto on the current page (localhost = secure context)
  async function signJwt(payload) {
    return page.evaluate(async ([privJwk, kidVal, payloadStr]) => {
      function b64url(data) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        let bin = '';
        new Uint8Array(bytes).forEach(b => { bin += String.fromCharCode(b); });
        return btoa(bin).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      }
      const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: kidVal }));
      const body = b64url(payloadStr);
      const toSign = `${header}.${body}`;
      const privKey = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign'],
      );
      const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privKey, new TextEncoder().encode(toSign));
      let bin = '';
      new Uint8Array(sigBuf).forEach(b => { bin += String.fromCharCode(b); });
      const sig = btoa(bin).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      return `${toSign}.${sig}`;
    }, [privateJwk, kid, JSON.stringify(payload)]);
  }

  let capturedNonce = '';

  await page.route(`**/${domain}/.well-known/openid-configuration**`, route => route.fulfill({
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
      scopes_supported: ['openid','profile','email'],
    }),
  }));
  await page.route(`**/${domain}/.well-known/jwks.json**`, route =>
    route.fulfill({ contentType: 'application/json', body: jwks })
  );
  await page.route(`**/${domain}/authorize**`, async route => {
    const url = new URL(route.request().url());
    capturedNonce = url.searchParams.get('nonce') ?? '';
    const mode = url.searchParams.get('response_mode') ?? '';
    const state = url.searchParams.get('state') ?? '';
    if (mode === 'web_message') {
      const redirectUri = url.searchParams.get('redirect_uri') ?? baseUrl;
      const origin = new URL(redirectUri).origin;
      await route.fulfill({ contentType: 'text/html', body: `<html><body><script>window.parent.postMessage({type:'authorization_response',response:{code:'smoke-code',state:'${state}'}},'${origin}');</script></body></html>` });
    } else {
      const redirectUri = url.searchParams.get('redirect_uri') ?? `${baseUrl}/auth/callback`;
      await route.fulfill({ status: 302, headers: { Location: `${redirectUri}?code=smoke-code&state=${encodeURIComponent(state)}` } });
    }
  });
  await page.route(`**/${domain}/oauth/token**`, async route => {
    const now = Math.floor(Date.now() / 1000);
    const idToken = await signJwt({ iss: `https://${domain}/`, sub: 'smoke|test-user', aud: clientId, azp: clientId, iat: now, exp: now + 86400, email: 'smoke@test.local', name: 'Smoke Test', nonce: capturedNonce });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: 'smoke-access-token', id_token: idToken, token_type: 'Bearer', expires_in: 86400, scope: 'openid profile email' }) });
  });
  await page.route(`**/${domain}/userinfo**`, route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ sub: 'smoke|test-user', email: 'smoke@test.local', name: 'Smoke Test' }) })
  );
  await page.route('**/api/settings/credentials**', route => route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":true}' }));
  await page.route('**/api/settings/preferences**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ temperatureUnit:'F', speedUnit:'mph', pressureUnit:'inhg', rainfallUnit:'in', theme:'light', dateFormat:'mdy', temperatureDecimals:1, distanceUnit:'mi', dailyExtremaTimezone:'local' }) }));
  await page.route('**/api/settings/devices**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ macAddress:'00:11:22:33:44:55', name:'Test Station', nickname:null, isPrimary:true, displayOnDashboard:true, selectedMetricKeys:['outdoor_temp','outdoor_humidity','wind_speed','rainfall_day'], latitude:null, longitude:null, elevationMeters:null, address:null, location:null, lastSyncAtUtc:'2026-06-01T00:00:00Z' }]) }));
  await page.route('**/api/public-sources**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/alerts/active**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/dashboard/current**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ deviceId:'00:11:22:33:44:55', deviceName:'Test Station', timestampUtc:'2026-05-31T12:00:00Z', receivedAtUtc:'2026-05-31T12:00:01Z', tempF:72.4, humidity:62, windSpeedMph:5.0, windGustMph:9.0, windDir:180, dailyRainIn:0.1, baromRelIn:29.92 }) }));
  await page.route('**/api/dashboard/rainfall**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ deviceId:'00:11:22:33:44:55', deviceName:'Test Station', timestampUtc:'2026-05-31T12:00:00Z', receivedAtUtc:'2026-05-31T12:00:01Z', eventRainIn:0.0, dailyRainIn:0.1, weeklyRainIn:0.5, monthlyRainIn:1.2, yearlyRainIn:10.5, lastRain:'2026-05-30T08:00:00Z' }) }));
  await page.route('**/api/dashboard/daily-extremes**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ dailyHighTempF:78.2, dailyLowTempF:61.5, dailyHighTempInF:null, dailyLowTempInF:null }) }));
  await page.route('**/api/dashboard/layout**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ mode:'classic', items:[] }) }));
  await page.route('**/api/neighbors/config**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled:false, radiusMiles:10, maxNeighbors:5, isAmbientOpenAvailable:false }) }));
  await page.route('**hubs/weather**', route => route.abort());

  await page.goto(baseUrl);
  await page.waitForURL('**/auth/callback**', { timeout: 10000 }).catch(() => {});
  await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  return page.url();
}
