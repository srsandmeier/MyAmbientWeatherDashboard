/**
 * @p1 Page-level axe audits for the main v1 surfaces.
 */

import type { BrowserContext } from '@playwright/test';
import { test, expect, mockStation } from '../fixtures';
import { expectNoAxeViolations } from '../fixtures/axe';

test.describe('Page-level axe audits @p1', () => {
  test('dashboard default layout has no axe violations', async ({ homePage, page }) => {
    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });
    await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });

    await expectNoAxeViolations(page, 'Dashboard default layout');
  });

  test('metric detail chart controls and table have no axe violations', async ({
    metricDetailPage,
    page,
  }) => {
    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.chart).toBeVisible({ timeout: 15_000 });
    await metricDetailPage.historyTableToggle.click();
    await expect(metricDetailPage.historyTableContent).toBeVisible();

    await expectNoAxeViolations(page, 'Metric detail chart controls and table');
  });

  test('settings default layout has no axe violations', async ({ settingsPage, page }) => {
    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });

    await expectNoAxeViolations(page, 'Settings default layout');
  });

  test('settings custom layout builder has no axe violations', async ({ settingsPage, page }) => {
    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });

    await settingsPage.layoutModeCustomButton.click();
    await expect(settingsPage.customLayoutBuilder).toBeVisible({ timeout: 5_000 });
    await settingsPage.addBlockButton.click();
    await expect(settingsPage.customLayoutItems).toHaveCount(1);
    if (!(await settingsPage.metricPickerStationSelect.isVisible())) {
      await settingsPage.customLayoutExpandButtons.last().click();
    }
    await expect(settingsPage.metricPickerStationSelect).toBeVisible({ timeout: 5_000 });

    await expectNoAxeViolations(page, 'Settings custom layout builder');
  });

  test('settings drawer and delete dialog have no axe violations', async ({
    settingsPage,
    context,
    page,
  }) => {
    await setupNeighborDrawerRoutes(context);
    await context.route('**/api/settings/credentials**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":true}' }),
    );

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openPublicNearby();

    await expect(settingsPage.neighborsSection).toBeVisible({ timeout: 5_000 });
    await settingsPage.neighborsRefreshButton.click();
    await expect(settingsPage.neighborsViewStationsButton).toBeVisible({ timeout: 5_000 });
    await settingsPage.neighborsViewStationsButton.click();
    await expect(settingsPage.neighborsStationDrawer).toBeVisible({ timeout: 5_000 });
    await expectNoAxeViolations(page, 'Settings neighbor drawer');

    await page.keyboard.press('Escape');
    await expect(settingsPage.neighborsStationDrawer).toHaveCount(0);

    await settingsPage.openAccountMenu();
    await expect(settingsPage.deleteCredentialsButton).toBeVisible({ timeout: 5_000 });
    await settingsPage.deleteCredentialsButton.click();
    await expect(settingsPage.deleteConfirmation).toBeVisible({ timeout: 5_000 });
    await expectNoAxeViolations(page, 'Settings delete credentials dialog');
  });
});

async function setupNeighborDrawerRoutes(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/neighbors/config**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        isEnabled: true,
        radiusMiles: 25,
        maxAgeMinutes: 30,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      }),
    }),
  );

  await ctx.route('**/api/neighbors/refresh**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          provider: 'WeatherGov',
          sourceId: 'generated-axe-neighbor',
          name: 'Generated Axe Neighbor',
          lat: mockStation.latitude,
          lon: mockStation.longitude,
          distanceMiles: 5.2,
          lastObservedAtUtc: '2026-06-04T01:00:00Z',
          freshnessMinutes: 10,
          tempF: 71.5,
          humidity: 68,
          windSpeedMph: 7.0,
        },
      ]),
    }),
  );
}
