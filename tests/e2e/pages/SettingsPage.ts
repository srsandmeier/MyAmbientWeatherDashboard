import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the Settings page. */
export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.byTestId('settings-page');
  }

  get credentialsStatus(): Locator {
    return this.byTestId('settings-credentials-status');
  }

  get accountMenuButton(): Locator {
    return this.byTestId('nav-user-menu-button');
  }

  get apiKeyInput(): Locator {
    return this.byTestId('settings-credentials-api-key-input');
  }

  get applicationKeyInput(): Locator {
    return this.byTestId('settings-credentials-app-key-input');
  }

  get saveCredentialsButton(): Locator {
    return this.byTestId('settings-credentials-save-button');
  }

  get deleteCredentialsButton(): Locator {
    return this.byTestId('settings-credentials-delete-button');
  }

  get deleteConfirmation(): Locator {
    return this.byTestId('settings-credentials-confirm-delete');
  }

  get cancelDeleteButton(): Locator {
    return this.byTestId('settings-credentials-cancel-delete-button');
  }

  get confirmDeleteButton(): Locator {
    return this.byTestId('settings-credentials-confirm-delete-button');
  }

  get noCredentialsDevicesPrompt(): Locator {
    return this.byTestId('settings-devices-no-credentials');
  }

  get devicesSyncButton(): Locator {
    return this.byTestId('settings-devices-sync-button');
  }

  get devicesList(): Locator {
    return this.byTestId('settings-devices-list');
  }

  get runtimeMockStationRow(): Locator {
    return this.byTestId('settings-device-row-mockruntime1');
  }

  get publicSourceSearchInput(): Locator {
    return this.byTestId('settings-public-source-search-input');
  }

  get publicSourceSearchButton(): Locator {
    return this.byTestId('settings-public-source-search-button');
  }

  get publicSourceSearchResults(): Locator {
    return this.byTestId('settings-public-source-search-results');
  }

  get publicSourceSearchEmpty(): Locator {
    return this.byTestId('settings-public-source-search-empty');
  }

  get publicSourceSearchError(): Locator {
    return this.byTestId('settings-public-source-search-error');
  }

  get publicSourceSearchAddButtons(): Locator {
    return this.byTestId('settings-public-source-search-add');
  }

  get externalSourcesList(): Locator {
    return this.byTestId('settings-external-sources-list');
  }

  get externalSourceProviderBadges(): Locator {
    return this.byTestId('settings-external-source-provider-badge');
  }

  externalSourceVisibilityToggle(rowId: string): Locator {
    return this.byTestId(`settings-external-source-visibility-toggle-${rowId}`);
  }

  externalSourceLabelInput(rowId: string): Locator {
    return this.byTestId(`settings-external-source-label-edit-${rowId}`);
  }

  externalSourceDeleteButton(rowId: string): Locator {
    return this.byTestId(`settings-external-source-delete-${rowId}`);
  }

  externalSourceToggle(rowId: string): Locator {
    return this.byTestId(`settings-external-source-toggle-${rowId}`);
  }

  externalSourceMetricForm(rowId: string): Locator {
    return this.byTestId(`settings-external-source-metric-form-${rowId}`);
  }

  externalSourceMetric(rowId: string, metricKey: string): Locator {
    return this.byTestId(`settings-external-source-metric-${rowId}-${metricKey}`);
  }

  externalSourceMetricMoveUp(rowId: string, metricKey: string): Locator {
    return this.byTestId(`settings-external-source-metric-move-up-${rowId}-${metricKey}`);
  }

  externalSourceMetricSaveButton(rowId: string): Locator {
    return this.byTestId(`settings-external-source-metric-save-button-${rowId}`);
  }

  deviceRowToggle(rowId: string): Locator {
    return this.byTestId(`settings-device-row-toggle-${rowId}`);
  }

  deviceTitle(rowId: string): Locator {
    return this.byTestId(`settings-device-title-${rowId}`);
  }

  deviceVisibilityToggle(rowId: string): Locator {
    return this.byTestId(`settings-device-visibility-toggle-${rowId}`);
  }

  devicePrimaryRadio(rowId: string): Locator {
    return this.byTestId(`settings-device-primary-radio-${rowId}`);
  }

  deviceAutosaveStatus(rowId: string): Locator {
    return this.byTestId(`settings-device-autosave-status-${rowId}`);
  }

  deviceNicknameInput(rowId: string): Locator {
    return this.byTestId(`settings-device-nickname-input-${rowId}`);
  }

  deviceMetric(rowId: string, metricKey: string): Locator {
    return this.byTestId(`settings-device-metric-${rowId}-${metricKey}`);
  }

  deviceMetricCategoryMoveUp(rowId: string, categoryId: string): Locator {
    return this.byTestId(`settings-device-metric-category-move-up-${rowId}-${categoryId}`);
  }

  deviceMetricMoveUp(rowId: string, metricKey: string): Locator {
    return this.byTestId(`settings-device-metric-move-up-${rowId}-${metricKey}`);
  }

  deviceSaveButton(rowId: string): Locator {
    return this.byTestId(`settings-device-save-button-${rowId}`);
  }

  deviceUnsavedPrompt(rowId: string): Locator {
    return this.byTestId(`settings-device-unsaved-prompt-${rowId}`);
  }

  deviceUnsavedSaveButton(rowId: string): Locator {
    return this.byTestId(`settings-device-unsaved-prompt-${rowId}-save`);
  }

  deviceUnsavedDiscardButton(rowId: string): Locator {
    return this.byTestId(`settings-device-unsaved-prompt-${rowId}-discard`);
  }

  get preferencesToggle(): Locator {
    return this.byTestId('settings-preferences-toggle');
  }

  get preferencesTemperatureSelect(): Locator {
    return this.byTestId('settings-preferences-temperature-select');
  }

  get preferencesTemperatureDecimalsSelect(): Locator {
    return this.byTestId('settings-preferences-temperature-decimals-select');
  }

  get preferencesThemeSelect(): Locator {
    return this.byTestId('settings-preferences-theme-select');
  }

  get preferencesDateFormatSelect(): Locator {
    return this.byTestId('settings-preferences-date-format-select');
  }

  get preferencesSaveButton(): Locator {
    return this.byTestId('settings-preferences-save-button');
  }

  get preferencesSavedMessage(): Locator {
    return this.byTestId('settings-preferences-saved-message');
  }

  preferenceControl(testId: string): Locator {
    return this.byTestId(testId);
  }

  // ── Custom layout builder ────────────────────────────────────────────────

  get layoutModeTabs(): Locator {
    return this.byTestId('settings-layout-mode-tabs');
  }

  get layoutModeDefaultButton(): Locator {
    return this.byTestId('settings-layout-mode-default');
  }

  get layoutModeCustomButton(): Locator {
    return this.byTestId('settings-layout-mode-custom');
  }

  get customLayoutBuilder(): Locator {
    return this.byTestId('settings-custom-layout-builder');
  }

  get addBlockButton(): Locator {
    return this.byTestId('settings-custom-layout-add-metric-block');
  }

  get addDividerButton(): Locator {
    return this.byTestId('settings-custom-layout-add-divider');
  }

  get addFooterTickerButton(): Locator {
    return this.byTestId('settings-custom-layout-add-footer-ticker');
  }

  get customLayoutItems(): Locator {
    return this.byTestId('settings-custom-layout-item');
  }

  get firstBlockExpandButton(): Locator {
    return this.byTestId('settings-custom-layout-item-expand');
  }

  get customLayoutExpandButtons(): Locator {
    return this.byTestId('settings-custom-layout-item-expand');
  }

  get dividerNameInput(): Locator {
    return this.byTestId('settings-custom-layout-divider-name');
  }

  get metricPickerAddButton(): Locator {
    return this.byTestId('settings-custom-layout-metric-picker-add');
  }

  get metricPickerStationSelect(): Locator {
    return this.byTestId('settings-custom-layout-metric-picker-station');
  }

  get metricPickerMetricSelect(): Locator {
    return this.byTestId('settings-custom-layout-metric-picker-key');
  }

  get metricPickerSourceKind(): Locator {
    return this.byTestId('settings-custom-layout-metric-picker-source-kind');
  }

  get metricPickerProviderBadge(): Locator {
    return this.byTestId('settings-custom-layout-metric-picker-provider-badge');
  }

  get customLayoutMetricRows(): Locator {
    return this.byTestId('settings-custom-layout-metric-row');
  }

  get tickerChannelSelect(): Locator {
    return this.byTestId('settings-custom-layout-ticker-channel');
  }

  get tickerZoneInput(): Locator {
    return this.byTestId('settings-custom-layout-ticker-zone');
  }

  tickerLabelCheckbox(metricKey: string): Locator {
    return this.byTestId(`settings-custom-layout-ticker-label-${metricKey}`);
  }

  get fillModeCheckbox(): Locator {
    return this.byTestId('settings-custom-layout-fill-mode');
  }

  get saveLayoutButton(): Locator {
    return this.byTestId('settings-custom-layout-save');
  }

  get discardLayoutButton(): Locator {
    return this.byTestId('settings-custom-layout-discard');
  }

  get layoutSavedMessage(): Locator {
    return this.byTestId('settings-custom-layout-saved-message');
  }

  get customLayoutUnsavedPrompt(): Locator {
    return this.byTestId('settings-custom-layout-unsaved-prompt');
  }

  get customLayoutUnsavedSaveButton(): Locator {
    return this.byTestId('settings-custom-layout-unsaved-prompt-save');
  }

  get customLayoutUnsavedDiscardButton(): Locator {
    return this.byTestId('settings-custom-layout-unsaved-prompt-discard');
  }

  get moveUpButtons(): Locator {
    return this.byTestId('settings-custom-layout-move-up');
  }

  get itemTitles(): Locator {
    return this.byTestId('settings-custom-layout-item-title');
  }

  // ── Public and Nearby Stations sub-section ───────────────────────────────

  get publicNearbyToggle(): Locator {
    return this.byTestId('settings-public-nearby-toggle');
  }

  async openPublicNearby(): Promise<void> {
    const expanded = await this.publicNearbyToggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await this.publicNearbyToggle.click();
    }
  }

  // ── Neighbors config panel ───────────────────────────────────────────────

  get neighborsSection(): Locator {
    return this.byTestId('settings-neighbors-embedded');
  }

  get neighborsEnableToggle(): Locator {
    return this.byTestId('settings-neighbors-enable-toggle');
  }

  get neighborsRadiusInput(): Locator {
    return this.byTestId('settings-neighbors-radius-input');
  }

  get neighborsSaveButton(): Locator {
    return this.byTestId('settings-neighbors-search-button');
  }

  get neighborsRefreshButton(): Locator {
    return this.byTestId('settings-neighbors-search-button');
  }

  get neighborsRefreshError(): Locator {
    return this.byTestId('settings-neighbors-save-error');
  }

  get neighborsViewStationsButton(): Locator {
    return this.byTestId('settings-neighbors-view-stations-button');
  }

  get neighborsStationDrawer(): Locator {
    return this.byTestId('neighbors-station-drawer');
  }

  get neighborsStationDrawerCloseButton(): Locator {
    return this.byTestId('neighbors-station-drawer-close');
  }

  get neighborsStationRows(): Locator {
    return this.byTestId('neighbors-station-row');
  }

  get neighborsStationPinButtons(): Locator {
    return this.byTestId('neighbors-station-pin-button');
  }

  get neighborsSavedStatus(): Locator {
    return this.page.getByText('Saved.');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async gotoSettings(): Promise<void> {
    await this.goto('/settings');
  }

  async openAccountMenu(): Promise<void> {
    await this.accountMenuButton.click();
  }

  async fillCredentials(apiKey: string, appKey: string): Promise<void> {
    await this.apiKeyInput.fill(apiKey);
    await this.applicationKeyInput.fill(appKey);
  }

  async clickSaveCredentials(): Promise<void> {
    await this.saveCredentialsButton.click();
  }

  async clickDeleteCredentials(): Promise<void> {
    await this.deleteCredentialsButton.click();
  }

  async clickCancelDelete(): Promise<void> {
    await this.cancelDeleteButton.click();
  }

  async clickConfirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
  }

  async clickNeighborsSave(): Promise<void> {
    await this.neighborsSaveButton.click();
  }

  async clickNeighborsRefresh(): Promise<void> {
    await this.neighborsRefreshButton.click();
  }

  async clickNeighborsViewStations(): Promise<void> {
    await this.neighborsViewStationsButton.click();
  }
}
