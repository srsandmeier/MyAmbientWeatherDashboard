import type { Locator, Page } from '@playwright/test';

/**
 * Base page object. Provides `byTestId` centralised here so the app's `data-test-id`
 * attribute name is defined in one place.
 *
 * Use `page.getByTestId(id)` (driven by `playwright.config.ts` testIdAttribute) as the
 * primary locator. If that attribute matching regresses on a non-standard element, switch
 * this helper to the CSS fallback: `page.locator(`[data-test-id="${id}"]`)`.
 */
export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  protected byTestId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  get nav(): Locator {
    return this.page.getByRole('navigation');
  }

  get dashboardLink(): Locator {
    return this.byTestId('nav-dashboard-link');
  }

  get settingsLink(): Locator {
    return this.byTestId('nav-settings-link');
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }

  async clickSettingsLink(): Promise<void> {
    await this.settingsLink.click();
  }

  async clickDashboardLink(): Promise<void> {
    await this.dashboardLink.click();
  }

  async isErrorBoundaryVisible(): Promise<boolean> {
    return this.page.getByText('Something went wrong').isVisible();
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/${name}`, fullPage: true });
  }
}
