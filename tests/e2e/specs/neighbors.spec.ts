/**
 * @p1 Nearby stations (neighbor comparison) tests.
 *
 * Covers: Settings neighbor config panel expand/save, Dashboard source toggle,
 * and neighbor refresh → station drawer flow.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { faker } from '@faker-js/faker';
import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../fixtures';

const neighborSourceId = `generated-${faker.string.alphanumeric(8)}`;
const neighborName = `Generated station ${faker.string.alphanumeric(4)}`;
const neighborLat = faker.location.latitude({ min: 25, max: 49 });
const neighborLon = faker.location.longitude({ min: -124, max: -66 });

interface PinnedStation {
  readonly provider: string;
  readonly sourceId: string;
  readonly displayLabel: string | null;
  readonly selectedMetricKeys?: readonly string[] | null;
}

interface NeighborConfig {
  readonly isEnabled: boolean;
  readonly radiusMiles: number;
  readonly maxAgeMinutes: number;
  readonly minStations: number;
  readonly enabledProviders: readonly string[];
  readonly refreshIntervalMinutes: number;
  readonly discoveryLocationQuery?: string | null;
  readonly pinnedStations: readonly PinnedStation[];
}

interface NeighborConfigUpdate extends NeighborConfig {
  readonly municipality?: string | null;
}

const defaultNeighborConfig = {
  isEnabled: false,
  radiusMiles: 25,
  maxAgeMinutes: 30,
  minStations: 3,
  enabledProviders: ['WeatherGov', 'OpenMeteo'],
  refreshIntervalMinutes: 15,
  pinnedStations: [],
} satisfies NeighborConfig;

const enabledNeighborConfig = {
  isEnabled: true,
  radiusMiles: 25,
  maxAgeMinutes: 30,
  minStations: 3,
  enabledProviders: ['WeatherGov', 'OpenMeteo'],
  refreshIntervalMinutes: 15,
  pinnedStations: [],
} satisfies NeighborConfig;

const sampleNeighborStations = JSON.stringify([
  {
    provider: 'WeatherGov',
    sourceId: neighborSourceId,
    name: neighborName,
    lat: neighborLat,
    lon: neighborLon,
    distanceMiles: 5.2,
    lastObservedAtUtc: '2026-06-04T01:00:00Z',
    freshnessMinutes: 10,
    tempF: 71.5,
    humidity: 68,
    windSpeedMph: 7.0,
  },
]);

const neighborCurrentReading = JSON.stringify({
  deviceId: 'neighbors',
  deviceName: '1 nearby station',
  timestampUtc: '2026-06-04T01:00:00Z',
  receivedAtUtc: '2026-06-04T01:00:01Z',
  tempF: 71.5,
  humidity: 68,
  source: 'neighbors',
});

async function setupNeighborRoutes(
  ctx: BrowserContext,
  enableConfig = false,
  onSave?: (body: NeighborConfigUpdate) => void,
): Promise<{ readonly currentConfig: () => NeighborConfig }> {
  let config: NeighborConfig = enableConfig ? enabledNeighborConfig : defaultNeighborConfig;

  await ctx.route('**/api/neighbors/config**', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}') as NeighborConfigUpdate;
      onSave?.(body);
      config = {
        isEnabled: body.isEnabled,
        radiusMiles: body.radiusMiles,
        maxAgeMinutes: body.maxAgeMinutes,
        minStations: body.minStations,
        enabledProviders: body.enabledProviders,
        refreshIntervalMinutes: body.refreshIntervalMinutes,
        discoveryLocationQuery: body.discoveryLocationQuery ?? null,
        pinnedStations: body.pinnedStations ?? config.pinnedStations,
      };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(config) });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(config) });
  });

  await ctx.route('**/api/neighbors/refresh**', (route) =>
    route.fulfill({ contentType: 'application/json', body: sampleNeighborStations }),
  );

  await ctx.route('**/api/neighbors/stations/current**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: `pinned:WeatherGov:${neighborSourceId}`,
        deviceName: neighborName,
        timestampUtc: '2026-06-04T01:00:00Z',
        receivedAtUtc: '2026-06-04T01:00:01Z',
        tempF: 71.5,
        humidity: 68,
        windSpeedMph: 7.0,
        windGustMph: 9.0,
        windDir: 180,
        source: 'neighbors',
      }),
    }),
  );

  return { currentConfig: () => config };
}

test.describe('Neighbors @p1', () => {
  test('config panel expands and saves', async ({ settingsPage, context, page }) => {
    await setupNeighborRoutes(context);

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

    await test.step('open public source nearby settings', async () => {
      await settingsPage.openPublicNearby();
      await expect(settingsPage.neighborsSection).toBeVisible();
    });

    await expect(settingsPage.neighborsEnableToggle).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.neighborsRadiusInput).toBeVisible();
    await expect(settingsPage.neighborsSaveButton).toBeVisible();

    let saveCalled = false;
    let savedIsEnabled: boolean | null = null;

    await context.route('**/api/neighbors/config**', async (route) => {
      if (route.request().method() === 'PUT') {
        saveCalled = true;
        const postData = route.request().postData() ?? '{}';
        const body = JSON.parse(postData) as { isEnabled: boolean };
        savedIsEnabled = body.isEnabled;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enabledNeighborConfig) });
      } else {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(defaultNeighborConfig) });
      }
    });

    await test.step('enable toggle and save', async () => {
      await settingsPage.neighborsEnableToggle.check();
      await settingsPage.clickNeighborsSave();
      await expect(settingsPage.neighborsViewStationsButton).toBeVisible({ timeout: 5_000 });
    });

    await expect.poll(() => (saveCalled ? savedIsEnabled : null), { timeout: 10_000 }).toBe(true);
    await settingsPage.screenshot('p1-neighbors-01-settings-panel.png');
  });

  test('dashboard neighbors toggle shows provenance note', async ({ homePage, context }) => {
    await context.route('**/api/dashboard/current?source=neighbors**', (route) =>
      route.fulfill({ contentType: 'application/json', body: neighborCurrentReading }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    await expect(homePage.sourceToggle).toBeVisible();
    await expect(homePage.ownSourceButton).toBeVisible();

    await test.step('click neighbors source', () => homePage.clickNeighborsSource());
    await expect(homePage.neighborsProvenance).toBeVisible({ timeout: 5_000 });
    await homePage.screenshot('p1-neighbors-02-dashboard-toggle.png');
  });

  test('dashboard can return from neighbors to own station', async ({ homePage, context }) => {
    await context.route('**/api/dashboard/current?source=neighbors**', (route) =>
      route.fulfill({ contentType: 'application/json', body: neighborCurrentReading }),
    );

    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    await homePage.clickNeighborsSource();
    await expect(homePage.neighborsSourceButton).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.neighborsProvenance).toBeVisible({ timeout: 5_000 });

    await homePage.clickOwnSource();
    await expect(homePage.ownSourceButton).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.neighborsProvenance).toBeHidden();
    await expect(homePage.weatherHubState).toContainText('Test Station');
  });

  test('dashboard shows unavailable state when neighbors returns 428', async ({ homePage, context }) => {
    await context.route('**/api/dashboard/current?source=neighbors**', (route) =>
      route.fulfill({
        status: 428,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Neighbor comparison is not configured.' }),
      }),
    );

    await homePage.gotoHome();
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    await homePage.clickNeighborsSource();
    await expect(homePage.neighborsSourceButton).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.neighborsUnavailable).toBeVisible({ timeout: 10_000 });
    await expect(homePage.neighborsUnavailable).toContainText('Neighbor comparison is not configured or enabled');
    await expect(homePage.neighborsProvenance).toBeHidden();

    await homePage.clickOwnSource();
    await expect(homePage.neighborsUnavailable).toBeHidden();
    await expect(homePage.ownSourceButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('refresh shows station list and drawer opens with station rows', async ({
    settingsPage,
    context,
  }) => {
    await setupNeighborRoutes(context);

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

    await test.step('open public source nearby settings', async () => {
      await settingsPage.openPublicNearby();
      await expect(settingsPage.neighborsSection).toBeVisible();
    });
    await expect(settingsPage.neighborsRefreshButton).toBeVisible({ timeout: 5_000 });

    await test.step('refresh neighbors', () => settingsPage.clickNeighborsRefresh());
    await expect(settingsPage.neighborsViewStationsButton).toBeVisible({ timeout: 5_000 });

    await test.step('open station drawer', () => settingsPage.clickNeighborsViewStations());
    await expect(settingsPage.neighborsStationDrawer).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.neighborsStationRows).toHaveCount(1);
    await expect(settingsPage.neighborsStationDrawer).toContainText(neighborName);
    await expect(settingsPage.neighborsStationPinButtons).toHaveCount(1);
    await settingsPage.screenshot('p1-neighbors-03-station-drawer.png');
  });

  test('pinning a neighbor saves config and renders pinned station on dashboard', async ({
    settingsPage,
    homePage,
    context,
  }) => {
    let savedConfig: NeighborConfigUpdate | null = null;
    const neighbors = await setupNeighborRoutes(context, false, (body) => { savedConfig = body; });

    await test.step('pin refreshed station from settings drawer', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
      await settingsPage.openPublicNearby();
      await expect(settingsPage.neighborsSection).toBeVisible();
      await expect(settingsPage.neighborsRefreshButton).toBeVisible({ timeout: 5_000 });
      await settingsPage.clickNeighborsRefresh();
      await expect(settingsPage.neighborsViewStationsButton).toBeVisible({ timeout: 5_000 });
      await settingsPage.clickNeighborsViewStations();
      await expect(settingsPage.neighborsStationDrawer).toBeVisible({ timeout: 5_000 });
      await settingsPage.neighborsStationPinButtons.first().click();
    });

    await expect.poll(() => savedConfig?.pinnedStations ?? [], { timeout: 10_000 }).toEqual([
      {
        provider: 'WeatherGov',
        sourceId: neighborSourceId,
        displayLabel: neighborName,
      },
    ]);
    await expect.poll(() => neighbors.currentConfig().pinnedStations).toHaveLength(1);

    await test.step('dashboard renders pinned station group in default own view', async () => {
      await homePage.gotoHome();
      await expect(homePage.title).toBeVisible({ timeout: 30_000 });
      await expect(homePage.pinnedStationGroups).toHaveCount(1, { timeout: 10_000 });
      await expect(homePage.pinnedStationGroups.first()).toContainText(neighborName);
      await expect(homePage.pinnedStationGroups.first()).toContainText('Weather.gov');
      await expect(homePage.pinnedStationGroups.first()).toContainText('71.5');
    });
  });
});
