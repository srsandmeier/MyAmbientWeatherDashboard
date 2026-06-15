import type { BrowserContext } from '@playwright/test';
import type { MockStation } from './mockData';

const DEFAULT_METRIC_KEYS = [
  'outdoor_temp',
  'outdoor_humidity',
  'indoor_humidity',
  'pressure',
  'wind_speed',
  'rainfall_day',
  'rainfall_week',
] as const;

export function buildDevicesBody(station: MockStation, nickname: string | null = null): string {
  return JSON.stringify([
    {
      macAddress: station.macAddress,
      name: 'Test Station',
      nickname,
      isPrimary: true,
      displayOnDashboard: true,
      selectedMetricKeys: [...DEFAULT_METRIC_KEYS],
      latitude: station.latitude,
      longitude: station.longitude,
      elevationMeters: station.elevationMeters,
      address: station.address,
      location: station.location,
      lastSyncAtUtc: '2026-06-01T00:00:00Z',
    },
  ]);
}

function buildMetricHistoryBody(station: MockStation, metricKey: string): string {
  return JSON.stringify({
    metricKey,
    deviceId: station.macAddress,
    deviceName: 'Test Station',
    range: '24h',
    fromUtc: '2026-05-31T00:00:00Z',
    toUtc: '2026-06-01T00:00:00Z',
    granularity: 'hour',
    unit: 'F',
    points: [
      { timestampUtc: '2026-05-31T00:00:00Z', value: 70.1 },
      { timestampUtc: '2026-05-31T01:00:00Z', value: 71.3 },
      { timestampUtc: '2026-05-31T02:00:00Z', value: 72.4 },
    ],
    warnings: [],
  });
}

/** Registers all BFF and SignalR mock routes on the browser context. */
export async function setupBffMockRoutes(
  ctx: BrowserContext,
  station: MockStation,
): Promise<void> {
  await ctx.route('**/api/settings/credentials**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":true}' }),
  );

  await ctx.route('**/api/settings/preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: '{"temperatureUnit":"F","speedUnit":"mph","pressureUnit":"inhg","rainfallUnit":"in","theme":"system","dateFormat":"mdy","temperatureDecimals":1}',
    }),
  );

  await ctx.route('**/api/settings/devices**', (route) =>
    route.fulfill({ contentType: 'application/json', body: buildDevicesBody(station) }),
  );

  await ctx.route('**/api/public-sources**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  await ctx.route('**/api/alerts/active**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  await ctx.route('**/api/dashboard/current**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: station.macAddress,
        deviceName: 'Test Station',
        timestampUtc: '2026-05-31T12:00:00Z',
        receivedAtUtc: '2026-05-31T12:00:01Z',
        tempF: 72.4,
        humidity: 62,
        windSpeedMph: 5.0,
        windGustMph: 9.0,
        windDir: 180,
        dailyRainIn: 0.1,
        baromRelIn: 29.92,
      }),
    }),
  );

  await ctx.route('**/api/dashboard/layout**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Default',
        layoutMode: 'default',
        tiles: [
          { i: `temperature-${station.macAddress}`, x: 0, y: 0, w: 4, h: 4, type: 'temperature', deviceId: station.macAddress },
          { i: `humidity-${station.macAddress}`, x: 0, y: 4, w: 4, h: 4, type: 'humidity', deviceId: station.macAddress },
          { i: `wind-${station.macAddress}`, x: 0, y: 8, w: 4, h: 4, type: 'wind', deviceId: station.macAddress },
          { i: 'rainfall', x: 0, y: 12, w: 4, h: 4, type: 'rainfall' },
        ],
        customItems: [],
        updatedAtUtc: '2026-06-01T00:00:00Z',
      }),
    }),
  );

  await ctx.route('**/api/dashboard/rainfall**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: station.macAddress,
        deviceName: 'Test Station',
        timestampUtc: '2026-05-31T12:00:00Z',
        receivedAtUtc: '2026-05-31T12:00:01Z',
        eventRainIn: 0.10,
        dailyRainIn: 0.25,
        weeklyRainIn: 1.00,
        monthlyRainIn: 3.00,
        yearlyRainIn: 18.00,
        lastRain: '2026-06-01T12:00:00Z',
      }),
    }),
  );

  await ctx.route('**/api/dashboard/daily-extremes**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: station.macAddress,
        deviceName: 'Test Station',
        dateUtc: '2026-06-03T00:00:00Z',
        dailyHighTempF: 78.2,
        dailyLowTempF: 61.4,
        dailyHighTempInF: null,
        dailyLowTempInF: null,
      }),
    }),
  );

  await ctx.route('**/api/metrics/*/history**', (route) => {
    const metricKey = new URL(route.request().url()).pathname.split('/').at(-2) ?? 'outdoor_temp';
    return route.fulfill({
      contentType: 'application/json',
      body: buildMetricHistoryBody(station, metricKey),
    });
  });

  // Default neighbors config — "not configured" state so the panel loads without errors.
  // Tests that need to override this register their own route AFTER (higher LIFO priority).
  await ctx.route('**/api/neighbors/config**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        isEnabled: false,
        radiusMiles: 25,
        maxAgeMinutes: 30,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
      }),
    }),
  );

  // Return 401 so SignalR fails gracefully without retrying.
  // Real-time push is validated separately; smoke tests only check page rendering.
  await ctx.route('**/hubs/weather/negotiate**', (route) =>
    route.fulfill({ status: 401, body: 'Unauthorized' }),
  );
}

/**
 * Registers a catch-all route that blocks any external request not already handled
 * by a more specific mock. Must be called BEFORE specific route mocks so its priority
 * is lower (Playwright matches routes LIFO — last registered wins).
 */
export async function blockExternalNetwork(ctx: BrowserContext): Promise<void> {
  await ctx.route('**', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:')) {
      return route.continue();
    }
    // Allow data: and blob: URIs used by the browser itself
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    console.warn(`[E2E] Blocked unmocked external request: ${url}`);
    return route.abort('blockedbyclient');
  });
}
