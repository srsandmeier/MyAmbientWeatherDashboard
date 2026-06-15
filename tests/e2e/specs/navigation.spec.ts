/**
 * @p0 Route-navigation regression tests.
 *
 * Verifies that traversing Dashboard → Settings → Dashboard → MetricDetail
 * produces no blank pages, no React error boundaries, and no unhandled JS errors.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { test, expect } from '../fixtures';
import { MetricDetailPage } from '../pages/MetricDetailPage';

test.describe('Navigation @p0', () => {
  test('round trip: Dashboard → Settings → Dashboard → MetricDetail', async ({
    homePage,
    page,
  }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await test.step('land on dashboard', async () => {
      await homePage.gotoHome();
      await expect(homePage.title).toBeVisible({ timeout: 30_000 });
      expect(await homePage.isErrorBoundaryVisible(), 'Error boundary after initial dashboard load').toBe(false);
    });

    await test.step('navigate to settings', async () => {
      await homePage.clickSettingsLink();
      await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 });
      expect(await homePage.isErrorBoundaryVisible(), 'Error boundary on Settings').toBe(false);
    });

    await test.step('return to dashboard', async () => {
      await homePage.clickDashboardLink();
      await expect(homePage.title).toBeVisible({ timeout: 15_000 });
      expect(await homePage.isErrorBoundaryVisible(), 'Error boundary after returning to Dashboard').toBe(false);
    });

    await test.step('navigate to metric detail via URL', async () => {
      await homePage.goto('/metrics/outdoor_temp');
      const detail = new MetricDetailPage(page);
      await expect(detail.root).toBeVisible({ timeout: 15_000 });
      expect(await detail.isErrorBoundaryVisible(), 'Error boundary on MetricDetailPage').toBe(false);
    });

    expect(jsErrors, `Unhandled JS errors during navigation: ${jsErrors.join('; ')}`).toHaveLength(0);
    await page.screenshot({ path: 'test-results/p0-nav-round-trip.png', fullPage: true });
  });
});
