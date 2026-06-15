/**
 * @p0 Dashboard current-data tests.
 *
 * Verifies that the Default dashboard renders live mocked current-reading data.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { test, expect } from '../fixtures';

test.describe('Dashboard current data @p0', () => {
  test('shows temperature from current reading', async ({ homePage }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    const errorBoundaryVisible = await homePage.isErrorBoundaryVisible();
    expect(errorBoundaryVisible, 'React error boundary should not be visible').toBe(false);

    await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });
    await expect(homePage.temperatureValues.first()).toBeVisible({ timeout: 10_000 });
    await expect(homePage.temperatureValues.first()).toContainText('72.4');
    await homePage.screenshot('p0-dashboard-current-temp.png');
  });

  test('shows station name in hub state', async ({ homePage }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.weatherHubState).toBeVisible({ timeout: 30_000 });
    await expect(homePage.weatherHubState).toContainText('Test Station');
    await homePage.screenshot('p0-dashboard-hub-state.png');
  });

  test('renders rainfall tile', async ({ homePage }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });
    await expect(homePage.rainfallTile).toBeVisible({ timeout: 10_000 });
    await homePage.screenshot('p0-dashboard-rainfall-tile.png');
  });

  test('opens metric detail from a dashboard value click', async ({ homePage, page }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });

    await test.step('open outdoor temperature history', async () => {
      await homePage.metricHistoryLink('outdoor_temp').click();
      await expect(page.getByTestId('metric-detail-page')).toBeVisible({ timeout: 15_000 });
    });

    await expect(page).toHaveURL(/\/metrics\/outdoor_temp\?deviceId=/);
    await expect(page.getByTestId('metric-detail-title')).toHaveText('Outdoor Temperature');
    await expect(page.getByTestId('metric-detail-chart')).toBeVisible({ timeout: 10_000 });
    await homePage.screenshot('p0-dashboard-click-to-metric-detail.png');
  });

  test('opens metric detail from keyboard activation on a dashboard value', async ({ homePage, page }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });

    await test.step('focus and activate outdoor temperature history', async () => {
      await homePage.metricHistoryLink('outdoor_temp').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('metric-detail-page')).toBeVisible({ timeout: 15_000 });
    });

    await expect(page).toHaveURL(/\/metrics\/outdoor_temp\?deviceId=/);
    await expect(page.getByTestId('metric-detail-title')).toHaveText('Outdoor Temperature');
    await expect(page.getByTestId('metric-detail-chart')).toBeVisible({ timeout: 10_000 });
    await homePage.screenshot('p0-dashboard-keyboard-to-metric-detail.png');
  });

  test('shows setup prompt when Ambient credentials are missing', async ({ homePage, context, page }) => {
    await context.route('**/api/settings/credentials**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":false}' }),
    );
    await context.route('**/api/settings/devices**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '[]' }),
    );
    await context.route('**/api/dashboard/current**', (route) =>
      route.fulfill({ status: 428, contentType: 'text/plain', body: 'ambient-credentials-required' }),
    );
    await context.route('**/api/dashboard/rainfall**', (route) =>
      route.fulfill({ status: 428, contentType: 'text/plain', body: 'ambient-credentials-required' }),
    );
    await context.route('**/api/dashboard/layout**', (route) =>
      route.fulfill({ status: 428, contentType: 'text/plain', body: 'ambient-credentials-required' }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());

    await expect(homePage.setupPrompt).toBeVisible({ timeout: 15_000 });
    await expect(homePage.setupPrompt).toContainText('Save your Ambient Weather credentials');
    await expect(page.getByTestId('dashboard-alert')).toHaveCount(0);
    await expect(homePage.setupLink).toHaveAttribute('href', '/settings');
    await homePage.screenshot('p0-dashboard-missing-credentials-prompt.png');
  });

  test('shows setup prompt when no stations are synced', async ({ homePage, context, page }) => {
    await context.route('**/api/settings/devices**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '[]' }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());

    await expect(homePage.setupPrompt).toBeVisible({ timeout: 15_000 });
    await expect(homePage.setupPrompt).toContainText('No dashboard stations are enabled');
    await expect(page.getByTestId('dashboard-alert')).toHaveCount(0);
    await expect(homePage.setupLink).toHaveAttribute('href', '/settings');
    await homePage.screenshot('p0-dashboard-no-stations-prompt.png');
  });

  test('no React error boundary visible', async ({ homePage, page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });

    const errorBoundaryVisible = await homePage.isErrorBoundaryVisible();
    expect(errorBoundaryVisible).toBe(false);
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    await homePage.screenshot('p0-dashboard-no-errors.png');
  });
});
