import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';

/** Navigates to the dashboard and waits for the page root element to be visible. */
export async function gotoHome(page: Page, timeout = 30_000): Promise<HomePage> {
  const home = new HomePage(page);
  await home.gotoHome();
  await expect(home.title).toBeVisible({ timeout });
  return home;
}

/** Navigates to Settings and waits for the settings page root element to be visible. */
export async function gotoSettings(page: Page, timeout = 15_000): Promise<SettingsPage> {
  const settings = new SettingsPage(page);
  await settings.gotoSettings();
  await expect(settings.root).toBeVisible({ timeout });
  return settings;
}
