/**
 * @p0/@p1 Settings Custom Layout Builder tests.
 *
 * P0: switch to custom mode, add a fill tile, save, and verify it renders on the dashboard.
 * P1: keyboard-accessible reorder (Move Up button), header ticker renders on dashboard.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { faker } from '@faker-js/faker';
import { test, expect, mockStation } from '../fixtures';

type SavedLayoutPayload = {
  readonly layoutMode: string;
  readonly customItems: readonly {
    readonly type: string;
    readonly name?: string | null;
    readonly size?: string;
    readonly position?: string | null;
    readonly channelStationId?: string | null;
    readonly sourceLabels?: readonly string[];
    readonly metrics?: readonly {
      readonly stationId: string;
      readonly metricKey: string;
    }[];
  }[];
};

async function selectOptionValues(locator: import('@playwright/test').Locator): Promise<readonly string[]> {
  return locator.evaluate((select) => (
    Array.from((select as HTMLSelectElement).options).map((option) => option.value)
  ));
}

function buildCustomLayoutJson(macAddress: string): string {
  return JSON.stringify({
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Custom',
    layoutMode: 'custom',
    tiles: [],
    customItems: [
      {
        id: 'fill-block-1',
        type: 'metric-block',
        name: 'Temperature',
        size: '1x2',
        displayMode: 'fill',
        metrics: [{ stationId: macAddress, metricKey: 'outdoor_temp', labelOverride: null }],
        position: null,
        sourceLabels: [],
        isPaused: true,
      },
    ],
    updatedAtUtc: '2026-06-02T12:00:00Z',
  });
}

test.describe('Custom Layout Builder @p0', () => {
  test('switches to custom mode and shows builder', async ({ settingsPage }) => {
    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });

    await test.step('switch to custom mode', () => settingsPage.layoutModeCustomButton.click());
    await expect(settingsPage.customLayoutBuilder).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.addBlockButton).toBeVisible();
    await settingsPage.screenshot('p0-custom-builder-shell.png');
  });

  test('add fill tile, save, and dashboard renders fill tile', async ({
    settingsPage,
    context,
    page,
  }) => {
    const customLayoutJson = buildCustomLayoutJson(mockStation.macAddress);
    let layoutSaved = false;
    let savedLayoutBody = '';

    await context.route('**/api/dashboard/layout**', async (route) => {
      if (route.request().method() === 'PUT') {
        savedLayoutBody = route.request().postData() ?? '';
        layoutSaved = true;
        await route.fulfill({ contentType: 'application/json', body: customLayoutJson });
      } else {
        const body = layoutSaved
          ? customLayoutJson
          : JSON.stringify({
              id: '00000000-0000-0000-0000-000000000001',
              name: 'Default',
              layoutMode: 'default',
              tiles: [],
              customItems: [],
              updatedAtUtc: '2026-06-01T00:00:00Z',
            });
        await route.fulfill({ contentType: 'application/json', body });
      }
    });

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });

    await test.step('switch to custom mode', () => settingsPage.layoutModeCustomButton.click());
    await expect(settingsPage.customLayoutBuilder).toBeVisible({ timeout: 5_000 });

    await test.step('add a metric block', async () => {
      await settingsPage.addBlockButton.click();
      await expect(settingsPage.metricPickerAddButton).toBeVisible({ timeout: 5_000 });
      await settingsPage.metricPickerAddButton.click();
    });

    await test.step('enable fill mode', async () => {
      await expect(settingsPage.fillModeCheckbox).not.toBeDisabled({ timeout: 3_000 });
      await settingsPage.fillModeCheckbox.check();
    });

    await test.step('save layout', async () => {
      await expect(settingsPage.saveLayoutButton).toBeEnabled({ timeout: 3_000 });
      await settingsPage.saveLayoutButton.click();
      await expect(settingsPage.layoutSavedMessage).toBeVisible({ timeout: 5_000 });
    });

    await expect.poll(() => layoutSaved ? savedLayoutBody : '', { timeout: 10_000 }).not.toBe('');
    const payload = JSON.parse(savedLayoutBody) as { layoutMode: string };
    expect(payload.layoutMode).toBe('custom');

    await test.step('navigate to dashboard and verify fill tile', async () => {
      await settingsPage.clickDashboardLink();
      await expect(page.getByTestId('custom-dashboard-grid')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('custom-dashboard-fill-tile')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('custom-dashboard-fill-value')).toContainText('72.4', {
        timeout: 10_000,
      });
    });
    await page.screenshot({ path: 'test-results/p0-custom-fill-tile-dashboard.png', fullPage: true });
  });
});

test.describe('Custom Layout Builder @p1', () => {
  test('add divider and block, Move Up button changes order', async ({ settingsPage }) => {
    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });

    await test.step('switch to custom mode', () => settingsPage.layoutModeCustomButton.click());
    await expect(settingsPage.customLayoutBuilder).toBeVisible({ timeout: 5_000 });

    await test.step('add divider then metric block', async () => {
      await settingsPage.addDividerButton.click();
      await settingsPage.addBlockButton.click();
      // Collapse the auto-expanded block
      await settingsPage.customLayoutExpandButtons.nth(1).click();
    });

    await expect(settingsPage.itemTitles.nth(0)).toContainText('Divider');
    await expect(settingsPage.itemTitles.nth(1)).toContainText('Metric block');

    await test.step('move second item up', () => settingsPage.moveUpButtons.nth(1).click());

    await expect(settingsPage.itemTitles.nth(0)).toContainText('Metric block');
    await expect(settingsPage.itemTitles.nth(1)).toContainText('Divider');
    await settingsPage.screenshot('p1-custom-builder-reorder.png');
  });

  test('named and blank dividers save and render on dashboard', async ({
    settingsPage,
    homePage,
    context,
  }) => {
    let savedLayoutPayload: SavedLayoutPayload | null = null;

    await context.route('**/api/dashboard/layout**', async (route) => {
      if (route.request().method() === 'PUT') {
        savedLayoutPayload = JSON.parse(route.request().postData() ?? '{}') as SavedLayoutPayload;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-0000-0000-000000000007',
            name: 'Custom',
            layoutMode: 'custom',
            tiles: [],
            customItems: savedLayoutPayload.customItems,
            updatedAtUtc: '2026-06-02T16:00:00Z',
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default',
          layoutMode: savedLayoutPayload ? 'custom' : 'default',
          tiles: [],
          customItems: savedLayoutPayload?.customItems ?? [],
          updatedAtUtc: '2026-06-01T00:00:00Z',
        }),
      });
    });

    await test.step('create and save named and blank dividers', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });
      await settingsPage.layoutModeCustomButton.click();

      await settingsPage.addDividerButton.click();
      await settingsPage.customLayoutExpandButtons.first().click();
      await expect(settingsPage.dividerNameInput).toBeVisible({ timeout: 5_000 });
      await settingsPage.dividerNameInput.fill('Weather Bands');

      await settingsPage.addDividerButton.click();

      await settingsPage.saveLayoutButton.click();
      await expect(settingsPage.layoutSavedMessage).toBeVisible({ timeout: 5_000 });
    });

    await expect.poll(() => savedLayoutPayload, { timeout: 10_000 }).toMatchObject({
      layoutMode: 'custom',
      customItems: [
        { type: 'divider', name: 'Weather Bands', size: '3x1' },
        { type: 'divider', name: null, size: '3x1' },
      ],
    });

    await test.step('dashboard renders named and blank dividers', async () => {
      await homePage.gotoHome();
      await expect(homePage.customGrid).toBeVisible({ timeout: 15_000 });
      await expect(homePage.customDividers).toHaveCount(2);
      await expect(homePage.customDividers.first()).toContainText('Weather Bands');
      await expect(homePage.customDividers.nth(1)).not.toContainText('Weather Bands');
    });
  });

  test('metric picker includes owned, public, and pinned sources with provider filtering', async ({
    settingsPage,
    context,
  }) => {
    const publicSourceId = '33333333-3333-3333-3333-333333333333';
    const publicStationId = `public:${publicSourceId}`;
    const pinnedSourceId = 'generated-pinned-source';
    const pinnedStationId = `pinned:OpenMeteo:${pinnedSourceId}`;
    const savedPayloads: SavedLayoutPayload[] = [];

    await context.route('**/api/public-sources', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: publicSourceId,
            provider: 'WeatherGov',
            sourceId: faker.string.alpha({ length: 4, casing: 'upper' }),
            displayLabel: 'Weather.gov - Generated Public Source',
            latitude: faker.location.latitude({ min: 25, max: 49 }),
            longitude: faker.location.longitude({ min: -124, max: -66 }),
            timezone: 'America/Chicago',
            isEnabled: true,
            selectedMetricKeys: ['outdoor_temp', 'nws_text_description'],
            createdAtUtc: '2026-06-05T12:00:00Z',
            updatedAtUtc: '2026-06-05T12:00:00Z',
          },
        ]),
      }),
    );

    await context.route('**/api/neighbors/config**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          isEnabled: false,
          radiusMiles: 25,
          maxAgeMinutes: 30,
          minStations: 3,
          enabledProviders: ['WeatherGov', 'OpenMeteo'],
          refreshIntervalMinutes: 15,
          pinnedStations: [
            {
              provider: 'OpenMeteo',
              sourceId: pinnedSourceId,
              displayLabel: 'Generated pinned model',
              selectedMetricKeys: ['outdoor_temp', 'om_precip_probability'],
            },
          ],
        }),
      }),
    );

    await context.route('**/api/dashboard/layout**', async (route) => {
      if (route.request().method() === 'PUT') {
        const payload = JSON.parse(route.request().postData() ?? '{}') as SavedLayoutPayload;
        savedPayloads.push(payload);
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-0000-0000-000000000008',
            name: 'Custom',
            layoutMode: 'custom',
            tiles: [],
            customItems: payload.customItems,
            updatedAtUtc: '2026-06-02T17:00:00Z',
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default',
          layoutMode: 'default',
          tiles: [],
          customItems: [],
          updatedAtUtc: '2026-06-01T00:00:00Z',
        }),
      });
    });

    await settingsPage.gotoSettings();
    await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });
    await settingsPage.layoutModeCustomButton.click();
    await settingsPage.addBlockButton.click();

    await test.step('owned station supports owned-only metrics', async () => {
      await expect(settingsPage.metricPickerStationSelect).toBeVisible({ timeout: 5_000 });
      await expect(settingsPage.metricPickerSourceKind).toHaveText('Owned station');
      const metricOptions = await selectOptionValues(settingsPage.metricPickerMetricSelect);
      expect(metricOptions).toContain('indoor_temp');
      await settingsPage.metricPickerMetricSelect.selectOption('indoor_temp');
      await settingsPage.metricPickerAddButton.click();
    });

    await test.step('public source shows provider badge and hides unsupported indoor metrics', async () => {
      await settingsPage.metricPickerStationSelect.selectOption(publicStationId);
      await expect(settingsPage.metricPickerSourceKind).toHaveText('Public source');
      await expect(settingsPage.metricPickerProviderBadge).toHaveText('Weather.gov');
      const metricOptions = await selectOptionValues(settingsPage.metricPickerMetricSelect);
      expect(metricOptions).toContain('nws_text_description');
      expect(metricOptions).not.toContain('indoor_temp');
      await settingsPage.metricPickerMetricSelect.selectOption('nws_text_description');
      await settingsPage.metricPickerAddButton.click();
    });

    await test.step('pinned source shows provider badge and hides unsupported Weather.gov-only fields', async () => {
      await settingsPage.metricPickerStationSelect.selectOption(pinnedStationId);
      await expect(settingsPage.metricPickerSourceKind).toHaveText('Pinned source');
      await expect(settingsPage.metricPickerProviderBadge).toHaveText('Open-Meteo');
      const metricOptions = await selectOptionValues(settingsPage.metricPickerMetricSelect);
      expect(metricOptions).toContain('om_precip_probability');
      expect(metricOptions).not.toContain('nws_raw_metar');
      await settingsPage.metricPickerMetricSelect.selectOption('om_precip_probability');
      await settingsPage.metricPickerAddButton.click();
    });

    await expect(settingsPage.customLayoutMetricRows).toHaveCount(3);
    await settingsPage.saveLayoutButton.click();
    await expect(settingsPage.layoutSavedMessage).toBeVisible({ timeout: 5_000 });

    await expect.poll(
      () => savedPayloads.at(-1)?.customItems.at(0)?.metrics ?? [],
      { timeout: 10_000 },
    ).toEqual([
      { stationId: mockStation.macAddress, metricKey: 'indoor_temp', labelOverride: null },
      { stationId: publicStationId, metricKey: 'nws_text_description', labelOverride: null },
      { stationId: pinnedStationId, metricKey: 'om_precip_probability', labelOverride: null },
    ]);
  });

  test('header ticker renders on dashboard with alert content', async ({ homePage, context }) => {
    const tickerLayoutJson = JSON.stringify({
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Custom',
      layoutMode: 'custom',
      tiles: [],
      customItems: [
        {
          id: 'ticker-1',
          type: 'header-ticker',
          name: 'Conditions',
          size: '3x1',
          position: 'header',
          sourceLabels: [],
          isPaused: true,
          displayMode: null,
          metrics: [],
        },
      ],
      updatedAtUtc: '2026-06-02T13:00:00Z',
    });

    await context.route('**/api/alerts/active**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'generated-alert-2',
            event: 'Generated Alert',
            headline: 'Generated ticker alert headline',
            description: null,
            severity: 'Moderate',
            urgency: 'Expected',
            certainty: 'Likely',
            effectiveUtc: null,
            expiresUtc: null,
            areaDesc: null,
          },
        ]),
      }),
    );

    await context.route('**/api/dashboard/layout**', (route) =>
      route.fulfill({ contentType: 'application/json', body: tickerLayoutJson }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.customGrid).toBeVisible({ timeout: 15_000 });
    await expect(homePage.customTicker).toBeVisible({ timeout: 10_000 });
    await expect(homePage.customTicker).toContainText('Generated ticker alert headline', {
      timeout: 10_000,
    });
    await expect(homePage.customTickerPause).toBeVisible();
    await homePage.screenshot('p1-custom-ticker-dashboard.png');
  });

  test('header ticker uses its configured NWS zone alerts', async ({ homePage, context }) => {
    const requestedAreas: string[] = [];
    const tickerZone = 'NYZ072';
    const tickerLayoutJson = JSON.stringify({
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Custom',
      layoutMode: 'custom',
      tiles: [],
      customItems: [
        {
          id: 'ticker-zone-1',
          type: 'header-ticker',
          name: 'Zone alerts',
          size: '3x1',
          position: 'header',
          sourceLabels: ['outdoor_temp'],
          isPaused: true,
          displayMode: null,
          metrics: [],
          channelStationId: null,
          alertsZone: tickerZone,
        },
      ],
      updatedAtUtc: '2026-06-02T13:00:00Z',
    });

    await context.route('**/api/alerts/active**', (route) => {
      const url = new URL(route.request().url());
      const area = url.searchParams.get('area');
      requestedAreas.push(area ?? 'station');
      const isTickerZone = area === tickerZone;

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: isTickerZone ? 'generated-zone-alert' : 'generated-dashboard-alert',
            event: isTickerZone ? 'Generated Zone Alert' : 'Generated Dashboard Alert',
            headline: isTickerZone
              ? 'Generated ticker zone headline'
              : 'Generated dashboard alert headline',
            description: null,
            severity: isTickerZone ? 'Moderate' : 'Minor',
            urgency: 'Expected',
            certainty: 'Likely',
            effectiveUtc: null,
            expiresUtc: null,
            areaDesc: null,
          },
        ]),
      });
    });

    await context.route('**/api/dashboard/layout**', (route) =>
      route.fulfill({ contentType: 'application/json', body: tickerLayoutJson }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());

    await expect(homePage.customGrid).toBeVisible({ timeout: 15_000 });
    await expect(homePage.customTicker).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => requestedAreas, { timeout: 10_000 }).toContain(tickerZone);
    await expect(homePage.customTickerContent).toContainText('Generated ticker zone headline', {
      timeout: 10_000,
    });
    await expect(homePage.customTickerContent).not.toContainText('Generated dashboard alert headline');
  });

  test('footer ticker saves public channel source and renders configured weather fields', async ({
    settingsPage,
    homePage,
    context,
  }) => {
    const publicSourceId = '22222222-2222-2222-2222-222222222222';
    const publicStationId = `public:${publicSourceId}`;
    const publicSourceLabel = 'Generated Public Model';
    let savedLayoutPayload: SavedLayoutPayload | null = null;

    await context.route('**/api/public-sources', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: publicSourceId,
            provider: 'OpenMeteo',
            sourceId: 'generated-public-model',
            displayLabel: publicSourceLabel,
            latitude: faker.location.latitude({ min: 25, max: 49 }),
            longitude: faker.location.longitude({ min: -124, max: -66 }),
            timezone: 'America/Chicago',
            isEnabled: true,
            selectedMetricKeys: ['outdoor_temp', 'wind_speed', 'wind_gust'],
            createdAtUtc: '2026-06-05T12:00:00Z',
            updatedAtUtc: '2026-06-05T12:00:00Z',
          },
        ]),
      }),
    );

    await context.route(`**/api/public-sources/${publicSourceId}/current`, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          deviceId: publicStationId,
          deviceName: 'Open-Meteo - Generated Public Model',
          timestampUtc: '2026-06-05T12:00:00Z',
          receivedAtUtc: '2026-06-05T12:00:01Z',
          tempF: 58.6,
          windSpeedMph: 13.7,
          source: 'public',
        }),
      }),
    );

    await context.route('**/api/alerts/active**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '[]' }),
    );

    await context.route('**/api/dashboard/layout**', async (route) => {
      if (route.request().method() === 'PUT') {
        savedLayoutPayload = JSON.parse(route.request().postData() ?? '{}') as SavedLayoutPayload;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-0000-0000-000000000005',
            name: 'Custom',
            layoutMode: 'custom',
            tiles: [],
            customItems: savedLayoutPayload.customItems,
            updatedAtUtc: '2026-06-02T14:00:00Z',
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default',
          layoutMode: savedLayoutPayload ? 'custom' : 'default',
          tiles: [],
          customItems: savedLayoutPayload?.customItems ?? [],
          updatedAtUtc: '2026-06-01T00:00:00Z',
        }),
      });
    });

    await test.step('configure and save footer ticker from a public source', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.layoutModeTabs).toBeVisible({ timeout: 15_000 });
      await settingsPage.layoutModeCustomButton.click();
      await settingsPage.addFooterTickerButton.click();
      await settingsPage.firstBlockExpandButton.click();

      await expect(settingsPage.tickerChannelSelect).toBeVisible({ timeout: 5_000 });
      await settingsPage.tickerChannelSelect.selectOption(publicStationId);
      await settingsPage.tickerLabelCheckbox('outdoor_temp').check();
      await settingsPage.tickerLabelCheckbox('wind_speed').check();

      await expect(settingsPage.saveLayoutButton).toBeEnabled({ timeout: 3_000 });
      await settingsPage.saveLayoutButton.click();
      await expect(settingsPage.layoutSavedMessage).toBeVisible({ timeout: 5_000 });
    });

    await expect.poll(() => savedLayoutPayload, { timeout: 10_000 }).toMatchObject({
      layoutMode: 'custom',
      customItems: [
        {
          type: 'footer-ticker',
          position: 'footer',
          channelStationId: publicStationId,
          sourceLabels: ['outdoor_temp', 'wind_speed'],
        },
      ],
    });

    await test.step('dashboard renders footer ticker values from the selected public channel', async () => {
      await homePage.gotoHome();
      await expect(homePage.customGrid).toBeVisible({ timeout: 15_000 });
      await expect(homePage.customFooterTickerMarker).toHaveText('Footer ticker');
      await expect(homePage.customTickerContent).toContainText('58.6', { timeout: 10_000 });
      await expect(homePage.customTickerContent).toContainText('13.7', { timeout: 10_000 });
      await expect(homePage.customTickerContent).not.toContainText('72.4');
    });
  });

  test('ticker starts paused for reduced-motion users', async ({ homePage, context, page }) => {
    const reducedMotionLayoutJson = JSON.stringify({
      id: '00000000-0000-0000-0000-000000000006',
      name: 'Custom',
      layoutMode: 'custom',
      tiles: [],
      customItems: [
        {
          id: 'ticker-reduced-motion-1',
          type: 'header-ticker',
          name: 'Reduced motion ticker',
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
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });

    await context.route('**/api/alerts/active**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '[]' }),
    );

    await context.route('**/api/dashboard/layout**', (route) =>
      route.fulfill({ contentType: 'application/json', body: reducedMotionLayoutJson }),
    );

    await homePage.gotoHome();
    await expect(homePage.customGrid).toBeVisible({ timeout: 15_000 });
    await expect(homePage.customTickerContent).toContainText('72.4', { timeout: 10_000 });
    await expect(homePage.customTickerPause).toHaveAttribute('aria-pressed', 'true');
    await expect(homePage.customTickerPause).toHaveAttribute('aria-label', 'Resume ticker');
    await expect(homePage.customTickerContent).not.toHaveAttribute('aria-hidden', 'true');
  });
});
