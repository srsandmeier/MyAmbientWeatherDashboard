/**
 * @p1 Layout unsaved-change guard tests.
 *
 * Verifies that Default and Custom layout edits block route navigation and continue
 * after the user chooses Save or Discard.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { test, expect, mockStation, buildDevicesBody } from '../fixtures';

async function getRenderedStationRowId(page: import('@playwright/test').Page): Promise<string> {
  const row = page.locator("[data-test-id^='settings-device-row-']").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const testId = await row.getAttribute('data-test-id');
  expect(testId).not.toBeNull();
  return testId?.replace('settings-device-row-', '') ?? '';
}

function buildCustomLayoutJson(): string {
  return JSON.stringify({
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Custom',
    layoutMode: 'custom',
    tiles: [],
    customItems: [],
    updatedAtUtc: '2026-06-01T00:00:00Z',
  });
}

test.describe('Layout unsaved-change guard @p1', () => {
  test('default metric edits can save and continue navigation', async ({
    settingsPage,
    homePage,
    context,
    page,
  }) => {
    let capturedSelectedMetricKeys: readonly string[] | null = null;

    await context.route('**/api/settings/devices**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: buildDevicesBody(mockStation),
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
      await route.fulfill({ status: 204 });
    });

    await test.step('make a default metric order edit', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

      const rowId = await getRenderedStationRowId(page);
      await expect(settingsPage.deviceMetricCategoryMoveUp(rowId, 'wind')).toBeVisible({ timeout: 10_000 });
      await settingsPage.deviceMetricCategoryMoveUp(rowId, 'wind').click();

      await settingsPage.dashboardLink.click();
      await expect(settingsPage.deviceUnsavedPrompt(rowId)).toBeVisible({ timeout: 10_000 });
      await settingsPage.deviceUnsavedSaveButton(rowId).click();
    });

    await expect.poll(() => capturedSelectedMetricKeys, { timeout: 10_000 }).not.toBeNull();
    await expect(page).toHaveURL(/\/$/);
    await expect(homePage.title).toBeVisible({ timeout: 15_000 });
  });

  test('custom layout edits can be discarded and continue navigation', async ({
    settingsPage,
    homePage,
    context,
    page,
  }) => {
    let saveCalls = 0;

    await context.route('**/api/settings/devices**', (route) =>
      route.fulfill({ contentType: 'application/json', body: buildDevicesBody(mockStation) }),
    );

    await context.route('**/api/dashboard/layout**', async (route) => {
      if (route.request().method() === 'PUT') {
        saveCalls += 1;
        await route.fulfill({ contentType: 'application/json', body: buildCustomLayoutJson() });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: buildCustomLayoutJson() });
    });

    await test.step('make a custom layout edit and discard it', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
      await expect(settingsPage.customLayoutBuilder).toBeVisible({ timeout: 15_000 });

      await settingsPage.addDividerButton.click();
      await settingsPage.dashboardLink.click();
      await expect(settingsPage.customLayoutUnsavedPrompt).toBeVisible({ timeout: 10_000 });
      await settingsPage.customLayoutUnsavedDiscardButton.click();
    });

    await expect.poll(() => saveCalls, { timeout: 5_000 }).toBe(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(homePage.title).toBeVisible({ timeout: 15_000 });
  });
});
