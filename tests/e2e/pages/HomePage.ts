import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the dashboard home page. */
export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get title(): Locator {
    return this.byTestId('dashboard-page');
  }

  get weatherHubState(): Locator {
    return this.byTestId('dashboard-weather-hub-state');
  }

  get dashboardAlert(): Locator {
    return this.byTestId('dashboard-alert');
  }

  get dashboardAlertRetry(): Locator {
    return this.byTestId('dashboard-alert-retry');
  }

  get tileGrid(): Locator {
    return this.byTestId('dashboard-tile-grid').first();
  }

  get sourceGroups(): Locator {
    return this.byTestId('dashboard-source-groups');
  }

  get sourceGroupItems(): Locator {
    return this.byTestId('dashboard-source-group');
  }

  get alertsAreaSelector(): Locator {
    return this.byTestId('dashboard-alerts-area-selector');
  }

  get alertsAreaMode(): Locator {
    return this.byTestId('dashboard-alerts-area-mode');
  }

  get alertsAreaCode(): Locator {
    return this.byTestId('dashboard-alerts-area-code');
  }

  get weatherAlertsBanner(): Locator {
    return this.byTestId('dashboard-alerts-banner');
  }

  get weatherAlertsToggle(): Locator {
    return this.byTestId('dashboard-alerts-toggle');
  }

  get weatherAlertsList(): Locator {
    return this.byTestId('dashboard-alerts-list');
  }

  get weatherAlertsError(): Locator {
    return this.byTestId('dashboard-alerts-error');
  }

  get weatherAlertsRetry(): Locator {
    return this.byTestId('dashboard-alerts-retry');
  }

  get temperatureValues(): Locator {
    return this.byTestId('dashboard-temperature-value');
  }

  get sourceHeadings(): Locator {
    return this.byTestId('dashboard-source-heading');
  }

  get rainfallTile(): Locator {
    return this.byTestId('dashboard-rainfall-summary-tile');
  }

  get setupPrompt(): Locator {
    return this.byTestId('dashboard-setup-prompt');
  }

  get setupLink(): Locator {
    return this.byTestId('dashboard-setup-link');
  }

  metricHistoryLink(metricKey: string): Locator {
    return this.byTestId('dashboard-metric-history-link')
      .and(this.page.locator(`[data-metric-key="${metricKey}"]`))
      .first();
  }

  // ── Custom layout ─────────────────────────────────────────────────────

  get customGrid(): Locator {
    return this.byTestId('custom-dashboard-grid');
  }

  get customFillTile(): Locator {
    return this.byTestId('custom-dashboard-fill-tile');
  }

  get customFillValue(): Locator {
    return this.byTestId('custom-dashboard-fill-value');
  }

  get customDividers(): Locator {
    return this.byTestId('custom-dashboard-divider');
  }

  get customTicker(): Locator {
    return this.byTestId('custom-dashboard-ticker');
  }

  get customFooterTickerMarker(): Locator {
    return this.byTestId('dashboard-footer-ticker');
  }

  get customTickerContent(): Locator {
    return this.byTestId('custom-dashboard-ticker-content');
  }

  get customTickerPause(): Locator {
    return this.byTestId('custom-dashboard-ticker-pause');
  }

  // ── Neighbor source toggle ────────────────────────────────────────────

  get sourceToggle(): Locator {
    return this.byTestId('dashboard-source-toggle');
  }

  get ownSourceButton(): Locator {
    return this.byTestId('dashboard-source-own-button');
  }

  get neighborsSourceButton(): Locator {
    return this.byTestId('dashboard-source-neighbors-button');
  }

  get neighborsProvenance(): Locator {
    return this.byTestId('dashboard-neighbors-provenance');
  }

  get neighborsUnavailable(): Locator {
    return this.byTestId('dashboard-neighbors-unavailable');
  }

  get pinnedStations(): Locator {
    return this.byTestId('dashboard-pinned-stations');
  }

  get pinnedStationGroups(): Locator {
    return this.byTestId('dashboard-pinned-station-group');
  }

  get themeMenuButton(): Locator {
    return this.byTestId('nav-theme-menu-button');
  }

  get themeMenu(): Locator {
    return this.byTestId('nav-theme-menu');
  }

  get themeLightItem(): Locator {
    return this.byTestId('nav-theme-light-item');
  }

  get themeDarkItem(): Locator {
    return this.byTestId('nav-theme-dark-item');
  }

  // ── Actions ──────────────────────────────────────────────────────────

  async gotoHome(): Promise<void> {
    await this.goto('/');
  }

  async clickNeighborsSource(): Promise<void> {
    await this.neighborsSourceButton.click();
  }

  async clickOwnSource(): Promise<void> {
    await this.ownSourceButton.click();
  }
}
