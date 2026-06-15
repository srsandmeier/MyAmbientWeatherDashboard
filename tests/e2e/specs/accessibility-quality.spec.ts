/**
 * @p1 Accessibility and quality smoke tests.
 *
 * Covers keyboard-operable critical controls, light/dark visibility smoke,
 * representative empty/disabled/error states, and retry flows.
 */

import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, mockStation, setupBffMockRoutes } from '../fixtures';

test.describe('Accessibility and quality @p1', () => {
  test('critical dashboard and metric-detail controls are keyboard operable', async ({
    homePage,
    metricDetailPage,
    context,
    page,
  }) => {
    await context.route('**/api/dashboard/current?source=neighbors**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          deviceId: 'neighbors',
          deviceName: '1 nearby station',
          timestampUtc: '2026-06-04T01:00:00Z',
          receivedAtUtc: '2026-06-04T01:00:01Z',
          tempF: 71.5,
          humidity: 68,
          source: 'neighbors',
        }),
      }),
    );
    await setupMetricHistoryRoute(context);

    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    await homePage.neighborsSourceButton.focus();
    await page.keyboard.press('Enter');
    await expect(homePage.neighborsSourceButton).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.neighborsProvenance).toBeVisible({ timeout: 5_000 });

    await homePage.ownSourceButton.focus();
    await page.keyboard.press('Space');
    await expect(homePage.ownSourceButton).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.neighborsProvenance).toBeHidden();

    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.historyTableToggle).toHaveAttribute('aria-expanded', 'false');
    await metricDetailPage.historyTableToggle.focus();
    await page.keyboard.press('Space');
    await expect(metricDetailPage.historyTableToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(metricDetailPage.historyTableContent).toBeVisible();
  });

  test('settings custom-layout builder controls are keyboard operable', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });

    await settingsPage.layoutModeCustomButton.focus();
    await page.keyboard.press('Enter');
    await expect(settingsPage.customLayoutBuilder).toBeVisible({ timeout: 5_000 });

    const initialItemCount = await settingsPage.customLayoutItems.count();
    await settingsPage.addDividerButton.focus();
    await page.keyboard.press('Space');
    await expect
      .poll(() => settingsPage.customLayoutItems.count(), { timeout: 5_000 })
      .toBe(initialItemCount + 1);
    await expect(settingsPage.itemTitles.filter({ hasText: 'Divider' }).last()).toBeVisible();

    await settingsPage.addBlockButton.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => settingsPage.customLayoutItems.count(), { timeout: 5_000 })
      .toBe(initialItemCount + 2);
    await expect(settingsPage.itemTitles.filter({ hasText: 'Metric block' }).last()).toBeVisible();
  });

  test('settings neighbor station drawer is keyboard closable', async ({
    settingsPage,
    context,
    page,
  }) => {
    await setupNeighborDrawerRoutes(context);

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openPublicNearby();

    await expect(settingsPage.neighborsSection).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.neighborsRefreshButton).toBeVisible({ timeout: 5_000 });

    await settingsPage.neighborsRefreshButton.focus();
    await page.keyboard.press('Enter');
    await expect(settingsPage.neighborsViewStationsButton).toBeVisible({ timeout: 5_000 });

    await settingsPage.neighborsViewStationsButton.focus();
    await page.keyboard.press('Enter');
    await expect(settingsPage.neighborsStationDrawer).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.neighborsStationRows).toHaveCount(1);
    await expect(settingsPage.neighborsStationDrawerCloseButton).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(settingsPage.neighborsStationDrawer).toHaveCount(0);
  });

  test('settings credentials delete confirmation is keyboard dismissible', async ({
    settingsPage,
    context,
    page,
  }) => {
    await context.route('**/api/settings/credentials**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":true}' }),
    );

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openAccountMenu();
    await expect(settingsPage.deleteCredentialsButton).toBeVisible({ timeout: 5_000 });

    await settingsPage.deleteCredentialsButton.focus();
    await page.keyboard.press('Enter');
    await expect(settingsPage.deleteConfirmation).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(settingsPage.deleteConfirmation).toHaveCount(0);
  });

  test('dashboard ticker pause control is keyboard operable', async ({
    homePage,
    context,
    page,
  }) => {
    await setupKeyboardTickerRoutes(context);

    await homePage.gotoHome();
    await expect(homePage.customGrid).toBeVisible({ timeout: 15_000 });
    await expect(homePage.customTickerContent).toContainText('72.4', { timeout: 10_000 });
    await expect(homePage.customTickerPause).toHaveAttribute('aria-label', 'Pause ticker');
    await expect(homePage.customTickerPause).toHaveAttribute('aria-pressed', 'false');
    await expect(homePage.customTickerContent).toHaveAttribute('aria-hidden', 'true');

    await homePage.customTickerPause.focus();
    await page.keyboard.press('Space');
    await expect(homePage.customTickerPause).toHaveAttribute('aria-label', 'Resume ticker');
    await expect(homePage.customTickerPause).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.customTickerContent).not.toHaveAttribute('aria-hidden', 'true');

    await page.keyboard.press('Enter');
    await expect(homePage.customTickerPause).toHaveAttribute('aria-label', 'Pause ticker');
    await expect(homePage.customTickerPause).toHaveAttribute('aria-pressed', 'false');
    await expect(homePage.customTickerContent).toHaveAttribute('aria-hidden', 'true');
  });

  test('light and dark themes keep key dashboard and settings regions visible', async ({
    homePage,
    metricDetailPage,
    settingsPage,
    page,
  }) => {
    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    await homePage.themeMenuButton.focus();
    await page.keyboard.press('Enter');
    await expect(homePage.themeMenu).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(homePage.themeMenu).toBeHidden();

    await homePage.themeMenuButton.click();
    await homePage.themeDarkItem.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(homePage.sourceToggle).toBeVisible();
    await expect(homePage.tileGrid).toBeVisible();

    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.chart).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.rangeSelect).toBeVisible();
    await expect(metricDetailPage.granularitySelect).toBeVisible();

    await homePage.clickSettingsLink();
    await expect(settingsPage.root).toBeVisible({ timeout: 15_000 });
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });
    await expect(settingsPage.preferencesToggle).toBeVisible();

    await homePage.themeMenuButton.click();
    await homePage.themeLightItem.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(settingsPage.layoutModeTabs).toBeVisible();
    await expect(settingsPage.devicesSyncButton).toBeVisible();
  });

  test('light and dark themes keep empty disabled and error states visible', async ({
    homePage,
    metricDetailPage,
    settingsPage,
    context,
    page,
  }) => {
    for (const theme of ['light', 'dark'] as const) {
      // Re-register base BFF mocks before each iteration so prior iteration's
      // route overrides (from setupSettingsEmptyAndErrorRoutes) don't leak
      // into this iteration's dashboard navigation. LIFO: last registered wins.
      await setupBffMockRoutes(context, mockStation);
      await setTheme(page, theme);
      await setupDashboardErrorRoutes(context);
      await homePage.gotoHome();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
      await expect(homePage.title).toBeVisible({ timeout: 30_000 });
      await expect(homePage.sourceToggle).toBeVisible({ timeout: 15_000 });
      await expect(homePage.tileGrid).toBeVisible({ timeout: 15_000 });
      await expect(homePage.weatherAlertsError).toBeVisible({ timeout: 30_000 });
      await expect(homePage.weatherAlertsRetry).toBeVisible();

      await setupEmptyMetricHistoryRoute(context);
      await metricDetailPage.gotoMetric('wind_gust');
      await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
      await expect(metricDetailPage.emptyState).toBeVisible({ timeout: 15_000 });
      await expect(metricDetailPage.emptyTitle).toBeVisible();
      await expect(metricDetailPage.emptyDescription).toBeVisible();
      await expect(metricDetailPage.overlayState).toBeHidden();

      await setupSettingsEmptyAndErrorRoutes(context);
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
      await expect(settingsPage.noCredentialsDevicesPrompt).toBeVisible({ timeout: 15_000 });
      await settingsPage.openPublicNearby();
      await expect(settingsPage.publicSourceSearchButton).toBeDisabled();
      await settingsPage.publicSourceSearchInput.fill('Generated Empty Search');
      await settingsPage.publicSourceSearchButton.click();
      await expect(settingsPage.publicSourceSearchEmpty).toBeVisible({ timeout: 10_000 });
      await settingsPage.publicSourceSearchInput.fill('Generated Error Search');
      await settingsPage.publicSourceSearchButton.click();
      await expect(settingsPage.publicSourceSearchError).toBeVisible({ timeout: 10_000 });
    }
  });

  test('dashboard retry refetches after a transient current-reading error', async ({
    homePage,
    context,
  }) => {
    let currentCalls = 0;
    let shouldFail = true;
    await context.route('**/api/dashboard/current**', (route) => {
      currentCalls += 1;
      if (shouldFail) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Generated transient current-reading failure.' }),
        });
      }

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          deviceId: mockStation.macAddress,
          deviceName: 'Recovered Station',
          timestampUtc: '2026-06-05T12:00:00Z',
          receivedAtUtc: '2026-06-05T12:00:01Z',
          tempF: 74.2,
          humidity: 58,
          source: 'own',
        }),
      });
    });

    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });
    await expect(homePage.dashboardAlert).toBeVisible({ timeout: 30_000 });
    shouldFail = false;
    await homePage.dashboardAlertRetry.click();

    await expect.poll(() => currentCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(homePage.dashboardAlert).toBeHidden({ timeout: 10_000 });
    await expect(homePage.temperatureValues.filter({ hasText: '74.2' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('public source discovery recovers after a transient search error', async ({
    settingsPage,
    context,
  }) => {
    const discovery = await setupPublicSourceDiscoveryRecoveryRoutes(context);

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openPublicNearby();

    await settingsPage.publicSourceSearchInput.fill('Broken Search, KS');
    await settingsPage.publicSourceSearchButton.click();
    await expect(settingsPage.publicSourceSearchError).toBeVisible({ timeout: 10_000 });

    discovery.allowSuccess();
    await settingsPage.publicSourceSearchInput.fill('Recovered Search, KS');
    await settingsPage.publicSourceSearchButton.click();

    await expect.poll(discovery.calls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(settingsPage.publicSourceSearchError).toHaveCount(0);
    await expect(settingsPage.publicSourceSearchResults).toBeVisible({ timeout: 10_000 });
    await expect(settingsPage.publicSourceSearchResults).toContainText('Open-Meteo - Recovered Search');
  });

  test('neighbor refresh recovers after a transient provider error', async ({
    settingsPage,
    context,
  }) => {
    const refresh = await setupNeighborRefreshRecoveryRoutes(context);

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openPublicNearby();

    await expect(settingsPage.neighborsSection).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.neighborsRefreshButton).toBeVisible({ timeout: 5_000 });

    await settingsPage.neighborsRefreshButton.click();
    await expect(settingsPage.neighborsRefreshError).toBeVisible({ timeout: 10_000 });

    refresh.allowSuccess();
    await settingsPage.neighborsRefreshButton.click();

    await expect.poll(refresh.calls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(settingsPage.neighborsRefreshError).toHaveCount(0);
    await expect(settingsPage.neighborsViewStationsButton).toBeVisible({ timeout: 10_000 });
  });

  test('weather alerts retry recovers after a transient alerts error', async ({
    homePage,
    context,
  }) => {
    let alertCalls = 0;
    let shouldFail = true;
    await context.route('**/api/alerts/active**', (route) => {
      alertCalls += 1;
      if (shouldFail) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Generated active alerts failure.' }),
        });
      }

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'generated-recovered-alert',
            event: 'Severe Thunderstorm Warning',
            headline: 'Generated recovered alert headline',
            severity: 'Severe',
            areaDesc: 'Generated Alert Area',
            description: 'Generated alert description.',
            effectiveUtc: '2026-06-05T12:00:00Z',
            expiresUtc: '2026-06-05T13:00:00Z',
          },
        ]),
      });
    });

    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });
    await expect(homePage.weatherAlertsError).toBeVisible({ timeout: 30_000 });
    shouldFail = false;
    await homePage.weatherAlertsRetry.click();

    await expect.poll(() => alertCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(homePage.weatherAlertsError).toHaveCount(0);
    await expect(homePage.weatherAlertsBanner).toContainText('Generated recovered alert headline', {
      timeout: 10_000,
    });
  });

  test('metric-detail retry refetches after a transient history error', async ({
    metricDetailPage,
    context,
  }) => {
    let historyCalls = 0;
    let shouldFail = true;
    await context.route('**/api/metrics/*/history**', (route) => {
      historyCalls += 1;
      if (shouldFail) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Generated transient history failure.' }),
        });
      }

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          metricKey: 'outdoor_temp',
          deviceId: mockStation.macAddress,
          deviceName: 'Test Station',
          range: '24h',
          fromUtc: '2026-06-01T00:00:00Z',
          toUtc: '2026-06-02T00:00:00Z',
          granularity: 'hour',
          unit: 'F',
          points: [
            { timestampUtc: '2026-06-01T00:00:00Z', value: 70.1 },
            { timestampUtc: '2026-06-01T01:00:00Z', value: 71.3 },
          ],
          warnings: [],
        }),
      });
    });

    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.errorState).toBeVisible({ timeout: 15_000 });
    shouldFail = false;
    await metricDetailPage.retryButton.click();

    await expect.poll(() => historyCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(metricDetailPage.chart).toBeVisible({ timeout: 10_000 });
    await expect(metricDetailPage.errorState).toHaveCount(0);
  });
});

async function setupMetricHistoryRoute(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/metrics/*/history**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        metricKey: 'outdoor_temp',
        deviceId: mockStation.macAddress,
        deviceName: 'Test Station',
        range: '24h',
        fromUtc: '2026-06-01T00:00:00Z',
        toUtc: '2026-06-02T00:00:00Z',
        granularity: 'hour',
        unit: 'F',
        points: [
          { timestampUtc: '2026-06-01T00:00:00Z', value: 70.1 },
          { timestampUtc: '2026-06-01T01:00:00Z', value: 71.3 },
        ],
        warnings: [],
      }),
    }),
  );
}

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
          sourceId: 'generated-keyboard-neighbor',
          name: 'Generated Keyboard Neighbor',
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

async function setupKeyboardTickerRoutes(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/alerts/active**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  await ctx.route('**/api/dashboard/layout**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000007',
        name: 'Custom',
        layoutMode: 'custom',
        tiles: [],
        customItems: [
          {
            id: 'ticker-keyboard-1',
            type: 'header-ticker',
            name: 'Keyboard ticker',
            size: '3x1',
            position: 'header',
            sourceLabels: ['outdoor_temp'],
            isPaused: false,
            displayMode: null,
            metrics: [],
            channelStationId: null,
            alertsZone: null,
          },
        ],
        updatedAtUtc: '2026-06-02T15:00:00Z',
      }),
    }),
  );
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('theme', value);
  }, theme);
  if (page.url().startsWith('http://localhost:') || page.url().startsWith('https://localhost:')) {
    await page.evaluate((value) => {
      window.localStorage.setItem('theme', value);
      document.documentElement.classList.toggle('dark', value === 'dark');
    }, theme);
  }
}

async function setupDashboardErrorRoutes(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/dashboard/rainfall**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Generated dashboard rainfall failure.' }),
    }),
  );

  await ctx.route('**/api/alerts/active**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Generated alerts failure.' }),
    }),
  );
}

async function setupEmptyMetricHistoryRoute(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/settings/devices**', (route) =>
    route.fulfill({ contentType: 'application/json', body: buildSingleOwnedDeviceBody() }),
  );

  await ctx.route('**/api/metrics/*/history**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        metricKey: 'wind_gust',
        deviceId: mockStation.macAddress,
        deviceName: 'Generated Empty Station',
        range: '24h',
        fromUtc: '2026-06-01T00:00:00Z',
        toUtc: '2026-06-02T00:00:00Z',
        granularity: 'hour',
        unit: 'mph',
        points: [],
        warnings: [],
      }),
    }),
  );
}

async function setupSettingsEmptyAndErrorRoutes(ctx: BrowserContext): Promise<void> {
  let discoveryCalls = 0;

  await ctx.route('**/api/settings/credentials**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":false}' }),
  );

  await ctx.route('**/api/settings/devices**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  await ctx.route('**/api/public-sources**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/discover')) {
      discoveryCalls += 1;
      if (discoveryCalls === 1) {
        await route.fulfill({ contentType: 'application/json', body: '[]' });
        return;
      }

      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Generated public source search failure.' }),
      });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
}

function buildSingleOwnedDeviceBody(): string {
  return JSON.stringify([
    {
      macAddress: mockStation.macAddress,
      name: 'Generated Empty Station',
      nickname: null,
      isPrimary: true,
      displayOnDashboard: true,
      selectedMetricKeys: ['wind_gust'],
      latitude: mockStation.latitude,
      longitude: mockStation.longitude,
      elevationMeters: mockStation.elevationMeters,
      address: mockStation.address,
      location: mockStation.location,
      lastSyncAtUtc: '2026-06-01T00:00:00Z',
    },
  ]);
}

async function setupPublicSourceDiscoveryRecoveryRoutes(ctx: BrowserContext): Promise<{
  readonly allowSuccess: () => void;
  readonly calls: () => number;
}> {
  let shouldFail = true;
  let discoveryCalls = 0;

  await ctx.route('**/api/public-sources**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/discover')) {
      discoveryCalls += 1;
      if (shouldFail) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Generated public source discovery failure.' }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            provider: 'OpenMeteo',
            sourceId: 'om-recovered-search',
            displayLabel: 'Open-Meteo - Recovered Search',
            latitude: mockStation.latitude,
            longitude: mockStation.longitude,
            timezone: 'America/Chicago',
          },
        ]),
      });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });

  return {
    allowSuccess: () => { shouldFail = false; },
    calls: () => discoveryCalls,
  };
}

async function setupNeighborRefreshRecoveryRoutes(ctx: BrowserContext): Promise<{
  readonly allowSuccess: () => void;
  readonly calls: () => number;
}> {
  let shouldFail = true;
  let refreshCalls = 0;

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

  await ctx.route('**/api/neighbors/refresh**', async (route) => {
    refreshCalls += 1;
    if (shouldFail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Generated neighbor refresh failure.' }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          provider: 'WeatherGov',
          sourceId: 'generated-refresh-neighbor',
          name: 'Generated Refresh Neighbor',
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
    });
  });

  return {
    allowSuccess: () => { shouldFail = false; },
    calls: () => refreshCalls,
  };
}
