/**
 * @p1 Settings preferences save/apply tests.
 *
 * Covers preference PUT payload and verifies saved units/theme/date formatting are consumed by
 * the Dashboard without reloading the app. All Auth0 and BFF calls are mocked.
 */

import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../fixtures';

interface PreferencesBody {
  readonly temperatureUnit: 'F' | 'C';
  readonly speedUnit: 'mph' | 'kmh' | 'ms';
  readonly pressureUnit: 'inhg' | 'hpa' | 'mbar';
  readonly rainfallUnit: 'in' | 'mm';
  readonly theme: 'system' | 'light' | 'dark';
  readonly dateFormat: 'mdy' | 'dmy' | 'iso';
  readonly temperatureDecimals: 0 | 1 | 2;
  readonly dailyExtremaTimezone: 'local' | 'utc';
}

const initialPreferences = {
  temperatureUnit: 'F',
  speedUnit: 'mph',
  pressureUnit: 'inhg',
  rainfallUnit: 'in',
  theme: 'system',
  dateFormat: 'mdy',
  temperatureDecimals: 1,
  dailyExtremaTimezone: 'local',
} satisfies PreferencesBody;

test.describe('Settings preferences @p1', () => {
  test('saves display preferences and dashboard applies units, date format, and theme', async ({
    settingsPage,
    homePage,
    context,
    page,
  }) => {
    let savedPreferences: PreferencesBody | null = null;
    await setupPreferencesRoute(context, (body) => { savedPreferences = body; });

    await test.step('open preferences', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
      await settingsPage.preferencesToggle.click();
      await expect(settingsPage.preferencesTemperatureSelect).toBeVisible({ timeout: 8_000 });
    });

    await test.step('change preferences and save', async () => {
      await settingsPage.preferencesTemperatureSelect.selectOption('C');
      await settingsPage.preferencesTemperatureDecimalsSelect.selectOption('0');
      await settingsPage.preferencesDateFormatSelect.selectOption('iso');
      await settingsPage.preferencesThemeSelect.selectOption('dark');
      await settingsPage.preferencesSaveButton.click();
      await expect(settingsPage.preferencesSavedMessage).toBeVisible({ timeout: 10_000 });
    });

    await expect.poll(() => savedPreferences, { timeout: 10_000 }).toMatchObject({
      temperatureUnit: 'C',
      temperatureDecimals: 0,
      dateFormat: 'iso',
      theme: 'dark',
    });

    await test.step('dashboard consumes saved preferences', async () => {
      await settingsPage.clickDashboardLink();
      await expect(homePage.title).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 10_000 });
      await expect(homePage.temperatureValues.first()).toContainText('22°C', { timeout: 10_000 });
      await expect(homePage.rainfallTile).toContainText('Last rain 2026-06-01', { timeout: 10_000 });
    });
  });
});

async function setupPreferencesRoute(
  ctx: BrowserContext,
  onSave: (body: PreferencesBody) => void,
): Promise<void> {
  let preferences: PreferencesBody = initialPreferences;

  await ctx.route('**/api/settings/preferences**', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}') as PreferencesBody;
      preferences = body;
      onSave(body);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(preferences) });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(preferences) });
  });
}
