import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CustomDashboardRenderer } from './CustomDashboardRenderer';
import type { UseDashboardCurrentResult } from '../../hooks/useDashboardCurrent';
import { testDeviceId, testDeviceIdColon, testDeviceName, testDeviceTz } from '../../test/weatherTestData';
import type { CustomLayoutItem } from '../../types/customLayout';
import type { CurrentReadingDto } from '../../types/dashboard';
import type { SettingsDeviceDto, UserPreferencesDto } from '../../types/settings';

vi.mock('../../hooks/useDashboardExtrema', () => ({
  useDashboardExtrema: () => ({ data: undefined, isPending: false, isError: false, error: null }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PREFS: UserPreferencesDto = {
  temperatureUnit: 'F',
  speedUnit: 'mph',
  pressureUnit: 'inhg',
  rainfallUnit: 'in',
  distanceUnit: 'mi',
  theme: 'system',
  dateFormat: 'mdy',
  temperatureDecimals: 1,
  dailyExtremaTimezone: 'utc',
} as const;

const READING: CurrentReadingDto = {
  deviceId: testDeviceId,
  deviceName: testDeviceName,
  timestampUtc: '2026-06-02T18:00:00Z',
  receivedAtUtc: '2026-06-02T18:00:00Z',
  tempF: 72.5,
  tempInF: 68.0,
  humidity: 55,
  humidityIn: 45,
  baromRelIn: 29.92,
  baromAbsIn: 29.90,
  windDir: 270,
  windSpeedMph: 8.5,
  windGustMph: 12.0,
  maxDailyGust: 15.0,
  solarRadiation: 300,
  uv: 3,
  feelsLike: 71.0,
  feelsLikeIn: 67.0,
  dewPoint: 54.0,
  dewPointIn: 50.0,
  hourlyRainIn: 0,
  eventRainIn: 0.1,
  dailyRainIn: 0.25,
  weeklyRainIn: 1.0,
  monthlyRainIn: 3.0,
  yearlyRainIn: 18.0,
  totalRainIn: 100.0,
  lastRain: '2026-06-01T12:00:00Z',
  battOut: 1,
  dailyHighTempF: null,
  dailyLowTempF: null,
  nwsSkyConditions: null,
  nwsPresentWeather: null,
  nwsTextDescription: null,
  nwsRawMetar: null,
  omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
  omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
  omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
  tz: testDeviceTz,
};

const DEVICE: SettingsDeviceDto = {
  macAddress: testDeviceIdColon,
  name: testDeviceName,
  nickname: null,
  isPrimary: true,
  displayOnDashboard: true,
  selectedMetricKeys: null,
  latitude: null,
  longitude: null,
  elevationMeters: null,
  address: null,
  location: null,
  lastSyncAtUtc: null,
};

function makeCurrent(overrides?: Partial<UseDashboardCurrentResult>): UseDashboardCurrentResult {
  return {
    data: READING,
    isPending: false,
    isError: false,
    isNeighborsUnavailable: false,
    error: null,
    refetch: () => undefined,
    ...overrides,
  };
}

function makeBlockItem(overrides?: Partial<CustomLayoutItem & { type: 'metric-block' }>): CustomLayoutItem {
  return {
    id: 'block-1',
    type: 'metric-block',
    name: 'Comfort',
    size: '1x2',
    displayMode: 'rows',
    metrics: [
      { stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null },
      { stationId: testDeviceIdColon, metricKey: 'outdoor_humidity', labelOverride: null },
    ],
    ...overrides,
  };
}

function renderComponent(
  items: readonly CustomLayoutItem[],
  currentOverrides?: Partial<UseDashboardCurrentResult>,
) {
  render(
    <MemoryRouter>
      <CustomDashboardRenderer
        items={items}
        current={makeCurrent(currentOverrides)}
        preferences={PREFS}
        devices={[DEVICE]}
        alerts={[]}
      />
    </MemoryRouter>,
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

describe('CustomDashboardRenderer — empty state', () => {
  it('shows empty message when no items provided', () => {
    renderComponent([]);
    expect(screen.getByTestId('custom-dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-dashboard-grid')).not.toBeInTheDocument();
  });
});

// ── Grid and sizing ───────────────────────────────────────────────────────────

describe('CustomDashboardRenderer — grid and sizing', () => {
  it('renders a tile for each item', () => {
    renderComponent([
      makeBlockItem({ id: 'a', size: '1x1' }),
      makeBlockItem({ id: 'b', size: '2x1' }),
    ]);
    expect(screen.getAllByTestId('custom-dashboard-tile')).toHaveLength(2);
  });

  it('applies col and row span from item size', () => {
    renderComponent([makeBlockItem({ id: 'a', size: '2x3' })]);
    const tile = screen.getByTestId('custom-dashboard-tile');
    expect(tile).toHaveAttribute('data-tile-size', '2x3');
    expect(tile.style.gridColumn).toBe('span 2');
    expect(tile.style.gridRow).toBe('span 3');
  });

  it('renders items in the order they appear', () => {
    renderComponent([
      makeBlockItem({ id: 'first', name: 'First' }),
      makeBlockItem({ id: 'second', name: 'Second' }),
      makeBlockItem({ id: 'third', name: 'Third' }),
    ]);
    const names = screen.getAllByTestId('custom-dashboard-block-name').map((el) => el.textContent);
    expect(names).toEqual(['First', 'Second', 'Third']);
  });
});

// ── Metric block tile (rows mode) ─────────────────────────────────────────────

describe('CustomDashboardRenderer — metric block rows', () => {
  it('renders the block name', () => {
    renderComponent([makeBlockItem({ name: 'Comfort' })]);
    expect(screen.getByTestId('custom-dashboard-block-name')).toHaveTextContent('Comfort');
  });

  it('renders a row for each metric with label and value', () => {
    renderComponent([makeBlockItem()]);
    const rows = screen.getAllByTestId('custom-dashboard-metric-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId('custom-dashboard-metric-label')).toHaveTextContent('Outdoor Temp');
    expect(within(rows[0]).getByTestId('custom-dashboard-metric-value')).toHaveTextContent('72.5');
    expect(within(rows[1]).getByTestId('custom-dashboard-metric-label')).toHaveTextContent('Outdoor Humidity');
    expect(within(rows[1]).getByTestId('custom-dashboard-metric-value')).toHaveTextContent('55');
  });

  it('links available owned-station row values to metric history', () => {
    renderComponent([makeBlockItem({
      metrics: [{ stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null }],
    })]);

    const link = screen.getByTestId('dashboard-metric-history-link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/metrics/outdoor_temp'));
    expect(link).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(testDeviceIdColon)));
    expect(screen.getByTestId('custom-dashboard-metric-value')).toHaveTextContent('72.5');
  });

  it('shows station name on each row', () => {
    renderComponent([makeBlockItem()]);
    // device name appears in row (via stationLabel helper)
    const rows = screen.getAllByTestId('custom-dashboard-metric-row');
    expect(rows[0].textContent).toContain(testDeviceName);
  });

  it('uses public-source current readings for public-source metric refs', () => {
    const publicStationId = 'public:source-1';
    const publicReading: CurrentReadingDto = {
      ...READING,
      deviceId: publicStationId,
      deviceName: 'Open-Meteo - Generated source',
      tempF: 44.4,
    };
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[makeBlockItem({
            metrics: [{ stationId: publicStationId, metricKey: 'outdoor_temp', labelOverride: null }],
          })]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[
            DEVICE,
            {
              ...DEVICE,
              macAddress: publicStationId,
              name: 'Open-Meteo - Generated source',
              sourceKind: 'public',
            },
          ]}
          publicSourceReadings={new Map([[publicStationId, publicReading]])}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-dashboard-metric-value')).toHaveTextContent('44.4');
    expect(screen.getByTestId('custom-dashboard-metric-row')).toHaveTextContent('Open-Meteo - Generated source');
    expect(screen.queryByTestId('dashboard-metric-history-link')).not.toBeInTheDocument();
  });

  it('uses pinned-station readings ahead of public-source readings for pinned metric refs', () => {
    const pinnedId = 'pinned:WeatherGov:KGEN';
    const pinnedReading: CurrentReadingDto = {
      ...READING,
      deviceId: pinnedId,
      deviceName: 'Generated pinned station',
      tempF: 33.3,
    };
    const publicReading: CurrentReadingDto = { ...READING, tempF: 99.9 };
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[makeBlockItem({
            metrics: [{ stationId: pinnedId, metricKey: 'outdoor_temp', labelOverride: null }],
          })]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[
            DEVICE,
            {
              ...DEVICE,
              macAddress: pinnedId,
              name: '(Pinned) Generated pinned station',
              sourceKind: 'pinned',
              isPrimary: false,
            },
          ]}
          publicSourceReadings={new Map([[pinnedId, publicReading]])}
          pinnedStationReadings={new Map([[pinnedId, pinnedReading]])}
        />
      </MemoryRouter>,
    );

    // pinnedStationReadings (33.3) should win over publicSourceReadings (99.9)
    expect(screen.getByTestId('custom-dashboard-metric-value')).toHaveTextContent('33.3');
    expect(screen.getByTestId('custom-dashboard-metric-row')).toHaveTextContent('(Pinned) Generated pinned station');
    expect(screen.queryByTestId('dashboard-metric-history-link')).not.toBeInTheDocument();
  });

  it('shows label override when set', () => {
    renderComponent([
      makeBlockItem({
        metrics: [{ stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: 'Outside' }],
      }),
    ]);
    expect(screen.getByTestId('custom-dashboard-metric-label')).toHaveTextContent('Outside');
  });

  it('shows empty message when block has no metrics', () => {
    renderComponent([makeBlockItem({ metrics: [] })]);
    expect(screen.getByTestId('custom-dashboard-block-empty')).toBeInTheDocument();
  });

  it('shows loading indicator when current is pending', () => {
    renderComponent([makeBlockItem()], { data: undefined, isPending: true });
    const values = screen.getAllByTestId('custom-dashboard-metric-value');
    expect(values[0]).toHaveTextContent('…');
    expect(screen.queryByTestId('dashboard-metric-history-link')).not.toBeInTheDocument();
  });

  it('shows — for all metric values when current is errored', () => {
    renderComponent([makeBlockItem()], { data: undefined, isError: true });
    const values = screen.getAllByTestId('custom-dashboard-metric-value');
    values.forEach((v) => { expect(v).toHaveTextContent('—'); });
  });

  it('keeps owned-station fields visible with warnings when credentials are disconnected', () => {
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[makeBlockItem({
            metrics: [{ stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null }],
          })]}
          current={makeCurrent({ data: undefined, isError: true })}
          preferences={PREFS}
          devices={[]}
          alerts={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-dashboard-disconnected-warning')).toHaveTextContent(
      '1 custom layout field is disconnected',
    );
    expect(screen.getByTestId('custom-dashboard-block-disconnected')).toHaveTextContent('No available fields');
    expect(screen.getByTestId('custom-dashboard-field-warning')).toHaveTextContent(
      'Re-enter Ambient Weather credentials',
    );
    expect(screen.getByTestId('custom-dashboard-metric-label')).toHaveTextContent('Outdoor Temp');
    expect(screen.getByTestId('custom-dashboard-metric-value')).toHaveTextContent('—');
    expect(screen.queryByTestId('dashboard-metric-history-link')).not.toBeInTheDocument();
  });

  it('keeps removed public-source fields visible with warnings', () => {
    const publicStationId = 'public:source-removed';
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[makeBlockItem({
            metrics: [{ stationId: publicStationId, metricKey: 'outdoor_temp', labelOverride: null }],
          })]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[]}
          alerts={[]}
          publicSourceReadings={new Map()}
          isExternalLoading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-dashboard-disconnected-warning')).toHaveTextContent(
      '1 custom layout field is disconnected',
    );
    expect(screen.getByTestId('custom-dashboard-field-warning')).toHaveTextContent(
      'Re-add or re-enable this source',
    );
    expect(screen.getByTestId('custom-dashboard-metric-value')).toHaveTextContent('—');
  });

  it('counts disconnected fields across custom blocks without warning connected fields', () => {
    const publicStationId = 'public:source-removed';
    const pinnedStationId = 'pinned:WeatherGov:KREMOVED';

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[
            makeBlockItem({
              id: 'mixed',
              metrics: [
                { stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null },
                { stationId: publicStationId, metricKey: 'outdoor_humidity', labelOverride: null },
              ],
            }),
            makeBlockItem({
              id: 'pinned',
              metrics: [
                { stationId: pinnedStationId, metricKey: 'wind_speed', labelOverride: null },
              ],
            }),
          ]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
          publicSourceReadings={new Map()}
          pinnedStationReadings={new Map()}
          isExternalLoading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-dashboard-disconnected-warning')).toHaveTextContent(
      '2 custom layout fields are disconnected',
    );
    expect(screen.getAllByTestId('custom-dashboard-field-warning')).toHaveLength(2);
    expect(screen.getAllByTestId('custom-dashboard-block-disconnected')).toHaveLength(1);

    const rows = screen.getAllByTestId('custom-dashboard-metric-row');
    expect(within(rows[0]).getByTestId('custom-dashboard-metric-value')).toHaveTextContent('72.5');
    expect(within(rows[0]).queryByTestId('custom-dashboard-field-warning')).not.toBeInTheDocument();
    expect(within(rows[1]).getByTestId('custom-dashboard-metric-value')).toHaveTextContent('—');
  });

  it('keeps removed pinned-source fields visible with source-specific warnings', () => {
    const pinnedStationId = 'pinned:WeatherGov:KREMOVED';

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[makeBlockItem({
            metrics: [{ stationId: pinnedStationId, metricKey: 'wind_speed', labelOverride: null }],
          })]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[]}
          alerts={[]}
          pinnedStationReadings={new Map()}
          isExternalLoading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-dashboard-disconnected-warning')).toHaveTextContent(
      '1 custom layout field is disconnected',
    );
    expect(screen.getByTestId('custom-dashboard-field-warning')).toHaveTextContent(
      'Re-add or re-enable this source',
    );
    expect(screen.getByTestId('custom-dashboard-metric-label')).toHaveTextContent('Wind Speed');
  });

  it('does not show disconnected warnings while external source readings are still loading', () => {
    const publicStationId = 'public:source-loading';

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[makeBlockItem({
            metrics: [{ stationId: publicStationId, metricKey: 'outdoor_temp', labelOverride: null }],
          })]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[]}
          alerts={[]}
          publicSourceReadings={new Map()}
          isExternalLoading
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('custom-dashboard-disconnected-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('custom-dashboard-field-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('custom-dashboard-metric-value')).toHaveTextContent('…');
  });
});

// ── Fill tile ─────────────────────────────────────────────────────────────────

const FILL_ONE: CustomLayoutItem = makeBlockItem({
  size: '1x1',
  displayMode: 'fill',
  metrics: [{ stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null }],
});

describe('CustomDashboardRenderer — fill tile', () => {
  it('renders as fill tile when displayMode is fill and metric count matches capacity', () => {
    renderComponent([FILL_ONE]);
    expect(screen.getByTestId('custom-dashboard-fill-tile')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-dashboard-block-tile')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-metric-history-link')).toHaveAttribute(
      'href',
      expect.stringContaining('/metrics/outdoor_temp'),
    );
  });

  it('renders a 2x1 fill tile with two metrics as a two-cell grid', () => {
    const twoCell: CustomLayoutItem = makeBlockItem({
      size: '2x1',
      displayMode: 'fill',
      metrics: [
        { stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null },
        { stationId: testDeviceIdColon, metricKey: 'outdoor_humidity', labelOverride: null },
      ],
    });
    renderComponent([twoCell]);
    expect(screen.getByTestId('custom-dashboard-fill-tile')).toBeInTheDocument();
    expect(screen.getAllByTestId('custom-dashboard-fill-value')).toHaveLength(2);
  });

  it('shows the metric value large', () => {
    renderComponent([FILL_ONE]);
    expect(screen.getByTestId('custom-dashboard-fill-value')).toHaveTextContent('72.5');
  });

  it('shows the unit', () => {
    renderComponent([FILL_ONE]);
    expect(screen.getByTestId('custom-dashboard-fill-unit')).toHaveTextContent('°F');
  });

  it('shows … when loading', () => {
    renderComponent([FILL_ONE], { data: undefined, isPending: true });
    expect(screen.getByTestId('custom-dashboard-fill-value')).toHaveTextContent('…');
  });

  it('shows — when errored', () => {
    renderComponent([FILL_ONE], { data: undefined, isError: true });
    expect(screen.getByTestId('custom-dashboard-fill-value')).toHaveTextContent('—');
  });

  it('keeps disconnected fill tiles visible with an in-tile warning', () => {
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[FILL_ONE]}
          current={makeCurrent({ data: undefined, isError: true })}
          preferences={PREFS}
          devices={[]}
          alerts={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-dashboard-fill-tile')).toBeInTheDocument();
    expect(screen.getByTestId('custom-dashboard-disconnected-warning')).toBeInTheDocument();
    expect(screen.getByTestId('custom-dashboard-field-warning')).toHaveTextContent(
      'Re-enter Ambient Weather credentials',
    );
    expect(screen.getByTestId('custom-dashboard-fill-value')).toHaveTextContent('—');
  });

  it('falls through to rows tile when metric count does not match capacity', () => {
    // 1x1 block (capacity 1) but 2 metrics — should not activate fill mode
    const mismatch: CustomLayoutItem = makeBlockItem({
      size: '1x1',
      displayMode: 'fill',
      metrics: [
        { stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null },
        { stationId: testDeviceIdColon, metricKey: 'outdoor_humidity', labelOverride: null },
      ],
    });
    renderComponent([mismatch]);
    expect(screen.queryByTestId('custom-dashboard-fill-tile')).not.toBeInTheDocument();
    expect(screen.getByTestId('custom-dashboard-block-tile')).toBeInTheDocument();
  });
});

// ── Divider ───────────────────────────────────────────────────────────────────

describe('CustomDashboardRenderer — divider', () => {
  it('renders a divider tile', () => {
    const divider: CustomLayoutItem = { id: 'd1', type: 'divider', name: 'Weather', size: '3x1' };
    renderComponent([divider]);
    expect(screen.getByTestId('custom-dashboard-divider')).toBeInTheDocument();
    expect(screen.getByTestId('custom-dashboard-divider').textContent).toContain('Weather');
  });

  it('renders a blank divider when name is null', () => {
    const divider: CustomLayoutItem = { id: 'd2', type: 'divider', name: null, size: '3x1' };
    renderComponent([divider]);
    expect(screen.getByTestId('custom-dashboard-divider')).toBeInTheDocument();
  });
});

// ── Tickers ───────────────────────────────────────────────────────────────────

const HEADER_TICKER: CustomLayoutItem = {
  id: 't1', type: 'header-ticker', name: null,
  position: 'header', size: '3x1', sourceLabels: [], isPaused: true,
};

const FOOTER_TICKER: CustomLayoutItem = {
  id: 't2', type: 'footer-ticker', name: 'Conditions',
  position: 'footer', size: '3x1', sourceLabels: [], isPaused: true,
};

describe('CustomDashboardRenderer — ticker', () => {
  it('renders a header ticker region', () => {
    renderComponent([HEADER_TICKER]);
    const ticker = screen.getByTestId('custom-dashboard-ticker');
    expect(ticker).toBeInTheDocument();
    expect(ticker).toHaveAttribute('role', 'region');
    expect(ticker).toHaveAttribute('aria-label');
  });

  it('uses item name as the region label when set', () => {
    renderComponent([FOOTER_TICKER]);
    expect(screen.getByTestId('custom-dashboard-ticker')).toHaveAttribute('aria-label', 'Conditions');
  });

  it('renders weather entries from current reading when sourceLabels is empty', () => {
    renderComponent([{ ...HEADER_TICKER, isPaused: true }]);
    const entries = screen.getAllByTestId('custom-dashboard-ticker-entry');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('renders only the specified sourceLabels as entries', () => {
    const ticker: CustomLayoutItem = {
      ...HEADER_TICKER,
      sourceLabels: ['outdoor_temp', 'outdoor_humidity'],
      isPaused: true,
    };
    renderComponent([ticker]);
    const entries = screen.getAllByTestId('custom-dashboard-ticker-entry');
    expect(entries).toHaveLength(2);
    expect(entries[0].textContent).toContain('Outdoor Temp');
    expect(entries[1].textContent).toContain('Outdoor Humidity');
  });

  it('shows the pause button with correct aria-label when running', () => {
    renderComponent([{ ...HEADER_TICKER, isPaused: false }]);
    const btn = screen.getByTestId('custom-dashboard-ticker-pause');
    expect(btn).toHaveAttribute('aria-label', 'Pause ticker');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the resume button with correct aria-label when paused', () => {
    renderComponent([HEADER_TICKER]);
    const btn = screen.getByTestId('custom-dashboard-ticker-pause');
    expect(btn).toHaveAttribute('aria-label', 'Resume ticker');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles between paused and running when the button is clicked', () => {
    renderComponent([HEADER_TICKER]);
    const btn = screen.getByTestId('custom-dashboard-ticker-pause');
    expect(btn).toHaveAttribute('aria-label', 'Resume ticker');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', 'Pause ticker');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', 'Resume ticker');
  });

  it('pause button meets minimum 32×32 target size via h-8 w-8', () => {
    renderComponent([HEADER_TICKER]);
    const btn = screen.getByTestId('custom-dashboard-ticker-pause');
    // h-8 w-8 = 2rem = 32px — above the WCAG 2.5.8 24px minimum
    expect(btn.className).toMatch(/h-8/);
    expect(btn.className).toMatch(/w-8/);
  });

  it('scrolling content region is aria-live off to avoid AT interruption', () => {
    renderComponent([{ ...HEADER_TICKER, isPaused: false }]);
    const content = screen.getByTestId('custom-dashboard-ticker-content');
    expect(content).toHaveAttribute('aria-live', 'off');
  });

  it('shows loading message when current is pending', () => {
    renderComponent([HEADER_TICKER], { data: undefined, isPending: true });
    expect(screen.getByTestId('custom-dashboard-ticker')).toHaveTextContent('Loading…');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[HEADER_TICKER]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
        />
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders alert headlines in ticker entries when active alerts exist', () => {
    const headline = 'Generated alert headline';
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[HEADER_TICKER]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[{
            id: 'alert-1',
            event: 'Generated event',
            headline,
            description: null,
            severity: 'Severe',
            urgency: 'Immediate',
            certainty: 'Likely',
            effectiveUtc: null,
            expiresUtc: null,
            areaDesc: null,
          }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-header-ticker')).toBeInTheDocument();
    expect(screen.getByTestId('custom-dashboard-ticker')).toHaveTextContent(headline);
  });
});

// ── Block icons ───────────────────────────────────────────────────────────────

describe('CustomDashboardRenderer — block icons', () => {
  it('shows icon on multiple independent tiles without cross-contamination', () => {
    renderComponent([
      makeBlockItem({ id: 'tile-1', name: 'Tile 1', icon: 'Thermometer' }),
      makeBlockItem({ id: 'tile-2', name: 'Tile 2', icon: 'Wind' }),
      makeBlockItem({ id: 'tile-3', name: 'Tile 3' }),
    ]);

    // Both icon tiles render their icon; the third does not.
    expect(screen.getAllByTestId('custom-dashboard-block-icon-right')).toHaveLength(2);
    expect(screen.queryAllByTestId('custom-dashboard-block-icon-left')).toHaveLength(0);
  });

  it('positions the icon on the right by default', () => {
    renderComponent([makeBlockItem({ id: 'b', name: 'Station', icon: 'Sun' })]);
    expect(screen.getByTestId('custom-dashboard-block-icon-right')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-dashboard-block-icon-left')).not.toBeInTheDocument();
  });

  it('positions the icon on the left when iconPosition is left', () => {
    renderComponent([makeBlockItem({ id: 'b', name: 'Station', icon: 'Sun', iconPosition: 'left' })]);
    expect(screen.getByTestId('custom-dashboard-block-icon-left')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-dashboard-block-icon-right')).not.toBeInTheDocument();
  });

  it('shows icon on a fill-mode tile', () => {
    renderComponent([
      makeBlockItem({ id: 'f', name: 'Fill', icon: 'Gauge', displayMode: 'fill', size: '1x1',
        metrics: [{ stationId: testDeviceIdColon, metricKey: 'outdoor_temp', labelOverride: null }] }),
    ]);
    expect(screen.getByTestId('custom-dashboard-fill-icon-right')).toBeInTheDocument();
  });

  it('shows no icon when none is set', () => {
    renderComponent([makeBlockItem({ id: 'b', name: 'Plain' })]);
    expect(screen.queryByTestId('custom-dashboard-block-icon-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('custom-dashboard-block-icon-left')).not.toBeInTheDocument();
  });
});

// ── Ticker — channel reading & per-zone alerts ────────────────────────────────

const CHANNEL_READING: CurrentReadingDto = {
  ...READING,
  deviceId: 'channel-device',
  deviceName: 'Channel Station',
  tempF: 55.5,
  source: 'public',
};

describe('CustomDashboardRenderer — ticker channel reading', () => {
  const TICKER_ITEM: CustomLayoutItem = {
    id: 'ticker-1',
    type: 'header-ticker',
    name: null,
    position: 'header',
    size: '3x1',
    sourceLabels: ['outdoor_temp'],
    isPaused: true,
    channelStationId: null,
    alertsZone: null,
  };

  it('uses own-station reading when channelStationId is null', () => {
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[TICKER_ITEM]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
        />
      </MemoryRouter>,
    );
    // Own reading has tempF 72.5 — formatted as "72.5"
    expect(screen.getByTestId('custom-dashboard-ticker-content')).toHaveTextContent('72.5');
  });

  it('uses pinned station reading when channelStationId matches a pinned key', () => {
    const pinnedId = 'pinned:WeatherGov:KGEN';
    const pinnedReadings = new Map([[pinnedId, CHANNEL_READING]]);

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[{ ...TICKER_ITEM, channelStationId: pinnedId }]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
          pinnedStationReadings={pinnedReadings}
        />
      </MemoryRouter>,
    );
    // Channel reading has tempF 55.5
    expect(screen.getByTestId('custom-dashboard-ticker-content')).toHaveTextContent('55.5');
  });

  it('uses public source reading when channelStationId matches a public source key', () => {
    const publicId = 'public:WeatherGov:KABC';
    const publicReadings = new Map([[publicId, CHANNEL_READING]]);

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[{ ...TICKER_ITEM, channelStationId: publicId }]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
          publicSourceReadings={publicReadings}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('custom-dashboard-ticker-content')).toHaveTextContent('55.5');
  });

  it('falls back to own-station reading when channelStationId is set but not in maps', () => {
    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[{ ...TICKER_ITEM, channelStationId: 'missing-id' }]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
        />
      </MemoryRouter>,
    );
    // Falls back to own reading (72.5)
    expect(screen.getByTestId('custom-dashboard-ticker-content')).toHaveTextContent('72.5');
  });
});

describe('CustomDashboardRenderer — ticker per-zone alerts', () => {
  const TICKER_WITH_ZONE: CustomLayoutItem = {
    id: 'ticker-z',
    type: 'header-ticker',
    name: null,
    position: 'header',
    size: '3x1',
    sourceLabels: [],
    isPaused: true,
    channelStationId: null,
    alertsZone: 'NYZ072',
  };

  it('uses zone-specific alerts when alertsZone is set and tickerAlertsMap has an entry', () => {
    const zoneAlert = {
      id: 'zone-alert-1',
      event: 'Tornado Warning',
      headline: 'Tornado Warning in effect',
      description: null,
      severity: 'Extreme',
      urgency: 'Immediate',
      certainty: 'Likely',
      effectiveUtc: null,
      expiresUtc: null,
      areaDesc: null,
    };
    const tickerAlertsMap = new Map([['NYZ072', [zoneAlert]]]);

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[TICKER_WITH_ZONE]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[]}
          tickerAlertsMap={tickerAlertsMap}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('custom-dashboard-ticker')).toHaveTextContent('Tornado Warning in effect');
  });

  it('falls back to dashboard-level alerts when zone has no entry in tickerAlertsMap', () => {
    const dashAlert = {
      id: 'dash-alert-1',
      event: 'Flood Watch',
      headline: 'Flood Watch headline',
      description: null,
      severity: 'Moderate',
      urgency: 'Future',
      certainty: 'Possible',
      effectiveUtc: null,
      expiresUtc: null,
      areaDesc: null,
    };

    render(
      <MemoryRouter>
        <CustomDashboardRenderer
          items={[TICKER_WITH_ZONE]}
          current={makeCurrent()}
          preferences={PREFS}
          devices={[DEVICE]}
          alerts={[dashAlert]}
          tickerAlertsMap={new Map()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('custom-dashboard-ticker')).toHaveTextContent('Flood Watch headline');
  });
});
