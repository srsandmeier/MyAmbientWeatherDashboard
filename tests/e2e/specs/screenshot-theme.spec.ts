/**
 * Temporary screenshot spec for theme/gradient inspection.
 * Run: cd tests/e2e && npx playwright test specs/screenshot-theme.spec.ts
 */
import { test, expect } from '../fixtures';

test.describe('Theme screenshots', () => {
  test('dashboard light mode', async ({ homePage, page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'screenshots/dashboard-light.png', fullPage: true });
  });

  test('dashboard dark mode', async ({ homePage, page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => { document.documentElement.classList.add('dark'); });
    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => { document.documentElement.classList.add('dark'); });
    await page.screenshot({ path: 'screenshots/dashboard-dark.png', fullPage: true });
  });

  test('settings light mode', async ({ settingsPage, page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await settingsPage.gotoSettings();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/settings-light.png', fullPage: true });
  });

  test('settings dark mode', async ({ settingsPage, page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await settingsPage.gotoSettings();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { document.documentElement.classList.add('dark'); });
    await page.screenshot({ path: 'screenshots/settings-dark.png', fullPage: true });
  });
});
