import { faker } from '@faker-js/faker';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockAuthProvider } from '../../lib/auth';
import { NeighborsConfigPanel } from './NeighborsConfigPanel';
import * as neighborsApi from '../../api/neighbors';
import type { UseSettingsDevicesResult } from '../../hooks/useSettingsDevices';

vi.mock('../../api/neighbors');
vi.mock('../../hooks/useSettingsDevices', () => ({
  useSettingsDevices: () => mockUseSettingsDevices(),
}));
const mockUseSettingsDevices = vi.fn<() => UseSettingsDevicesResult>();

const defaultConfig = {
  isEnabled: false,
  radiusMiles: 25,
  comparisonRadiusMiles: 25,
  maxAgeMinutes: 30,
  minStations: 3,
  enabledProviders: ['WeatherGov', 'OpenMeteo'] as string[],
  refreshIntervalMinutes: 15,
  pinnedStations: [],
};

const generatedStation = {
  provider: 'WeatherGov',
  sourceId: 'generated-source',
  name: 'Generated station',
  lat: faker.location.latitude({ min: 25, max: 49 }),
  lon: faker.location.longitude({ min: -124, max: -66 }),
  distanceMiles: 4.2,
  lastObservedAtUtc: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  freshnessMinutes: 10,
  tempF: 70,
  humidity: 50,
  dewPoint: null,
  feelsLike: null,
  baromRelIn: null,
  baromAbsIn: null,
  windSpeedMph: 6,
  windGustMph: null,
  windDir: null,
  hourlyRainIn: null,
  dailyRainIn: null,
  weeklyRainIn: null,
  monthlyRainIn: null,
  yearlyRainIn: null,
  solarRadiation: null,
  uv: null,
};

function renderPanel(
  options: boolean | {
    readonly isOpen?: boolean;
    readonly hasAmbientCredentials?: boolean;
  } = true,
) {
  const isOpen = typeof options === 'boolean' ? options : (options.isOpen ?? true);
  const hasAmbientCredentials = typeof options === 'boolean'
    ? true
    : (options.hasAmbientCredentials ?? true);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MockAuthProvider>
      <QueryClientProvider client={queryClient}>
        <NeighborsConfigPanel isOpen={isOpen} hasAmbientCredentials={hasAmbientCredentials} />
      </QueryClientProvider>
    </MockAuthProvider>,
  );
}

describe('NeighborsConfigPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseSettingsDevices.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() });
  });

  it('renders collapsed by default when no isOpen prop', () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <MockAuthProvider>
        <QueryClientProvider client={queryClient}>
          <NeighborsConfigPanel />
        </QueryClientProvider>
      </MockAuthProvider>,
    );

    expect(screen.queryByTestId('settings-neighbors-search-button')).not.toBeInTheDocument();
  });

  it('renders form fields when open', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });

    renderPanel();

    expect(await screen.findByTestId('settings-neighbors-search-button')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-discovery-location-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-radius-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-maxage-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-minstations-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-refresh-interval-input')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-weather-alerts-section')).not.toBeInTheDocument();
  });

  it('renders embedded mode open inside public source settings', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <MockAuthProvider>
        <QueryClientProvider client={queryClient}>
          <NeighborsConfigPanel embedded />
        </QueryClientProvider>
      </MockAuthProvider>,
    );

    expect(screen.getByTestId('settings-neighbors-embedded')).toHaveClass('bg-surface-layer-2');
    expect(await screen.findByTestId('settings-neighbors-search-button')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-neighbors-toggle-panel')).not.toBeInTheDocument();
  });

  it('shows provider checkboxes', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });

    renderPanel();

    expect(await screen.findByTestId('settings-neighbors-provider-WeatherGov')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-provider-OpenMeteo')).toBeInTheDocument();
    expect(screen.getByTestId('settings-neighbors-provider-AmbientOpen')).toBeInTheDocument();
  });

  it('search button saves config values before refreshing stations', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, discoveryLocationQuery: faker.location.zipCode() },
    });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });
    vi.mocked(neighborsApi.postNeighborsRefresh).mockResolvedValue({ ok: true, data: [] });

    renderPanel();

    const testZip = faker.location.zipCode();
    await screen.findByTestId('settings-neighbors-search-button');

    fireEvent.change(screen.getByTestId('settings-neighbors-discovery-location-input'), {
      target: { value: testZip },
    });
    fireEvent.click(screen.getByTestId('settings-neighbors-search-button'));

    await waitFor(() => {
      expect(neighborsApi.putNeighborsConfig).toHaveBeenCalledWith(
        expect.objectContaining({ discoveryLocationQuery: testZip }),
        expect.any(String),
      );
    });
    expect(neighborsApi.postNeighborsRefresh).toHaveBeenCalledOnce();
  });

  it('shows error message on search save failure', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, discoveryLocationQuery: faker.location.zipCode() },
    });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({
      ok: false,
      status: 500,
      error: '{"message":"Internal server error"}',
    });

    renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');
    fireEvent.click(screen.getByTestId('settings-neighbors-search-button'));

    expect(await screen.findByTestId('settings-neighbors-save-error')).toBeInTheDocument();
  });

  it('search button calls postNeighborsRefresh', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, discoveryLocationQuery: faker.location.zipCode() },
    });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });
    vi.mocked(neighborsApi.postNeighborsRefresh).mockResolvedValue({ ok: true, data: [] });

    renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');
    fireEvent.click(screen.getByTestId('settings-neighbors-search-button'));

    await waitFor(() => {
      expect(neighborsApi.postNeighborsRefresh).toHaveBeenCalledOnce();
    });
  });

  it('shows a single friendly rate-limit message when search is throttled', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, discoveryLocationQuery: faker.location.zipCode() },
    });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });
    vi.mocked(neighborsApi.postNeighborsRefresh).mockResolvedValue({
      ok: false,
      status: 429,
      error: '{"error":"rate_limit_exceeded","message":"Too many requests. Retry after a moment.","statusCode":429,"details":null}',
    });

    renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');
    fireEvent.click(screen.getByTestId('settings-neighbors-search-button'));

    expect(await screen.findByTestId('settings-neighbors-save-error')).toHaveTextContent(
      'Too many requests. Retry after a moment. Please wait a moment before trying again.',
    );
    expect(screen.queryByTestId('settings-neighbors-refresh-error')).not.toBeInTheDocument();
  });

  it('pins a refreshed station by saving pinnedStations', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });
    vi.mocked(neighborsApi.postNeighborsRefresh).mockResolvedValue({ ok: true, data: [generatedStation] });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        ...defaultConfig,
        pinnedStations: [
          {
            provider: generatedStation.provider,
            sourceId: generatedStation.sourceId,
            displayLabel: generatedStation.name,
          },
        ],
      },
    });

    renderPanel();

    fireEvent.change(await screen.findByTestId('settings-neighbors-discovery-location-input'), {
      target: { value: faker.location.zipCode() },
    });
    fireEvent.click(screen.getByTestId('settings-neighbors-search-button'));
    fireEvent.click(await screen.findByTestId('settings-neighbors-view-stations-button'));
    fireEvent.click(await screen.findByTestId('neighbors-station-pin-button'));

    await waitFor(() => {
      expect(neighborsApi.putNeighborsConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          pinnedStations: [
            {
              provider: generatedStation.provider,
              sourceId: generatedStation.sourceId,
              displayLabel: generatedStation.name,
            },
          ],
        }),
        expect.any(String),
      );
    });
  });

  it('shows load error when config fetch fails', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: false,
      status: 500,
      error: 'Server error',
    });

    renderPanel();

    expect(await screen.findByTestId('settings-neighbors-load-error')).toBeInTheDocument();
  });

  it('has no accessibility violations when open', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({ ok: true, data: defaultConfig });

    const { container } = renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows needs-location prompt and disables search button with no location source', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, isEnabled: true, discoveryLocationQuery: null },
    });
    mockUseSettingsDevices.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() });

    renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');

    expect(screen.getByTestId('settings-neighbors-needs-location')).toHaveTextContent('Enter a City, State; ZIP code; County, State; or airport code');
    expect(screen.getByTestId('settings-neighbors-search-button')).toBeDisabled();
  });

  it('enables search button when discoveryLocationQuery is set', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, isEnabled: true, discoveryLocationQuery: faker.location.zipCode() },
    });

    renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');

    expect(screen.getByTestId('settings-neighbors-search-button')).toBeEnabled();
    expect(screen.queryByTestId('settings-neighbors-needs-location')).not.toBeInTheDocument();
  });

  it('enables search button when an owned device has coordinates', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, isEnabled: true, discoveryLocationQuery: null },
    });
    mockUseSettingsDevices.mockReturnValue({
      data: [{
        macAddress: faker.string.hexadecimal({ length: 12, casing: 'upper', prefix: '' }),
        name: 'Generated station',
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    await screen.findByTestId('settings-neighbors-search-button');

    expect(screen.getByTestId('settings-neighbors-search-button')).toBeEnabled();
    expect(screen.queryByTestId('settings-neighbors-needs-location')).not.toBeInTheDocument();
  });

  it('requires discovery location when Ambient credentials are missing even if cached station coordinates exist', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, isEnabled: true, discoveryLocationQuery: null },
    });
    mockUseSettingsDevices.mockReturnValue({
      data: [{
        macAddress: faker.string.hexadecimal({ length: 12, casing: 'upper', prefix: '' }),
        name: 'Cached station',
        nickname: null,
        isPrimary: true,
        displayOnDashboard: true,
        selectedMetricKeys: null,
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        elevationMeters: null,
        address: null,
        location: null,
        lastSyncAtUtc: null,
      }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel({ hasAmbientCredentials: false });

    await screen.findByTestId('settings-neighbors-search-button');

    expect(screen.getByTestId('settings-neighbors-needs-location')).toHaveTextContent('Enter a City, State; ZIP code; County, State; or airport code');
    expect(screen.getByTestId('settings-neighbors-search-button')).toBeDisabled();
  });

  it('does not show view-stations button when refresh returns zero stations', async () => {
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, discoveryLocationQuery: faker.location.zipCode() },
    });
    vi.mocked(neighborsApi.postNeighborsRefresh).mockResolvedValue({ ok: true, data: [] });

    renderPanel();

    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({
      ok: true,
      data: { ...defaultConfig, discoveryLocationQuery: faker.location.zipCode() },
    });

    await screen.findByTestId('settings-neighbors-search-button');
    fireEvent.click(screen.getByTestId('settings-neighbors-search-button'));

    await waitFor(() => {
      expect(neighborsApi.postNeighborsRefresh).toHaveBeenCalledOnce();
    });
    expect(screen.queryByTestId('settings-neighbors-view-stations-button')).not.toBeInTheDocument();
  });
});
