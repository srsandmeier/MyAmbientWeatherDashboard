/**
 * @p1 Metric Detail history controls and accessible table tests.
 *
 * Covers range/date/granularity query params, chart rendering, table fallback,
 * and no-points missing-sensor empty state. All Auth0 and BFF calls are mocked.
 */

import type { BrowserContext } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test, expect, mockStation } from '../fixtures';

interface HistoryRequest {
  readonly metricKey: string;
  readonly range: string | null;
  readonly date: string | null;
  readonly granularity: string | null;
  readonly deviceId: string | null;
}

test.describe('Metric Detail @p1', () => {
  test('range controls refetch history and table expands with values', async ({ metricDetailPage, context }) => {
    const requests = await setupMetricHistoryRoute(context);

    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.title).toHaveText('Outdoor Temperature');
    await expect(metricDetailPage.chart).toBeVisible({ timeout: 10_000 });
    await expect(metricDetailPage.historyTable).toBeVisible();
    await expect(metricDetailPage.historyTableContent).toHaveCount(0);

    await metricDetailPage.rangeSelect.selectOption('7d');
    await metricDetailPage.granularitySelect.selectOption('hour');

    await expect.poll(() => requests.current(), { timeout: 10_000 }).toContainEqual(expect.objectContaining({
      metricKey: 'outdoor_temp',
      range: '7d',
      granularity: 'hour',
      deviceId: null,
    }));
    await expect(metricDetailPage.historyContext).toContainText('7d', { timeout: 10_000 });

    await metricDetailPage.historyTableToggle.click();
    await expect(metricDetailPage.historyTableContent).toBeVisible({ timeout: 5_000 });
    await expect(metricDetailPage.historyValues.first()).toContainText('70.1');
  });

  test('custom date mode sends date query and renders chart', async ({ metricDetailPage, context }) => {
    const requests = await setupMetricHistoryRoute(context);

    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });

    await metricDetailPage.daySelect.selectOption('custom');
    await expect(metricDetailPage.dateInput).toBeVisible({ timeout: 5_000 });
    await metricDetailPage.dateInput.fill('2026-06-02');
    await metricDetailPage.granularitySelect.selectOption('day');

    await expect.poll(() => requests.current(), { timeout: 10_000 }).toContainEqual(expect.objectContaining({
      metricKey: 'outdoor_temp',
      range: 'date',
      date: '2026-06-02',
      granularity: 'day',
    }));
    await expect(metricDetailPage.chart).toBeVisible({ timeout: 10_000 });
    await expect(metricDetailPage.historyContext).toContainText('date', { timeout: 10_000 });
  });

  test('owned comparison overlay requests selected station history', async ({ metricDetailPage, context }) => {
    const comparisonMac = faker.string.hexadecimal({ length: 12, casing: 'upper', prefix: '' });
    const comparisonName = `Comparison ${comparisonMac.slice(0, 4)}`;
    const requests = await setupMetricHistoryRoute(context, {
      deviceNames: { [comparisonMac]: comparisonName },
    });

    await context.route('**/api/settings/devices**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            macAddress: mockStation.macAddress,
            name: 'Primary Test Station',
            nickname: null,
            isPrimary: true,
            displayOnDashboard: true,
            selectedMetricKeys: ['outdoor_temp'],
            latitude: mockStation.latitude,
            longitude: mockStation.longitude,
            elevationMeters: mockStation.elevationMeters,
            address: mockStation.address,
            location: mockStation.location,
            lastSyncAtUtc: '2026-06-01T00:00:00Z',
          },
          {
            macAddress: comparisonMac,
            name: comparisonName,
            nickname: null,
            isPrimary: false,
            displayOnDashboard: true,
            selectedMetricKeys: ['outdoor_temp'],
            latitude: mockStation.latitude,
            longitude: mockStation.longitude,
            elevationMeters: mockStation.elevationMeters,
            address: mockStation.address,
            location: mockStation.location,
            lastSyncAtUtc: '2026-06-01T00:00:00Z',
          },
        ]),
      });
    });

    await metricDetailPage.gotoMetric('outdoor_temp');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.comparisonSelect).toBeVisible();

    await metricDetailPage.comparisonSelect.selectOption(comparisonMac);

    await expect.poll(() => requests.current(), { timeout: 10_000 }).toContainEqual(expect.objectContaining({
      metricKey: 'outdoor_temp',
      deviceId: comparisonMac,
    }));
    await expect(metricDetailPage.overlayState).toContainText(`Comparing against ${comparisonName}`, { timeout: 10_000 });
    await expect(metricDetailPage.chart).toBeVisible({ timeout: 10_000 });
  });

  test('missing sensor history shows no-points empty state', async ({ metricDetailPage, context }) => {
    await setupMetricHistoryRoute(context, { empty: true });

    await metricDetailPage.gotoMetric('wind_gust');
    await expect(metricDetailPage.root).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.emptyState).toBeVisible({ timeout: 10_000 });
    await expect(metricDetailPage.emptyTitle).toContainText('No chartable wind gust history found.');
    await expect(metricDetailPage.emptyDescription).toContainText('sensor is missing or offline');
    await expect(metricDetailPage.chart).toHaveCount(0);
    await expect(metricDetailPage.historyTable).toHaveCount(0);
  });

  test('unsupported current-only metric does not fetch history', async ({ metricDetailPage, context }) => {
    let historyCalls = 0;
    await context.route('**/api/metrics/*/history**', async (route) => {
      historyCalls += 1;
      await route.fulfill({ status: 500, body: 'Unexpected history request' });
    });

    await metricDetailPage.gotoMetric('om_weather_description');
    await expect(metricDetailPage.unsupportedState).toBeVisible({ timeout: 15_000 });
    await expect(metricDetailPage.unsupportedState).toContainText('does not have chartable history');
    expect(historyCalls).toBe(0);
  });
});

async function setupMetricHistoryRoute(
  ctx: BrowserContext,
  options: {
    readonly empty?: boolean;
    readonly deviceNames?: Readonly<Record<string, string>>;
  } = {},
): Promise<{ readonly current: () => readonly HistoryRequest[] }> {
  const requests: HistoryRequest[] = [];

  await ctx.route('**/api/metrics/*/history**', async (route) => {
    const url = new URL(route.request().url());
    const pathParts = url.pathname.split('/');
    const metricKey = pathParts.at(-2) ?? 'outdoor_temp';
    const range = url.searchParams.get('range') ?? '24h';
    const granularity = url.searchParams.get('granularity') ?? 'auto';
    const date = url.searchParams.get('date');
    const deviceId = url.searchParams.get('deviceId');
    const responseDeviceId = deviceId ?? mockStation.macAddress;

    requests.push({ metricKey, range, date, granularity, deviceId });

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        metricKey,
        deviceId: responseDeviceId,
        deviceName: options.deviceNames?.[responseDeviceId] ?? 'Test Station',
        range,
        fromUtc: date ? `${date}T00:00:00Z` : '2026-06-01T00:00:00Z',
        toUtc: date ? `${date}T23:59:59Z` : '2026-06-02T00:00:00Z',
        granularity,
        unit: metricKey.includes('wind') ? 'mph' : 'F',
        points: options.empty === true ? [] : [
          { timestampUtc: '2026-06-01T00:00:00Z', value: 70.1 },
          { timestampUtc: '2026-06-01T01:00:00Z', value: 71.3 },
          { timestampUtc: '2026-06-01T02:00:00Z', value: 72.4 },
        ],
        warnings: [],
      }),
    });
  });

  return { current: () => requests };
}
