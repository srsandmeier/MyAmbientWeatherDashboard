/**
 * @p1 Default dashboard metric ordering tests.
 *
 * Verifies that Settings -> My Stations default metric ordering saves selectedMetricKeys
 * and drives the Default dashboard category/field order.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { test, expect, mockStation } from '../fixtures';

function buildDeviceBody(selectedMetricKeys: readonly string[]): string {
  return JSON.stringify([
    {
      macAddress: mockStation.macAddress,
      name: 'Test Station',
      nickname: null,
      isPrimary: true,
      displayOnDashboard: true,
      selectedMetricKeys,
      latitude: mockStation.latitude,
      longitude: mockStation.longitude,
      elevationMeters: mockStation.elevationMeters,
      address: mockStation.address,
      location: mockStation.location,
      lastSyncAtUtc: '2026-06-01T00:00:00Z',
    },
  ]);
}

async function getRenderedStationRowId(page: import('@playwright/test').Page): Promise<string> {
  const row = page.locator("[data-test-id^='settings-device-row-']").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const testId = await row.getAttribute('data-test-id');
  expect(testId).not.toBeNull();
  return testId?.replace('settings-device-row-', '') ?? '';
}

test.describe('Default metric ordering @p1', () => {
  test('saves category and field order and dashboard follows it', async ({
    settingsPage,
    homePage,
    context,
    page,
  }) => {
    let selectedMetricKeys = ['outdoor_temp', 'wind_speed', 'wind_gust'];
    let capturedSelectedMetricKeys: readonly string[] | null = null;

    await context.route('**/api/settings/devices**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: buildDeviceBody(selectedMetricKeys),
        });
        return;
      }

      await route.continue();
    });

    await context.route('**/api/settings/devices/*', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const body = JSON.parse(route.request().postData() ?? '{}') as {
        readonly selectedMetricKeys?: readonly string[];
      };
      capturedSelectedMetricKeys = body.selectedMetricKeys ?? null;
      selectedMetricKeys = [...(body.selectedMetricKeys ?? selectedMetricKeys)];
      await route.fulfill({ status: 204 });
    });

    await test.step('move Wind before Temperature and Wind Gust before Wind Speed', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

      const stationRowId = await getRenderedStationRowId(page);
      await expect(settingsPage.deviceMetricCategoryMoveUp(stationRowId, 'wind')).toBeVisible({ timeout: 10_000 });

      await settingsPage.deviceMetricCategoryMoveUp(stationRowId, 'wind').click();
      await settingsPage.deviceMetricMoveUp(stationRowId, 'wind_gust').click();
      await settingsPage.deviceSaveButton(stationRowId).click();
    });

    await expect.poll(() => capturedSelectedMetricKeys, { timeout: 10_000 }).toEqual([
      'wind_gust',
      'wind_speed',
      'outdoor_temp',
    ]);

    await test.step('dashboard follows the saved category and field order', async () => {
      await homePage.gotoHome();
      await expect(homePage.sourceGroups).toBeVisible({ timeout: 15_000 });
    });

    const wrappers = page.getByTestId('dashboard-layout-tile-wrapper');
    await expect(wrappers.first()).toBeVisible({ timeout: 10_000 });
    await expect(wrappers.nth(0).getByTestId('dashboard-wind-tile')).toBeVisible();
    await expect(wrappers.nth(1).getByTestId('dashboard-temperature-tile')).toBeVisible();

    const windValues = page.getByTestId('dashboard-wind-value');
    await expect(windValues.nth(0)).toContainText('9.0 mph');
    await expect(windValues.nth(1)).toContainText('5.0 mph');
    await settingsPage.screenshot('p1-default-metric-ordering-dashboard.png');
  });
});
