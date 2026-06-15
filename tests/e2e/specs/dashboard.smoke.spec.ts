/**
 * @p0 Dashboard smoke tests.
 *
 * Verifies the authenticated shell loads, navigation renders, and data tiles are visible.
 * All Auth0 and BFF calls are mocked by Playwright route handlers — no backend required.
 * Run with: npm run test:e2e:p0
 */

import { faker } from '@faker-js/faker';
import { test, expect, mockStation, setupBffMockRoutes } from '../fixtures';

test.describe('Dashboard smoke @p0', () => {
  test('authenticated shell loads', async ({ homePage, page }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });
    await homePage.screenshot('p0-01-dashboard-shell.png');
  });

  test('navigation is visible', async ({ homePage }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });
    await expect(homePage.dashboardLink).toBeVisible();
    await homePage.screenshot('p0-02-dashboard-nav.png');
  });

  test('dashboard tile grid renders with station data', async ({ homePage }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });
    await expect(homePage.weatherHubState).toContainText('Test Station');
    await expect(homePage.tileGrid).toBeVisible();
    await homePage.screenshot('p0-03-dashboard-tiles.png');
  });

  test('public source default group renders', async ({ homePage, page, context }) => {
    const publicSourceId = '11111111-1111-1111-1111-111111111111';
    const publicSourceLabel = 'Generated Model Source';
    const publicStationLabel = 'Open-Meteo - Generated Model Source';

    await context.route('**/api/public-sources', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: publicSourceId,
            provider: 'OpenMeteo',
            sourceId: 'generated-model-source',
            displayLabel: publicSourceLabel,
            latitude: mockStation.latitude,
            longitude: mockStation.longitude,
            timezone: 'UTC',
            isEnabled: true,
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
          deviceId: `public:${publicSourceId}`,
          deviceName: publicStationLabel,
          timestampUtc: '2026-06-05T12:00:00Z',
          receivedAtUtc: '2026-06-05T12:00:01Z',
          tempF: 63.8,
          feelsLike: 63.8,
          dewPoint: 51.2,
          humidity: 54,
          baromRelIn: 29.91,
          windDir: 180,
          windSpeedMph: 6.2,
          windGustMph: 9.1,
          source: 'public',
        }),
      }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());

    await expect(homePage.sourceGroups).toBeVisible({ timeout: 30_000 });
    await expect(homePage.sourceHeadings.filter({ hasText: publicStationLabel })).toBeVisible({
      timeout: 10_000,
    });
    await expect(homePage.temperatureValues.filter({ hasText: '63.8' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await homePage.screenshot('p0-03b-dashboard-public-source.png');
  });

  test('disabled public sources are suppressed from dashboard and not fetched', async ({
    homePage,
    context,
  }) => {
    const disabledSourceId = '44444444-4444-4444-4444-444444444444';
    let disabledCurrentFetches = 0;

    await context.route('**/api/public-sources', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: disabledSourceId,
            provider: 'OpenMeteo',
            sourceId: 'disabled-generated-source',
            displayLabel: 'Disabled Generated Source',
            latitude: mockStation.latitude,
            longitude: mockStation.longitude,
            timezone: 'UTC',
            isEnabled: false,
            selectedMetricKeys: ['outdoor_temp'],
            createdAtUtc: '2026-06-05T12:00:00Z',
            updatedAtUtc: '2026-06-05T12:00:00Z',
          },
        ]),
      }),
    );

    await context.route(`**/api/public-sources/${disabledSourceId}/current`, (route) => {
      disabledCurrentFetches += 1;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          deviceId: `public:${disabledSourceId}`,
          deviceName: 'Open-Meteo - Disabled Generated Source',
          timestampUtc: '2026-06-05T12:00:00Z',
          receivedAtUtc: '2026-06-05T12:00:01Z',
          tempF: 63.8,
          source: 'public',
        }),
      });
    });

    await homePage.gotoHome();

    await expect(homePage.sourceGroups).toBeVisible({ timeout: 30_000 });
    await expect(homePage.sourceHeadings.filter({ hasText: 'Disabled Generated Source' })).toHaveCount(0);
    await expect.poll(() => disabledCurrentFetches, { timeout: 5_000 }).toBe(0);
  });

  test('public source with missing current reading shows stale state without crashing', async ({
    homePage,
    context,
  }) => {
    const publicSourceId = '55555555-5555-5555-5555-555555555555';
    const publicStationLabel = 'Weather.gov - Missing Current Source';

    await context.route('**/api/public-sources', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: publicSourceId,
            provider: 'WeatherGov',
            sourceId: faker.string.alpha({ length: 4, casing: 'upper' }),
            displayLabel: publicStationLabel,
            latitude: mockStation.latitude,
            longitude: mockStation.longitude,
            timezone: 'UTC',
            isEnabled: true,
            selectedMetricKeys: ['outdoor_temp'],
            createdAtUtc: '2026-06-05T12:00:00Z',
            updatedAtUtc: '2026-06-05T12:00:00Z',
          },
        ]),
      }),
    );

    await context.route(`**/api/public-sources/${publicSourceId}/current`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Current reading unavailable.' }),
      }),
    );

    await homePage.gotoHome();

    await expect(homePage.sourceGroups).toBeVisible({ timeout: 30_000 });
    await expect(homePage.sourceHeadings.filter({ hasText: 'Weather.gov - Missing Current Source' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(homePage.temperatureValues.filter({ hasText: '—' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('pinned source with missing cache shows refresh guidance', async ({ homePage, context }) => {
    const pinnedSourceId = 'generated-missing-cache';

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
              provider: 'WeatherGov',
              sourceId: pinnedSourceId,
              displayLabel: 'Generated Missing Cache Station',
              selectedMetricKeys: ['outdoor_temp'],
            },
          ],
        }),
      }),
    );

    await context.route('**/api/neighbors/stations/current**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Pinned station not in cache.' }),
      }),
    );

    await homePage.gotoHome();

    await expect(homePage.pinnedStationGroups).toHaveCount(1, { timeout: 10_000 });
    await expect(homePage.pinnedStationGroups.first()).toContainText('Generated Missing Cache Station');
    await expect(homePage.pinnedStationGroups.first()).toContainText('Not in cache');
    await expect(homePage.pinnedStationGroups.first()).toContainText('—');
  });

  test('active weather alert renders banner', async ({ homePage, context }) => {
    await context.route('**/api/alerts/active**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'generated-alert-1',
            event: 'Generated Alert',
            headline: 'Generated alert headline',
            description: null,
            severity: 'Severe',
            urgency: 'Immediate',
            certainty: 'Likely',
            effectiveUtc: null,
            expiresUtc: null,
            areaDesc: null,
          },
        ]),
      }),
    );

    await test.step('navigate to home', () => homePage.gotoHome());

    await expect(homePage.alertsAreaSelector).toBeVisible({ timeout: 30_000 });
    await expect(homePage.weatherAlertsBanner).toContainText('Generated alert headline', {
      timeout: 10_000,
    });
    await homePage.screenshot('p0-03c-dashboard-weather-alert.png');
  });

  test('manual alert area refetches warnings and expands details', async ({ homePage, context }) => {
    const requestedAreas: string[] = [];

    await context.route('**/api/alerts/active**', (route) => {
      const url = new URL(route.request().url());
      const area = url.searchParams.get('area');
      requestedAreas.push(area ?? 'station');

      const headline = area === 'NYZ072'
        ? 'Generated zone alert headline'
        : 'Generated station alert headline';

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `generated-alert-${area ?? 'station'}`,
            event: area === 'NYZ072' ? 'Generated Zone Alert' : 'Generated Station Alert',
            headline,
            description: null,
            severity: 'Severe',
            urgency: 'Immediate',
            certainty: 'Likely',
            effectiveUtc: null,
            expiresUtc: null,
            areaDesc: area === 'NYZ072' ? 'Generated Zone' : 'Generated Station Area',
          },
        ]),
      });
    });

    await test.step('navigate to home', () => homePage.gotoHome());

    await expect(homePage.alertsAreaSelector).toBeVisible({ timeout: 30_000 });
    await expect(homePage.weatherAlertsBanner).toContainText('Generated station alert headline', {
      timeout: 10_000,
    });

    await test.step('expand alert details', async () => {
      await homePage.weatherAlertsToggle.click();
      await expect(homePage.weatherAlertsList).toBeVisible({ timeout: 5_000 });
      await expect(homePage.weatherAlertsList).toContainText('Generated Station Area');
    });

    await test.step('select manual NWS zone', async () => {
      await homePage.alertsAreaMode.selectOption('manual');
      await expect(homePage.alertsAreaCode).toBeVisible({ timeout: 5_000 });
      await homePage.alertsAreaCode.fill('nyz072');
    });

    await expect.poll(() => requestedAreas, { timeout: 10_000 }).toContain('NYZ072');
    await expect(homePage.weatherAlertsBanner).toContainText('Generated zone alert headline', {
      timeout: 10_000,
    });
  });

  test('no React error boundary triggered', async ({ homePage, page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    const errorBoundaryVisible = await homePage.isErrorBoundaryVisible();
    expect(errorBoundaryVisible, 'React error boundary must not trigger on dashboard').toBe(false);
    expect(jsErrors, `Unhandled JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    await homePage.screenshot('p0-04-dashboard-no-errors.png');
  });
});

test.describe('Navigation @p0', () => {
  test('settings link reaches settings page', async ({ homePage, page }) => {
    await test.step('navigate to home', () => homePage.gotoHome());
    await expect(homePage.title).toBeVisible({ timeout: 30_000 });

    await test.step('click settings link', () => homePage.clickSettingsLink());
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'test-results/p0-05-settings-via-nav.png', fullPage: true });
  });
});
