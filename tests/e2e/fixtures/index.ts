import { test as base } from '@playwright/test';
import { mockStation } from './mockData';
import { setupAuth0MockRoutes } from './auth';
import { setupBffMockRoutes, blockExternalNetwork } from './bff';
import { HomePage } from '../pages/HomePage';
import { MetricDetailPage } from '../pages/MetricDetailPage';
import { SettingsPage } from '../pages/SettingsPage';

interface E2EFixtures {
  /** Dashboard home page with all mock routes pre-wired. */
  homePage: HomePage;
  /** Settings page with all mock routes pre-wired. */
  settingsPage: SettingsPage;
  /** Metric detail page with all mock routes pre-wired. */
  metricDetailPage: MetricDetailPage;
}

/**
 * Extended Playwright `test` with E2E-specific fixtures.
 *
 * Each fixture:
 * 1. Blocks unmatched external network calls (registered first = lowest LIFO priority).
 * 2. Sets up Auth0 OIDC mock routes.
 * 3. Sets up BFF API mock routes.
 * 4. Yields a typed page object to the test body.
 */
export const test = base.extend<E2EFixtures>({
  async homePage({ page, context }, use) {
    const capturedNonce = { value: 'fallback-nonce' };
    // blockExternalNetwork registered FIRST so it has lowest LIFO priority
    await blockExternalNetwork(context);
    await setupAuth0MockRoutes(context, capturedNonce);
    await setupBffMockRoutes(context, mockStation);
    await use(new HomePage(page));
  },

  async settingsPage({ page, context }, use) {
    const capturedNonce = { value: 'fallback-nonce' };
    await blockExternalNetwork(context);
    await setupAuth0MockRoutes(context, capturedNonce);
    await setupBffMockRoutes(context, mockStation);
    await use(new SettingsPage(page));
  },

  async metricDetailPage({ page, context }, use) {
    const capturedNonce = { value: 'fallback-nonce' };
    await blockExternalNetwork(context);
    await setupAuth0MockRoutes(context, capturedNonce);
    await setupBffMockRoutes(context, mockStation);
    await use(new MetricDetailPage(page));
  },
});

export { expect } from '@playwright/test';
export { mockStation } from './mockData';
export { buildDevicesBody, setupBffMockRoutes } from './bff';
