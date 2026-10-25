/**
 * UI snapshots for design review (.claude/skills/ui-snapshot/SKILL.md): each main page at phone, tablet
 * and desktop widths in light and dark, written to tests/e2e/test-results/ui-snapshot/. The theme follows
 * the system preference (the BFF mock's preferences say "system"), so emulating the colour scheme sets it.
 *
 *   npm run ui:snapshot                    # every page
 *   npm run ui:snapshot -- --grep settings # one page
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;
const THEMES = ['light', 'dark'] as const;
const OUT_DIR = 'test-results/ui-snapshot';

async function shoot(page: Page, name: string, theme: (typeof THEMES)[number], open: () => Promise<void>): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open();
    if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await page.screenshot({ path: `${OUT_DIR}/${name}-${theme}-${viewport.name}.png`, fullPage: true, animations: 'disabled' });
  }
}

for (const theme of THEMES) {
  test(`dashboard ${theme}`, async ({ homePage, page }) => {
    await shoot(page, 'dashboard', theme, async () => {
      await homePage.gotoHome();
      await expect(homePage.sourceGroups).toBeVisible({ timeout: 30_000 });
    });
  });

  test(`metric detail ${theme}`, async ({ metricDetailPage, page }) => {
    await shoot(page, 'metric-detail', theme, async () => {
      await metricDetailPage.gotoMetric('outdoor_temp');
      await expect(metricDetailPage.chart).toBeVisible({ timeout: 30_000 });
    });
  });

  test(`settings ${theme}`, async ({ settingsPage, page }) => {
    await shoot(page, 'settings', theme, async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 30_000 });
    });
  });
}
