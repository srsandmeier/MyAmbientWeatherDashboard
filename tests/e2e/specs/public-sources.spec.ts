/**
 * @p1 Public source station management tests (Settings Default tab).
 *
 * Covers discovery/add, provider badges, enable toggle, label edit, delete, supported metrics,
 * selected metric persistence, and ordering payloads. All Auth0 and BFF calls are mocked.
 */

import { faker } from '@faker-js/faker';
import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../fixtures';

type PublicProvider = 'WeatherGov' | 'OpenMeteo';

interface PublicSource {
  readonly id: string;
  readonly provider: PublicProvider;
  readonly sourceId: string;
  readonly displayLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string | null;
  readonly isEnabled: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

interface PublicSourceUpdate {
  readonly displayLabel?: string | null;
  readonly isEnabled?: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
}

interface PublicSourceCreate {
  readonly provider: PublicProvider;
  readonly sourceId: string;
  readonly displayLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone?: string | null;
  readonly isEnabled: boolean;
}

const defaultNeighborConfigBody = JSON.stringify({
  isEnabled: false,
  radiusMiles: 25,
  maxAgeMinutes: 30,
  minStations: 3,
  enabledProviders: ['WeatherGov', 'OpenMeteo'],
  refreshIntervalMinutes: 15,
  pinnedStations: [],
});

test.describe('Public sources settings @p1', () => {
  test('discovers and adds a public source from city search', async ({ settingsPage, context }) => {
    const discovered = makeDiscoveredSource('OpenMeteo');
    let createBody: PublicSourceCreate | null = null;
    const publicSources = await setupPublicSourceRoutes(context, {
      initialSources: [],
      discoveredSources: [discovered],
      onCreate: (body) => { createBody = body; },
    });

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openPublicNearby();
    await settingsPage.publicSourceSearchInput.fill('Generated City, KS');
    await settingsPage.publicSourceSearchButton.click();

    await expect(settingsPage.publicSourceSearchResults).toBeVisible({ timeout: 10_000 });
    await expect(settingsPage.publicSourceSearchResults).toContainText(discovered.displayLabel);

    await settingsPage.publicSourceSearchAddButtons.first().click();

    await expect.poll(() => createBody, { timeout: 10_000 }).toMatchObject({
      provider: discovered.provider,
      sourceId: discovered.sourceId,
      displayLabel: discovered.displayLabel,
      timezone: discovered.timezone,
      isEnabled: true,
    });
    await expect.poll(() => publicSources.current()).toHaveLength(1);
    const addedRowId = `public-${publicSources.current()[0]?.id ?? ''}`;
    await expect(settingsPage.externalSourceLabelInput(addedRowId)).toHaveValue(discovered.displayLabel);
    await expect(settingsPage.externalSourceProviderBadges.first()).toContainText('Open-Meteo');
  });

  test('shows empty and error discovery states', async ({ settingsPage, context }) => {
    const publicSources = await setupPublicSourceRoutes(context, { initialSources: [] });

    await settingsPage.gotoSettings();
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await settingsPage.openPublicNearby();
    await settingsPage.publicSourceSearchInput.fill('No Results, KS');
    await settingsPage.publicSourceSearchButton.click();
    await expect(settingsPage.publicSourceSearchEmpty).toBeVisible({ timeout: 10_000 });

    publicSources.setDiscoveryFailure(true);
    await settingsPage.publicSourceSearchInput.fill('Broken Search, KS');
    await settingsPage.publicSourceSearchButton.click();
    await expect(settingsPage.publicSourceSearchError).toBeVisible({ timeout: 10_000 });
  });

  test('appears in default station list with provider badge', async ({ settingsPage, context }) => {
    const source = makePublicSource({ provider: 'WeatherGov' });
    await setupPublicSourceRoutes(context, { initialSources: [source] });

    await settingsPage.gotoSettings();
    await expect(settingsPage.externalSourcesList).toBeVisible({ timeout: 15_000 });
    await expect(settingsPage.externalSourceProviderBadges.first()).toBeVisible();
    await expect(settingsPage.externalSourceProviderBadges.first()).toContainText('Weather.gov');
  });

  test('enable toggle fires PUT request', async ({ settingsPage, context }) => {
    const source = makePublicSource({ provider: 'WeatherGov', isEnabled: true });
    let updateBody: PublicSourceUpdate | null = null;
    await setupPublicSourceRoutes(context, {
      initialSources: [source],
      onUpdate: (_id, body) => { updateBody = body; },
    });

    await settingsPage.gotoSettings();
    await expect(settingsPage.externalSourcesList).toBeVisible({ timeout: 15_000 });

    const rowId = `public-${source.id}`;
    const toggle = settingsPage.externalSourceVisibilityToggle(rowId);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();

    await expect(toggle).toBeChecked({ checked: false, timeout: 5_000 });
    await expect.poll(() => updateBody, { timeout: 10_000 }).toMatchObject({ isEnabled: false });
  });

  test('label edit and delete update the saved source list', async ({ settingsPage, context }) => {
    const source = makePublicSource({ provider: 'WeatherGov' });
    const editedLabel = `Edited ${faker.string.alphanumeric(6)}`;
    let updateBody: PublicSourceUpdate | null = null;
    let deletedId: string | null = null;
    const publicSources = await setupPublicSourceRoutes(context, {
      initialSources: [source],
      onUpdate: (_id, body) => { updateBody = body; },
      onDelete: (id) => { deletedId = id; },
    });

    await settingsPage.gotoSettings();
    const rowId = `public-${source.id}`;
    await settingsPage.externalSourceLabelInput(rowId).fill(editedLabel);
    await settingsPage.externalSourceLabelInput(rowId).blur();

    await expect.poll(() => updateBody, { timeout: 10_000 }).toMatchObject({ displayLabel: editedLabel });
    await expect(settingsPage.externalSourceLabelInput(rowId)).toHaveValue(editedLabel);

    await settingsPage.externalSourceDeleteButton(rowId).click();

    await expect.poll(() => deletedId, { timeout: 10_000 }).toBe(source.id);
    await expect.poll(() => publicSources.current()).toHaveLength(0);
    await expect(settingsPage.externalSourcesList).toHaveCount(0);
  });

  test('supported metric pills exclude unsupported fields and save selected order', async ({ settingsPage, context }) => {
    const source = makePublicSource({
      provider: 'OpenMeteo',
      selectedMetricKeys: ['outdoor_temp', 'dew_point', 'uv_index'],
    });
    let updateBody: PublicSourceUpdate | null = null;
    await setupPublicSourceRoutes(context, {
      initialSources: [source],
      onUpdate: (_id, body) => { updateBody = body; },
    });

    await settingsPage.gotoSettings();
    const rowId = `public-${source.id}`;
    await settingsPage.externalSourceToggle(rowId).click();

    const metricForm = settingsPage.externalSourceMetricForm(rowId);
    await expect(metricForm).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.externalSourceMetric(rowId, 'outdoor_temp')).toBeVisible();
    await expect(settingsPage.externalSourceMetric(rowId, 'om_uv_index_max')).toBeVisible();
    await expect(settingsPage.externalSourceMetric(rowId, 'indoor_temp')).toHaveCount(0);

    await settingsPage.externalSourceMetricMoveUp(rowId, 'dew_point').click();
    await settingsPage.externalSourceMetric(rowId, 'uv_index').click();
    await settingsPage.externalSourceMetricSaveButton(rowId).click();

    await expect.poll(() => updateBody, { timeout: 10_000 }).toMatchObject({
      selectedMetricKeys: ['dew_point', 'outdoor_temp'],
    });
  });
});

async function setupPublicSourceRoutes(
  ctx: BrowserContext,
  options: {
    readonly initialSources: readonly PublicSource[];
    readonly discoveredSources?: readonly Omit<PublicSource, 'id' | 'isEnabled' | 'createdAtUtc' | 'updatedAtUtc' | 'selectedMetricKeys'>[];
    readonly onCreate?: (body: PublicSourceCreate) => void;
    readonly onUpdate?: (id: string, body: PublicSourceUpdate) => void;
    readonly onDelete?: (id: string) => void;
  },
): Promise<{
  readonly current: () => readonly PublicSource[];
  readonly setDiscoveryFailure: (value: boolean) => void;
}> {
  let sources = [...options.initialSources];
  let discoveryShouldFail = false;

  await ctx.route('**/api/public-sources**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/discover')) {
      if (discoveryShouldFail) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"failed"}' });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(options.discoveredSources ?? []),
      });
      return;
    }

    if (method === 'GET' && url.pathname.endsWith('/api/public-sources')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(sources) });
      return;
    }

    if (method === 'POST' && url.pathname.endsWith('/api/public-sources')) {
      const body = JSON.parse(request.postData() ?? '{}') as PublicSourceCreate;
      options.onCreate?.(body);
      const source = makePublicSource({
        ...body,
        id: faker.string.uuid(),
        timezone: body.timezone ?? null,
      });
      sources = [...sources, source];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(source) });
      return;
    }

    const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
    const current = sources.find((source) => source.id === id);
    if (!current) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' });
      return;
    }

    if (method === 'PUT') {
      const body = JSON.parse(request.postData() ?? '{}') as PublicSourceUpdate;
      options.onUpdate?.(id, body);
      const next: PublicSource = {
        ...current,
        isEnabled: body.isEnabled ?? current.isEnabled,
        selectedMetricKeys: body.selectedMetricKeys ?? current.selectedMetricKeys,
        displayLabel: body.displayLabel ?? current.displayLabel,
        updatedAtUtc: '2026-06-02T00:00:00Z',
      };
      sources = sources.map((source) => (source.id === id ? next : source));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
      return;
    }

    if (method === 'DELETE') {
      options.onDelete?.(id);
      sources = sources.filter((source) => source.id !== id);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.continue();
  });

  await ctx.route('**/api/neighbors/config**', (route) =>
    route.fulfill({ contentType: 'application/json', body: defaultNeighborConfigBody }),
  );

  return {
    current: () => sources,
    setDiscoveryFailure: (value) => { discoveryShouldFail = value; },
  };
}

function makeDiscoveredSource(
  provider: PublicProvider,
): Omit<PublicSource, 'id' | 'isEnabled' | 'createdAtUtc' | 'updatedAtUtc' | 'selectedMetricKeys'> {
  return {
    provider,
    sourceId: provider === 'WeatherGov'
      ? `K${faker.string.alphanumeric(3).toUpperCase()}`
      : `om-${faker.string.uuid()}`,
    displayLabel: `${provider === 'WeatherGov' ? 'Weather.gov' : 'Open-Meteo'} - ${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    latitude: faker.location.latitude({ min: 25, max: 49 }),
    longitude: faker.location.longitude({ min: -124, max: -66 }),
    timezone: 'America/Chicago',
  };
}

function makePublicSource(overrides: Partial<PublicSource> = {}): PublicSource {
  const provider = overrides.provider ?? 'WeatherGov';
  return {
    id: overrides.id ?? faker.string.uuid(),
    provider,
    sourceId: overrides.sourceId ?? (provider === 'WeatherGov'
      ? `K${faker.string.alphanumeric(3).toUpperCase()}`
      : `om-${faker.string.uuid()}`),
    displayLabel: overrides.displayLabel ?? `${provider === 'WeatherGov' ? 'Weather.gov' : 'Open-Meteo'} - ${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    latitude: overrides.latitude ?? faker.location.latitude({ min: 25, max: 49 }),
    longitude: overrides.longitude ?? faker.location.longitude({ min: -124, max: -66 }),
    timezone: overrides.timezone ?? 'America/Chicago',
    isEnabled: overrides.isEnabled ?? true,
    selectedMetricKeys: overrides.selectedMetricKeys ?? null,
    createdAtUtc: overrides.createdAtUtc ?? '2026-06-01T00:00:00Z',
    updatedAtUtc: overrides.updatedAtUtc ?? '2026-06-01T00:00:00Z',
  };
}
