import { faker } from '@faker-js/faker';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import * as settingsApi from '../api/settings';
import * as alertsApi from '../api/alerts';
import * as neighborsApi from '../api/neighbors';
import * as publicSourcesApi from '../api/publicSources';
import { useSettingsDevices } from '../hooks/useSettingsDevices';
import type { CurrentReadingDto, DashboardLayoutDto, DashboardRainfallDto } from '../types/dashboard';

const mockDashboard = vi.hoisted(() => {
  const makeDeviceId = () => Array.from(
    { length: 12 },
    () => Math.floor(Math.random() * 16).toString(16),
  ).join('').toUpperCase();

  const testDeviceId = makeDeviceId();
  const testOtherDeviceId = makeDeviceId();
  const testDeviceName = `Generated station ${testDeviceId.slice(0, 4)}`;
  const testOtherDeviceName = `Generated station ${testOtherDeviceId.slice(0, 4)}`;
  const testDeviceTz = 'UTC';

  const currentReadingValue = {
    deviceId: testDeviceId,
    deviceName: testDeviceName,
    timestampUtc: '2026-06-01T12:00:00Z',
    receivedAtUtc: new Date().toISOString(),
    tempF: 72.4,
    tempInF: 70.1,
    feelsLike: 74,
    feelsLikeIn: 70,
    dewPoint: 60,
    dewPointIn: 55,
    humidity: 51,
    humidityIn: 45,
    baromRelIn: 29.92,
    baromAbsIn: 29.81,
    windDir: 180,
    windSpeedMph: 5,
    windGustMph: 9,
    maxDailyGust: 12,
    solarRadiation: 450,
    uv: 3,
    nwsSkyConditions: 'FEW @ 1,800ft',
    nwsPresentWeather: 'Light rain',
    nwsTextDescription: 'Generated weather description.',
    nwsRawMetar: `K${Math.random().toString(36).slice(2, 5).toUpperCase()} 091200Z 18008KT 10SM -RA FEW018`,
    hourlyRainIn: 0,
    eventRainIn: 0.12,
    dailyRainIn: 0.2,
    weeklyRainIn: 1.2,
    monthlyRainIn: 2.3,
    yearlyRainIn: 10.5,
    totalRainIn: 50,
    lastRain: '2026-05-30T09:00:00Z',
    tz: testDeviceTz,
    battOut: null,
  } as CurrentReadingDto;

  const rainfallValue = {
    deviceId: testDeviceId,
    deviceName: testDeviceName,
    timestampUtc: '2026-06-01T12:00:00Z',
    receivedAtUtc: '2026-06-01T12:00:05Z',
    eventRainIn: 0.12,
    dailyRainIn: 0.2,
    weeklyRainIn: 1.2,
    monthlyRainIn: 2.3,
    yearlyRainIn: 10.5,
    lastRain: '2026-05-30T09:00:00Z',
  } as DashboardRainfallDto;

  const layoutValue = {
    id: 'layout-1',
    name: 'Default',
    layoutMode: 'default',
    updatedAtUtc: '2026-06-01T12:00:00Z',
    tiles: [
      { i: `temperature-${testDeviceId}`, x: 0, y: 0, w: 3, h: 5, type: 'temperature', deviceId: testDeviceId },
      { i: `humidity-${testDeviceId}`, x: 3, y: 0, w: 2, h: 3, type: 'humidity', deviceId: testDeviceId },
      { i: 'rainfall', x: 0, y: 5, w: 4, h: 4, type: 'rainfall' },
    ],
    customItems: [],
  } as DashboardLayoutDto;

  return {
    currentReading: currentReadingValue,
    neighborsUnavailable: false,
    rainfall: rainfallValue,
    layout: layoutValue,
    testDeviceId,
    testOtherDeviceId,
    testDeviceName,
    testOtherDeviceName,
  };
});

vi.mock('../api/settings');
vi.mock('../api/alerts');
vi.mock('../api/neighbors');
vi.mock('../api/publicSources');
vi.mock('../hooks/useSettingsDevices', () => ({ useSettingsDevices: vi.fn() }));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    getAccessToken: () => Promise.resolve('mock-token'),
    isAuthenticated: true,
  }),
}));

vi.mock('../hooks/useDashboardCurrent', () => ({
  useDashboardCurrent: (source?: 'own' | 'neighbors') => ({
    data: source === 'neighbors'
      ? undefined
      : mockDashboard.currentReading,
    isPending: false,
    isError: false,
    isNeighborsUnavailable: source === 'neighbors' && mockDashboard.neighborsUnavailable,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useDashboardRainfall', () => ({
  useDashboardRainfall: () => ({
    data: mockDashboard.rainfall,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../hooks/useDashboardLayout', () => ({
  useDashboardLayout: () => ({
    data: mockDashboard.layout,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../hooks/useWeatherHub', () => ({
  useWeatherHub: () => ({ hubState: 'connected' }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.documentElement.classList.remove('dark');
    mockDashboard.neighborsUnavailable = false;
    mockDashboard.layout = {
      id: 'layout-1',
      name: 'Default',
      layoutMode: 'default',
      updatedAtUtc: '2026-06-01T12:00:00Z',
      tiles: [
        { i: `temperature-${mockDashboard.testDeviceId}`, x: 0, y: 0, w: 3, h: 5, type: 'temperature', deviceId: mockDashboard.testDeviceId },
        { i: `humidity-${mockDashboard.testDeviceId}`, x: 3, y: 0, w: 2, h: 3, type: 'humidity', deviceId: mockDashboard.testDeviceId },
        { i: 'rainfall', x: 0, y: 5, w: 4, h: 4, type: 'rainfall' },
      ],
      customItems: [],
    };
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({
      ok: true,
      data: {
        temperatureUnit: 'F',
        speedUnit: 'mph',
        pressureUnit: 'inhg',
        rainfallUnit: 'in',
        distanceUnit: 'mi',
        theme: 'system',
        dateFormat: 'mdy',
        temperatureDecimals: 1,
        dailyExtremaTimezone: 'utc' as const,
      },
    });
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });
    vi.mocked(alertsApi.getActiveAlerts).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: true,
        enabledStationMacAddresses: [mockDashboard.testDeviceId],
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      },
    });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: true,
        enabledStationMacAddresses: [mockDashboard.testDeviceId],
        radiusMiles: 15,
        comparisonRadiusMiles: 12.5,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      },
    });
    vi.mocked(neighborsApi.getNeighborComparisonStations).mockResolvedValue({
      ok: true,
      data: [{
        provider: 'AmbientOpen',
        sourceId: 'ambient-neighbor-1',
        name: 'Generated Ambient Neighbor',
        lat: 40.1,
        lon: -96.1,
        distanceMiles: 1.2,
        lastObservedAtUtc: new Date().toISOString(),
        freshnessMinutes: 3,
        tempF: 71,
        humidity: 45,
        dewPoint: null,
        feelsLike: null,
        baromRelIn: null,
        baromAbsIn: null,
        windSpeedMph: 4,
        windGustMph: null,
        windDir: null,
        hourlyRainIn: null,
        dailyRainIn: null,
        weeklyRainIn: null,
        monthlyRainIn: null,
        yearlyRainIn: null,
        solarRadiation: null,
        uv: null,
      }],
    });
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(publicSourcesApi.getPublicSourceCurrent).mockResolvedValue({
      ok: true,
      data: {
        ...mockDashboard.currentReading,
        deviceId: 'public-source',
        deviceName: 'Open-Meteo - Generated public source',
        tempF: 64.2,
        source: 'public',
      },
    });
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [{
        macAddress: mockDashboard.testDeviceId,
        name: mockDashboard.testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: ['outdoor_temp', 'outdoor_humidity', 'indoor_humidity', 'pressure', 'rainfall_day', 'rainfall_week'],
        latitude: null, longitude: null, elevationMeters: null,
        address: null, location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders live dashboard tiles from current, rainfall, and layout data', async () => {
    renderPage();

    // Wait for preferences to resolve so the (UTC) timezone label is applied
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-weather-hub-state')).toHaveTextContent(
        `Connected (UTC): ${mockDashboard.testDeviceName}`,
      );
    });
    expect(await screen.findByTestId('dashboard-rainfall-summary-tile')).toHaveTextContent('Rainfall');
    expect(screen.getByTestId('dashboard-temperature-tile')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-humidity-tile')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-humidity-tile')).toHaveTextContent('Atmosphere');
    expect(screen.getByTestId('dashboard-humidity-tile')).toHaveTextContent('Outdoor humidity');
    expect(screen.getByTestId('dashboard-humidity-tile')).toHaveTextContent('Indoor humidity');
    expect(screen.getByTestId('dashboard-humidity-tile')).toHaveTextContent('Barometric pressure');
    expect(screen.getByTestId('dashboard-pressure-value')).toHaveTextContent('29.92 inHg');
    expect(screen.queryByTestId('dashboard-metric-tile')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-temperature-value')[0]).toHaveTextContent('72.4');
  });

  it('shows a retryable status when weather alerts fail to load', async () => {
    vi.mocked(alertsApi.getActiveAlerts)
      .mockResolvedValueOnce({ ok: false, status: 503, error: 'Generated alerts failure' })
      .mockResolvedValueOnce({
        ok: true,
        data: [{
          id: 'generated-recovered-alert',
          event: 'Severe Thunderstorm Warning',
          headline: 'Generated recovered alert headline',
          description: 'Generated alert description.',
          severity: 'Severe',
          urgency: 'Expected',
          certainty: 'Likely',
          effectiveUtc: '2026-06-05T12:00:00Z',
          expiresUtc: '2026-06-05T13:00:00Z',
          areaDesc: 'Generated Alert Area',
        }],
      });

    renderPage();

    expect(await screen.findByTestId('dashboard-alerts-error')).toHaveTextContent(
      'Weather alerts could not load',
    );
    fireEvent.click(screen.getByTestId('dashboard-alerts-retry'));

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-alerts-error')).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('dashboard-alerts-banner')).toHaveTextContent(
      'Generated recovered alert headline',
    );
    expect(alertsApi.getActiveAlerts).toHaveBeenCalledTimes(2);
  });

  it('points neighbor unavailable guidance to the station header settings', async () => {
    mockDashboard.neighborsUnavailable = true;

    renderPage();

    fireEvent.click(await screen.findByTestId('dashboard-source-neighbors-button'));

    expect(await screen.findByTestId('dashboard-neighbors-unavailable')).toHaveTextContent(
      'Enable Dashboard and Neighbor comparison for this station in Settings → My Stations → Sources.',
    );
  });

  it('shows per-station Ambient neighbor count and opens the contributor list', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('dashboard-source-neighbors-button'));

    expect(await screen.findByTestId('dashboard-neighbors-label')).toHaveTextContent(
      `Neighbors of ${mockDashboard.testDeviceName}`,
    );
    const countButton = await screen.findByTestId('dashboard-neighbors-count-button');
    expect(countButton).toHaveTextContent('1 nearby station');
    expect(neighborsApi.getNeighborComparisonStations).toHaveBeenCalledWith(
      'mock-token',
      mockDashboard.testDeviceId,
      expect.any(AbortSignal),
    );

    fireEvent.click(countButton);

    expect(await screen.findByTestId('neighbors-station-drawer')).toHaveTextContent('Generated Ambient Neighbor');
    expect(screen.queryByTestId('neighbors-station-pin-button')).not.toBeInTheDocument();
  });

  it('hides neighbor mode controls for custom layouts', async () => {
    mockDashboard.layout = {
      ...mockDashboard.layout,
      layoutMode: 'custom',
      tiles: [],
      customItems: [],
    };

    renderPage();

    expect(await screen.findByTestId('custom-dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-source-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-source-neighbors-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-neighbors-radius-control')).not.toBeInTheDocument();
  });

  it('hides public and pinned station groups from the neighbors dashboard view', async () => {
    const publicId = `public:${faker.string.uuid()}`;
    const pinnedId = `pinned:WeatherGov:${faker.string.alphanumeric(6)}`;
    mockDashboard.layout = {
      ...mockDashboard.layout,
      tiles: [
        ...mockDashboard.layout.tiles,
        { i: `temperature-${publicId}`, x: 0, y: 10, w: 3, h: 5, type: 'temperature', deviceId: publicId },
        { i: `temperature-${pinnedId}`, x: 0, y: 15, w: 3, h: 5, type: 'temperature', deviceId: pinnedId },
      ],
    };
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [
        {
          macAddress: mockDashboard.testDeviceId,
          name: mockDashboard.testDeviceName,
          nickname: null,
          isPrimary: true,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: null,
          lastSyncAtUtc: null,
        },
        {
          macAddress: publicId,
          name: 'Generated Open-Meteo source',
          nickname: null,
          isPrimary: false,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: null,
          lastSyncAtUtc: null,
          sourceKind: 'public',
        },
        {
          macAddress: pinnedId,
          name: 'Generated pinned source',
          nickname: null,
          isPrimary: false,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: null,
          lastSyncAtUtc: null,
          sourceKind: 'pinned',
        },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    fireEvent.click(await screen.findByTestId('dashboard-source-neighbors-button'));

    await waitFor(() => {
      expect(screen.getAllByTestId('dashboard-source-heading')).toHaveLength(1);
    });
    expect(screen.getByTestId('dashboard-source-heading')).toHaveTextContent(mockDashboard.testDeviceName);
    expect(screen.queryByText('Generated Open-Meteo source')).not.toBeInTheDocument();
    expect(screen.queryByText('Generated pinned source')).not.toBeInTheDocument();
  });

  it('saves global neighbor comparison radius from the Neighbors dashboard view', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('dashboard-source-neighbors-button'));
    const radiusInput = await screen.findByTestId('dashboard-neighbors-radius-input');
    fireEvent.change(radiusInput, { target: { value: '12.5' } });
    fireEvent.blur(radiusInput);

    await waitFor(() => {
      expect(neighborsApi.putNeighborsConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          radiusMiles: 15,
          comparisonRadiusMiles: 12.5,
          enabledProviders: ['WeatherGov', 'OpenMeteo'],
        }),
        'mock-token',
      );
    });
  });

  it('groups dashboard tiles by source with the primary station first', async () => {
    mockDashboard.layout = {
      ...mockDashboard.layout,
      tiles: [
        { i: `temperature-${mockDashboard.testDeviceId}`, x: 0, y: 0, w: 3, h: 5, type: 'temperature', deviceId: mockDashboard.testDeviceId },
        { i: `temperature-${mockDashboard.testOtherDeviceId}`, x: 3, y: 0, w: 3, h: 5, type: 'temperature', deviceId: mockDashboard.testOtherDeviceId },
        { i: 'rainfall', x: 0, y: 5, w: 4, h: 4, type: 'rainfall' },
      ],
    };
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [
        {
          macAddress: mockDashboard.testDeviceId,
          name: 'Secondary Station',
          nickname: null,
          isPrimary: false,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: null,
          lastSyncAtUtc: null,
        },
        {
          macAddress: mockDashboard.testOtherDeviceId,
          name: 'Primary Station',
          nickname: null,
          isPrimary: true,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: null,
          lastSyncAtUtc: null,
        },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('dashboard-source-heading')).toHaveLength(2);
    });

    const headings = screen.getAllByTestId('dashboard-source-heading');
    expect(headings[0]).toHaveTextContent('Primary Station');
    expect(headings[0]).toHaveClass('text-foreground');
    expect(headings[1]).toHaveTextContent('Secondary Station');
    expect(headings[1]).toHaveClass('text-foreground');
    expect(screen.getAllByTestId('dashboard-source-group')).toHaveLength(2);
    expect(screen.getAllByTestId('dashboard-source-group')[0]).toHaveAttribute('open');
    expect(screen.getAllByTestId('dashboard-source-group')[0]).toHaveClass('border', 'border-border', 'bg-surface-layer-3');
    expect(screen.getAllByTestId('dashboard-source-primary-label')).toHaveLength(1);
  });

  it('lets users collapse a default station source group without hiding the station heading', async () => {
    renderPage();

    const group = await screen.findByTestId('dashboard-source-group');
    const summary = within(group).getByTestId('dashboard-source-summary');
    const content = within(group).getByTestId('dashboard-tile-grid');

    expect(group).toHaveAttribute('open');
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(summary).toHaveAttribute('aria-controls', content.id);
    fireEvent.click(summary);

    await waitFor(() => {
      expect(group).not.toHaveAttribute('open');
    });
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(within(group).getByTestId('dashboard-source-heading')).toBeInTheDocument();
  });

  it('keeps dashboard station source headings visible in dark mode', async () => {
    document.documentElement.classList.add('dark');

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('dashboard-source-heading')).toHaveLength(1);
    });
    expect(screen.getByTestId('dashboard-source-heading')).toHaveClass('text-foreground');
  });

  it('shows connected station names and runtime mock station for any login', async () => {
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [
        {
          macAddress: mockDashboard.testDeviceId,
          name: mockDashboard.testDeviceName,
          nickname: null,
          isPrimary: true,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: null,
          lastSyncAtUtc: null,
        },
        {
          macAddress: 'mock-runtime-1',
          name: 'Mock Runtime Station',
          nickname: 'Mock Station',
          isPrimary: false,
          displayOnDashboard: true,
          selectedMetricKeys: ['outdoor_temp'],
          latitude: null, longitude: null, elevationMeters: null,
          address: null, location: 'Runtime preview',
          lastSyncAtUtc: null,
          isMock: true,
        },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-weather-hub-state')).toHaveTextContent(
        `Connected (UTC): ${mockDashboard.testDeviceName}, Mock Station`,
      );
    });
  });

  it('renders every dashboard tile wrapper at the same size regardless of saved layout dimensions', async () => {
    renderPage();

    await screen.findByTestId('dashboard-rainfall-summary-tile');

    const wrappers = screen.getAllByTestId('dashboard-layout-tile-wrapper');
    expect(wrappers).toHaveLength(3);
    for (const wrapper of wrappers) {
      expect(wrapper).toHaveClass('h-96');
    }
    expect(screen.getByTestId('dashboard-temperature-tile')).toHaveClass('h-full');
    expect(screen.getByTestId('dashboard-humidity-tile')).toHaveClass('h-full');
    expect(screen.getByTestId('dashboard-rainfall-summary-tile')).toHaveClass('h-full');
  });

  it('renders dashboard category tiles in saved settings order', async () => {
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [{
        macAddress: mockDashboard.testDeviceId,
        name: mockDashboard.testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: ['wind_speed', 'outdoor_temp', 'rainfall_day', 'outdoor_humidity'],
        latitude: null, longitude: null, elevationMeters: null,
        address: null, location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    await screen.findByTestId('dashboard-wind-tile');

    const wrappers = screen.getAllByTestId('dashboard-layout-tile-wrapper');
    expect(within(wrappers[0]).getByTestId('dashboard-wind-tile')).toBeInTheDocument();
    expect(within(wrappers[1]).getByTestId('dashboard-temperature-tile')).toBeInTheDocument();
    expect(within(wrappers[2]).getByTestId('dashboard-rainfall-summary-tile')).toBeInTheDocument();
    expect(within(wrappers[3]).getByTestId('dashboard-humidity-tile')).toBeInTheDocument();
  });

  it('renders dashboard fields in saved settings order within a category', async () => {
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [{
        macAddress: mockDashboard.testDeviceId,
        name: mockDashboard.testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: ['wind_gust', 'wind_speed', 'wind_dir'],
        latitude: null, longitude: null, elevationMeters: null,
        address: null, location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    await screen.findByTestId('dashboard-wind-tile');

    const windValues = screen.getAllByTestId('dashboard-wind-value');
    expect(windValues[0]).toHaveTextContent('9.0 mph');
    expect(windValues[1]).toHaveTextContent('5.0 mph');
    expect(windValues[2]).toHaveTextContent('S 180°');
  });

  it('renders generated station tiles without showing customization controls', async () => {
    mockDashboard.layout = {
      ...mockDashboard.layout,
      tiles: [
        { i: 'rainfall', x: 0, y: 0, w: 4, h: 4, type: 'rainfall' },
      ],
    };
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [{
        macAddress: mockDashboard.testDeviceId,
        name: mockDashboard.testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: ['outdoor_temp', 'outdoor_humidity', 'rainfall_day'],
        latitude: null, longitude: null, elevationMeters: null,
        address: null, location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-temperature-tile')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-humidity-tile')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-rainfall-summary-tile')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dashboard-edit-layout-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-metric-selector-button')).not.toBeInTheDocument();
  });

  it('hides the rainfall tile when the primary station has no rainfall metrics selected', async () => {
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [{
        macAddress: mockDashboard.testDeviceId,
        name: mockDashboard.testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: ['outdoor_temp', 'outdoor_humidity'],
        latitude: null, longitude: null, elevationMeters: null,
        address: null, location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    await screen.findByTestId('dashboard-temperature-tile');
    expect(screen.queryByTestId('dashboard-rainfall-summary-tile')).not.toBeInTheDocument();
  });

  it('shows a setup prompt when no dashboard stations are enabled', async () => {
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    const prompt = await screen.findByTestId('dashboard-setup-prompt');
    expect(prompt).toHaveTextContent('No dashboard stations are enabled');
    expect(screen.getByTestId('dashboard-setup-link')).toHaveAttribute('href', '/settings');
    expect(screen.queryByTestId('dashboard-alert')).not.toBeInTheDocument();
  });

  it('hides stale owned station tiles when Ambient credentials are not configured', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: false },
    });

    renderPage();

    const prompt = await screen.findByTestId('dashboard-setup-prompt');
    expect(prompt).toHaveTextContent('Save your Ambient Weather credentials');
    expect(screen.getByTestId('dashboard-weather-hub-state')).toHaveTextContent('No stations configured');
    expect(screen.queryByTestId('dashboard-source-group')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-temperature-tile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-rainfall-summary-tile')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage();
    await screen.findByTestId('dashboard-rainfall-summary-tile');
    await waitFor(() => {
      expect(settingsApi.getPreferences).toHaveBeenCalledWith('mock-token');
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders active weather alert banner', async () => {
    vi.mocked(alertsApi.getActiveAlerts).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'alert-1',
          event: 'Generated event',
          headline: 'Generated headline',
          description: null,
          severity: 'Severe',
          urgency: 'Immediate',
          certainty: 'Likely',
          effectiveUtc: null,
          expiresUtc: null,
          areaDesc: null,
        },
        {
          id: 'alert-2',
          event: 'Generated follow-up event',
          headline: 'Generated follow-up headline',
          description: null,
          severity: 'Moderate',
          urgency: 'Expected',
          certainty: 'Likely',
          effectiveUtc: null,
          expiresUtc: null,
          areaDesc: null,
        },
      ],
    });

    renderPage();

    expect(await screen.findByTestId('dashboard-alerts-banner')).toHaveTextContent('Generated headline');
    expect(screen.getByTestId('dashboard-alerts-count')).toHaveTextContent('2 warnings');
  });

  it('requests alerts for a selected NWS area code', async () => {
    renderPage();

    fireEvent.change(screen.getByTestId('dashboard-alerts-area-mode'), { target: { value: 'manual' } });
    fireEvent.change(screen.getByTestId('dashboard-alerts-area-code'), { target: { value: 'tx' } });

    await waitFor(() => {
      expect(alertsApi.getActiveAlerts).toHaveBeenCalledWith(
        'mock-token',
        'TX',
        expect.any(AbortSignal),
      );
    });
  });

  it('renders enabled public sources in the default dashboard layout', async () => {
    const publicSourceId = crypto.randomUUID();
    const publicStationId = `public:${publicSourceId}`;
    const sourceName = 'Generated model source';
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({
      ok: true,
      data: [{
        id: publicSourceId,
        provider: 'OpenMeteo',
        sourceId: `generated-${publicSourceId.slice(0, 8)}`,
        displayLabel: sourceName,
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        timezone: 'UTC',
        isEnabled: true,
        createdAtUtc: '2026-06-05T12:00:00Z',
        updatedAtUtc: '2026-06-05T12:00:00Z',
      }],
    });
    vi.mocked(publicSourcesApi.getPublicSourceCurrent).mockResolvedValue({
      ok: true,
      data: {
        ...mockDashboard.currentReading,
        deviceId: publicStationId,
        deviceName: `Open-Meteo - ${sourceName}`,
        tempF: 63.8,
        source: 'public',
      },
    });

    renderPage();

    await waitFor(() => {
      expect(publicSourcesApi.getPublicSourceCurrent).toHaveBeenCalledWith(
        publicSourceId,
        'mock-token',
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findAllByText(`Open-Meteo - ${sourceName}`)).not.toHaveLength(0);
    expect(screen.getAllByTestId('dashboard-source-heading').map((heading) => heading.textContent))
      .toContain(`Open-Meteo - ${sourceName}`);
    expect(screen.getAllByTestId('dashboard-temperature-value').some((value) => value.textContent?.includes('63.8')))
      .toBe(true);
  });

  it('does not treat a public-only default dashboard source as primary or neighbor-comparable', async () => {
    const publicSourceId = crypto.randomUUID();
    const publicStationId = `public:${publicSourceId}`;
    const sourceName = 'Generated public-only model source';
    mockDashboard.layout = {
      ...mockDashboard.layout,
      tiles: [
        {
          i: `temperature-${publicStationId}`,
          x: 0,
          y: 0,
          w: 3,
          h: 5,
          type: 'temperature',
          deviceId: publicStationId,
        },
      ],
    };
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({
      ok: true,
      data: [{
        id: publicSourceId,
        provider: 'OpenMeteo',
        sourceId: `generated-${publicSourceId.slice(0, 8)}`,
        displayLabel: sourceName,
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        timezone: 'UTC',
        isEnabled: true,
        createdAtUtc: '2026-06-05T12:00:00Z',
        updatedAtUtc: '2026-06-05T12:00:00Z',
      }],
    });
    vi.mocked(publicSourcesApi.getPublicSourceCurrent).mockResolvedValue({
      ok: true,
      data: {
        ...mockDashboard.currentReading,
        deviceId: publicStationId,
        deviceName: `Open-Meteo - ${sourceName}`,
        tempF: 63.8,
        source: 'public',
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('dashboard-source-heading').map((heading) => heading.textContent))
        .toContain(`Open-Meteo - ${sourceName}`);
    });
    expect(screen.queryByTestId('dashboard-setup-prompt')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-source-primary-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-source-neighbors-button')).not.toBeInTheDocument();
    expect(neighborsApi.getNeighborComparisonStations).not.toHaveBeenCalled();
  });

  it('renders selected Weather.gov condition metrics in the default dashboard layout', async () => {
    mockDashboard.layout = {
      ...mockDashboard.layout,
      tiles: [
        {
          i: `conditions-${mockDashboard.testDeviceId}`,
          x: 0,
          y: 0,
          w: 3,
          h: 4,
          type: 'conditions',
          deviceId: mockDashboard.testDeviceId,
        },
      ],
    };
    vi.mocked(useSettingsDevices).mockReturnValue({
      data: [{
        macAddress: mockDashboard.testDeviceId,
        name: mockDashboard.testDeviceName,
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: ['nws_sky_conditions', 'nws_text_description'],
        latitude: null, longitude: null, elevationMeters: null,
        address: null, location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    const tile = await screen.findByTestId('dashboard-conditions-tile');
    expect(tile).toHaveTextContent('Conditions');
    expect(tile).toHaveTextContent('FEW @ 1,800ft');
    expect(tile).toHaveTextContent('Generated weather description.');
  });
});
