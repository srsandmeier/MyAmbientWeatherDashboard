import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { faker } from '@faker-js/faker';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockAuthProvider } from '../../lib/auth';
import { DevicesCard } from './DevicesCard';
import * as settingsApi from '../../api/settings';
import * as dashboardApi from '../../api/dashboard';
import * as publicSourcesApi from '../../api/publicSources';
import * as neighborsApi from '../../api/neighbors';
import {
  testDeviceId,
  testDeviceName,
  testDeviceRowId,
  testOtherDeviceId,
  testOtherDeviceRowId,
} from '../../test/weatherTestData';
import type { SettingsDeviceDto } from '../../types/settings';

vi.mock('../../api/settings');
vi.mock('../../api/dashboard');
vi.mock('../../api/publicSources');
vi.mock('../../api/neighbors');

// Faker-generated location values — randomised each test run, never hardcoded.
const mockDeviceLat = faker.location.latitude({ min: 25, max: 49 });
const mockDeviceLon = faker.location.longitude({ min: -124, max: -66 });
const mockDeviceElevation = faker.number.int({ min: 100, max: 4000 });
const mockDeviceAddress = `${faker.location.buildingNumber()} ${faker.location.street()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`;
const mockDeviceLocation = faker.location.city();

const mockDevice2Lat = faker.location.latitude({ min: 25, max: 49 });
const mockDevice2Lon = faker.location.longitude({ min: -124, max: -66 });
const mockDevice2Elevation = faker.number.int({ min: 100, max: 4000 });
const mockDevice2Address = `${faker.location.buildingNumber()} ${faker.location.street()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`;
const mockDevice2Location = faker.location.city();

/** A device with a test.1 nickname triggers 1 runtime mock station. */
const mockDeviceTest1: SettingsDeviceDto = {
  macAddress: testDeviceId,
  name: testDeviceName,
  nickname: 'test.1',
  isPrimary: true,
  displayOnDashboard: true,
  selectedMetricKeys: ['outdoor_temp'],
  latitude: mockDeviceLat,
  longitude: mockDeviceLon,
  elevationMeters: mockDeviceElevation,
  address: mockDeviceAddress,
  location: mockDeviceLocation,
  lastSyncAtUtc: '2026-05-30T00:00:00Z',
};

/** A device with a test.2 nickname triggers 2 runtime mock stations. */
const mockDeviceTest2: SettingsDeviceDto = {
  macAddress: testDeviceId,
  name: testDeviceName,
  nickname: 'test.2',
  isPrimary: true,
  displayOnDashboard: true,
  selectedMetricKeys: ['outdoor_temp'],
  latitude: mockDeviceLat,
  longitude: mockDeviceLon,
  elevationMeters: mockDeviceElevation,
  address: mockDeviceAddress,
  location: mockDeviceLocation,
  lastSyncAtUtc: '2026-05-30T00:00:00Z',
};

const mockDevice: SettingsDeviceDto = {
  macAddress: testDeviceId,
  name: testDeviceName,
  nickname: 'Back',
  isPrimary: true,
  displayOnDashboard: true,
  selectedMetricKeys: ['outdoor_temp'],
  latitude: mockDeviceLat,
  longitude: mockDeviceLon,
  elevationMeters: mockDeviceElevation,
  address: mockDeviceAddress,
  location: mockDeviceLocation,
  lastSyncAtUtc: '2026-05-30T00:00:00Z',
};

const mockDevice2: SettingsDeviceDto = {
  macAddress: testOtherDeviceId,
  name: 'Rooftop Station',
  nickname: null,
  isPrimary: false,
  displayOnDashboard: true,
  selectedMetricKeys: ['outdoor_temp', 'wind_speed'],
  latitude: mockDevice2Lat,
  longitude: mockDevice2Lon,
  elevationMeters: mockDevice2Elevation,
  address: mockDevice2Address,
  location: mockDevice2Location,
  lastSyncAtUtc: '2026-06-01T00:00:00Z',
};

function renderCard(
  hasCredentials = true,
  isCredentialStatusLoading = false,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MockAuthProvider>
      <QueryClientProvider client={queryClient}>
        <DevicesCard
          hasCredentials={hasCredentials}
          isCredentialStatusLoading={isCredentialStatusLoading}
        />
      </QueryClientProvider>
    </MockAuthProvider>,
  );
}

/** Expands a device row only when it is currently collapsed. */
async function expandRow(macId: string) {
  const toggle = await screen.findByTestId(`settings-device-row-toggle-${macId}`);
  if (screen.queryByTestId(`settings-device-nickname-input-${macId}`) === null) {
    fireEvent.click(toggle);
  }
}

async function expandPublicNearbySources() {
  const toggle = await screen.findByTestId('settings-public-nearby-toggle');
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(toggle);
  }
}

const mockLayoutDto = {
  id: 'layout-1',
  name: 'Default',
  layoutMode: 'default' as const,
  tiles: [],
  customItems: [],
  updatedAtUtc: '2026-06-01T00:00:00Z',
};

describe('DevicesCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.mocked(dashboardApi.getDashboardLayout).mockResolvedValue({ ok: true, data: mockLayoutDto });
    vi.mocked(dashboardApi.putDashboardLayout).mockResolvedValue({ ok: true, data: { ...mockLayoutDto, updatedAtUtc: '2026-06-02T00:00:00Z' } });
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(publicSourcesApi.createPublicSource).mockResolvedValue({
      ok: true,
      data: {
        id: faker.string.uuid(),
        provider: 'WeatherGov',
        sourceId: faker.string.alphanumeric(8),
        displayLabel: faker.location.city(),
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        timezone: null,
        isEnabled: true,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
      },
    });
    vi.mocked(publicSourcesApi.updatePublicSource).mockResolvedValue({
      ok: true,
      data: {
        id: faker.string.uuid(),
        provider: 'WeatherGov',
        sourceId: faker.string.alphanumeric(8),
        displayLabel: faker.location.city(),
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        timezone: null,
        isEnabled: true,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
      },
    });
    vi.mocked(publicSourcesApi.deletePublicSource).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: false,
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
        isEnabled: false,
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      },
    });
    vi.mocked(publicSourcesApi.discoverPublicSources).mockResolvedValue({ ok: true, data: [] });
  });

  it('shows "save credentials" prompt when no credentials', () => {
    renderCard(false);
    expect(screen.getByTestId('settings-devices-no-credentials')).toBeInTheDocument();
  });

  it('holds station content while credential status loads', () => {
    renderCard(false, true);

    expect(screen.getByTestId('settings-devices-credential-status-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-devices-no-credentials')).not.toBeInTheDocument();
  });

  it('shows empty state when no devices synced', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [] });

    renderCard();

    expect(await screen.findByTestId('settings-devices-empty')).toBeInTheDocument();
  });

  it('renders primary device row expanded by default', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    expect(await screen.findByTestId(`settings-device-row-${testDeviceRowId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toBeInTheDocument();
  });

  it('does not auto expand the primary device row after the user collapses it', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    const { unmount } = renderCard();

    const rowToggle = await screen.findByTestId(`settings-device-row-toggle-${testDeviceRowId}`);
    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toBeInTheDocument();

    fireEvent.click(rowToggle);
    expect(screen.queryByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).not.toBeInTheDocument();

    unmount();
    renderCard();

    await screen.findByTestId(`settings-device-row-${testDeviceRowId}`);
    expect(screen.queryByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).not.toBeInTheDocument();
  });

  it('keeps non-primary device rows collapsed by default', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice, mockDevice2] });

    renderCard();

    expect(await screen.findByTestId(`settings-device-row-${testOtherDeviceRowId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`settings-device-nickname-input-${testOtherDeviceRowId}`)).not.toBeInTheDocument();
  });

  it('keeps station row header visible in light and dark themes', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    const { unmount } = renderCard();

    expect(await screen.findByTestId(`settings-device-title-${testDeviceRowId}`)).toHaveClass('text-card-foreground');
    expect(screen.getByTestId(`settings-device-row-${testDeviceRowId}`)).toHaveClass('bg-surface-layer-3', 'text-card-foreground');

    unmount();
    document.documentElement.classList.add('dark');
    renderCard();

    expect(await screen.findByTestId(`settings-device-title-${testDeviceRowId}`)).toHaveClass('text-card-foreground');
    expect(screen.getByTestId(`settings-device-row-${testDeviceRowId}`)).toHaveClass('bg-surface-layer-3', 'text-card-foreground');
  });

  it('expands a device row to show the form', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    await expandRow(testDeviceRowId);

    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toBeInTheDocument();
  });

  it('groups metric checkboxes by weather category when row expanded', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    await screen.findByTestId('settings-devices-list');
    await expandRow(testDeviceRowId);

    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Atmosphere')).toBeInTheDocument();
    expect(screen.getByText('Wind')).toBeInTheDocument();
    expect(screen.getByText('Sun & UV')).toBeInTheDocument();
    expect(screen.getByText('Rainfall')).toBeInTheDocument();

    // Temperature group — all six keys
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-outdoor_temp`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-feels_like`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-dew_point`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-indoor_temp`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-indoor_feels_like`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-indoor_dew_point`)).toBeInTheDocument();

    // Atmosphere group — humidity plus pressure
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-outdoor_humidity`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-indoor_humidity`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-pressure`)).toBeInTheDocument();

    // Wind group — all four keys
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_dir`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_speed`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_gust`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-max_daily_gust`)).toBeInTheDocument();

    // Spot-check other groups
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-solar_radiation`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-rainfall_year`)).toBeInTheDocument();
  });

  it('keeps source settings visible while switching between default and custom layout', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    expect(await screen.findByTestId('settings-layout-mode-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('settings-layout-mode-default')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('settings-devices-list')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-layout-mode-custom'));
    // Wait for the async saveLayout mutation to settle so no state update leaks outside act.
    await screen.findByTestId('settings-layout-mode-save-message');

    expect(screen.getByTestId('settings-layout-mode-custom')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('settings-custom-layout-builder')).toBeInTheDocument();
    expect(screen.getByTestId('settings-devices-list')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    expect(screen.getByTestId('settings-custom-layout-count')).toHaveTextContent('1 / 12 items');

    fireEvent.click(screen.getByTestId('settings-layout-mode-default'));
    // switchLayoutMode calls setLayoutSaveMessage(null) synchronously then re-sets it
    // once the second save resolves — wait for that second 'Saved.' before asserting.
    await screen.findByTestId('settings-layout-mode-save-message');

    expect(screen.getByTestId('settings-layout-mode-default')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('settings-devices-list')).toBeInTheDocument();
  });

  it('adds a public source from the settings panel', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    await expandPublicNearbySources();
    await screen.findByTestId('settings-public-sources-panel');
    const label = faker.location.city();
    const sourceId = faker.string.alphanumeric(8);
    const latitude = faker.location.latitude({ min: 25, max: 49 }).toString();
    const longitude = faker.location.longitude({ min: -124, max: -66 }).toString();

    fireEvent.change(screen.getByTestId('settings-public-source-label'), { target: { value: label } });
    fireEvent.change(screen.getByTestId('settings-public-source-id'), { target: { value: sourceId } });
    fireEvent.change(screen.getByTestId('settings-public-source-latitude'), { target: { value: latitude } });
    fireEvent.change(screen.getByTestId('settings-public-source-longitude'), { target: { value: longitude } });
    fireEvent.click(screen.getByTestId('settings-public-source-add'));

    await waitFor(() => {
      expect(publicSourcesApi.createPublicSource).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'WeatherGov',
          displayLabel: label,
          sourceId,
          latitude: Number(latitude),
          longitude: Number(longitude),
          isEnabled: true,
        }),
        'mock-token',
      );
    });
  });

  it('offers enabled public sources in the custom metric picker', async () => {
    const publicSource = {
      id: faker.string.uuid(),
      provider: 'OpenMeteo' as const,
      sourceId: faker.string.alphanumeric(8),
      displayLabel: faker.location.city(),
      latitude: faker.location.latitude({ min: 25, max: 49 }),
      longitude: faker.location.longitude({ min: -124, max: -66 }),
      timezone: null,
      isEnabled: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    };
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({ ok: true, data: [publicSource] });

    renderCard();

    await screen.findByTestId('settings-layout-mode-tabs');
    fireEvent.click(screen.getByTestId('settings-layout-mode-custom'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    const stationSelect = await screen.findByTestId('settings-custom-layout-metric-picker-station');
    expect(stationSelect).toHaveTextContent(`Open-Meteo - ${publicSource.displayLabel}`);
  });

  it('renders metric categories with dividers and fields as pills', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    await expandRow(testDeviceRowId);

    expect(screen.getByTestId(`settings-device-metric-category-${testDeviceRowId}-temperature`))
      .toHaveClass('border', 'border-border');
    expect(within(screen.getByTestId(`settings-device-metric-category-${testDeviceRowId}-temperature`)).getByText('Temperature'))
      .toHaveClass('text-sm', 'font-semibold', 'text-card-foreground');
    expect(screen.getByTestId(`settings-device-metric-row-${testDeviceRowId}-outdoor_temp`))
      .toHaveClass('rounded-full', 'border', 'bg-background');
    expect(screen.getByTestId(`settings-device-metric-move-up-${testDeviceRowId}-outdoor_temp`))
      .toHaveClass('rounded-full');
    expect(screen.getByTestId(`settings-device-metric-move-down-${testDeviceRowId}-outdoor_temp`))
      .toHaveClass('rounded-full');
    expect(screen.getByTestId(`settings-device-metric-category-move-up-${testDeviceRowId}-temperature`))
      .toHaveAccessibleName('Temperature category is already first');
    expect(screen.getByTestId(`settings-device-metric-move-up-${testDeviceRowId}-outdoor_temp`))
      .toHaveAccessibleName('Outdoor Temp field is already first in Temperature');
  });

  it('moves metric categories and saves selected keys in category order', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await expandRow(testDeviceRowId);

    const labels = ['Temperature', 'Atmosphere', 'Wind', 'Sun & UV', 'Rainfall'] as const;
    const categoryLabels = () => screen
      .getAllByTestId(new RegExp(`^settings-device-metric-category-${testDeviceRowId}-`))
      .map((category) => labels.find((label) => within(category).queryByText(label)) ?? '');

    expect(categoryLabels()).toEqual(['Temperature', 'Atmosphere', 'Wind', 'Sun & UV', 'Rainfall']);

    fireEvent.click(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_speed`));
    fireEvent.click(screen.getByTestId(`settings-device-metric-category-move-up-${testDeviceRowId}-wind`));
    fireEvent.click(screen.getByTestId(`settings-device-metric-category-move-up-${testDeviceRowId}-wind`));

    expect(categoryLabels()).toEqual(['Wind', 'Temperature', 'Atmosphere', 'Sun & UV', 'Rainfall']);

    fireEvent.click(screen.getByTestId(`settings-device-save-button-${testDeviceRowId}`));

    await waitFor(() => {
      expect(settingsApi.updateDevice).toHaveBeenCalledWith(
        testDeviceId,
        expect.objectContaining({ selectedMetricKeys: ['wind_speed', 'outdoor_temp'] }),
        'mock-token',
      );
    });
  });

  it('moves fields within a metric category and saves selected keys in field order', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await expandRow(testDeviceRowId);

    const temperatureLabels = [
      'Outdoor Temp', 'Outdoor Feels Like', 'Outdoor Dew Point',
      'Today Outdoor High', 'Today Outdoor Low',
      'Indoor Temp', 'Indoor Feels Like', 'Indoor Dew Point',
      'Today Indoor High', 'Today Indoor Low',
    ] as const;
    const temperatureFieldLabels = () => within(screen.getByTestId(`settings-device-metric-category-${testDeviceRowId}-temperature`))
      .getAllByTestId(new RegExp(`^settings-device-metric-row-${testDeviceRowId}-`))
      .map((row) => temperatureLabels.find((label) => within(row).queryByText(label)) ?? '');

    expect(temperatureFieldLabels()).toEqual([
      'Outdoor Temp',
      'Outdoor Feels Like',
      'Outdoor Dew Point',
      'Today Outdoor High',
      'Today Outdoor Low',
      'Indoor Temp',
      'Indoor Feels Like',
      'Indoor Dew Point',
      'Today Indoor High',
      'Today Indoor Low',
    ]);

    fireEvent.click(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-feels_like`));
    fireEvent.click(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-dew_point`));
    fireEvent.click(screen.getByTestId(`settings-device-metric-move-up-${testDeviceRowId}-dew_point`));
    fireEvent.click(screen.getByTestId(`settings-device-metric-move-up-${testDeviceRowId}-dew_point`));

    expect(temperatureFieldLabels()).toEqual([
      'Outdoor Dew Point',
      'Outdoor Temp',
      'Outdoor Feels Like',
      'Today Outdoor High',
      'Today Outdoor Low',
      'Indoor Temp',
      'Indoor Feels Like',
      'Indoor Dew Point',
      'Today Indoor High',
      'Today Indoor Low',
    ]);

    fireEvent.click(screen.getByTestId(`settings-device-save-button-${testDeviceRowId}`));

    await waitFor(() => {
      expect(settingsApi.updateDevice).toHaveBeenCalledWith(
        testDeviceId,
        expect.objectContaining({ selectedMetricKeys: ['dew_point', 'outdoor_temp', 'feels_like'] }),
        'mock-token',
      );
    });
  });

  it('renders station location info when row expanded', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    await expandRow(testDeviceRowId);

    expect(screen.getByTestId('settings-device-station-info')).toBeInTheDocument();
    expect(screen.getByText(mockDeviceLocation)).toBeInTheDocument();
    expect(screen.getByText(mockDeviceAddress)).toBeInTheDocument();
    expect(screen.getByText(`${mockDeviceLat.toFixed(4)}°N, ${Math.abs(mockDeviceLon).toFixed(4)}°W`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${String(Math.round(mockDeviceElevation))}.*m`))).toBeInTheDocument();
  });

  it('calls syncDevices when sync button is clicked', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(settingsApi.syncDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    const syncBtn = await screen.findByTestId('settings-devices-sync-button');
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(settingsApi.syncDevices).toHaveBeenCalledWith('mock-token');
    });
  });

  it('calls updateDevice with new nickname and shows Saved feedback', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await expandRow(testDeviceRowId);

    fireEvent.change(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`), {
      target: { value: 'Rooftop' },
    });
    fireEvent.click(screen.getByTestId(`settings-device-save-button-${testDeviceRowId}`));

    await waitFor(() => {
      expect(settingsApi.updateDevice).toHaveBeenCalledWith(
        testDeviceId,
        expect.objectContaining({ nickname: 'Rooftop' }),
        'mock-token',
      );
    });

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('resets unsaved metric and nickname edits without leaving the metrics form', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    await expandRow(testDeviceRowId);

    fireEvent.change(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`), {
      target: { value: 'Unsaved nickname' },
    });
    fireEvent.click(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-outdoor_temp`));
    fireEvent.click(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_speed`));

    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toHaveValue('Unsaved nickname');
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-outdoor_temp`)).not.toBeChecked();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_speed`)).toBeChecked();

    fireEvent.click(screen.getByTestId(`settings-device-reset-button-${testDeviceRowId}`));

    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toHaveValue('Back');
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-outdoor_temp`)).toBeChecked();
    expect(screen.getByTestId(`settings-device-metric-${testDeviceRowId}-wind_speed`)).not.toBeChecked();
    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toBeInTheDocument();
  });

  it('primary station radio is visible in the header row without expanding', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    // Radio is in the collapsed header — no expand needed
    await screen.findByTestId(`settings-device-primary-radio-${testDeviceRowId}`);
    expect(screen.getByTestId(`settings-device-primary-radio-${testDeviceRowId}`)).toBeInTheDocument();
  });

  it('calls updateDevice when visibility toggle is changed', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await screen.findByTestId(`settings-device-visibility-toggle-${testDeviceRowId}`);
    fireEvent.click(screen.getByTestId(`settings-device-visibility-toggle-${testDeviceRowId}`));

    await waitFor(() => {
      expect(settingsApi.updateDevice).toHaveBeenCalledWith(
        testDeviceId,
        expect.objectContaining({ displayOnDashboard: false }),
        'mock-token',
      );
    });
    expect(await screen.findByTestId(`settings-device-autosave-status-${testDeviceRowId}`)).toHaveTextContent('Saved.');
  });

  it('disables neighbor comparison when the station is not shown on the dashboard', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({
      ok: true,
      data: [{ ...mockDevice, displayOnDashboard: false, isPrimary: false }],
    });
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: true,
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      },
    });

    renderCard();

    const comparisonToggle = await screen.findByTestId(`settings-device-neighbor-comparison-toggle-${testDeviceRowId}`);
    expect(comparisonToggle).toBeDisabled();
    expect(comparisonToggle).not.toBeChecked();
  });

  it('saves neighbor comparison independently for each owned station', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice, mockDevice2] });
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: true,
        enabledStationMacAddresses: [testOtherDeviceId],
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      },
    });

    renderCard();

    const firstToggle = await screen.findByTestId(`settings-device-neighbor-comparison-toggle-${testDeviceRowId}`);
    const secondToggle = screen.getByTestId(`settings-device-neighbor-comparison-toggle-${testOtherDeviceRowId}`);

    expect(firstToggle).not.toBeChecked();
    expect(secondToggle).toBeChecked();

    fireEvent.click(firstToggle);

    await waitFor(() => {
      expect(neighborsApi.putNeighborsConfig).toHaveBeenCalled();
    });
    const body = vi.mocked(neighborsApi.putNeighborsConfig).mock.calls.at(-1)?.[0];
    expect(body?.isEnabled).toBe(true);
    expect(body?.enabledStationMacAddresses).toEqual(expect.arrayContaining([testDeviceId, testOtherDeviceId]));
  });

  it('autosaves weather alerts location when the field loses focus', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    renderCard();

    const alertLocation = await screen.findByTestId('settings-weather-alerts-location-input');
    fireEvent.change(alertLocation, { target: { value: 'Austin, TX' } });
    fireEvent.blur(alertLocation);

    await waitFor(() => {
      expect(neighborsApi.putNeighborsConfig).toHaveBeenCalledWith(
        expect.objectContaining({ municipality: 'Austin, TX' }),
        'mock-token',
      );
    });
  });

  it('optimistically saves the primary station flag for real stations', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice, mockDevice2] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await screen.findByTestId(`settings-device-primary-radio-${testOtherDeviceRowId}`);
    fireEvent.click(screen.getByTestId(`settings-device-primary-radio-${testOtherDeviceRowId}`));

    await waitFor(() => {
      expect(screen.getByTestId(`settings-device-primary-radio-${testOtherDeviceRowId}`)).toBeChecked();
    });
    expect(screen.getByTestId(`settings-device-primary-radio-${testDeviceRowId}`)).not.toBeChecked();

    await waitFor(() => {
      expect(settingsApi.updateDevice).toHaveBeenCalledWith(
        testOtherDeviceId,
        expect.objectContaining({ isPrimary: true }),
        'mock-token',
      );
    });
    expect(await screen.findByTestId(`settings-device-autosave-status-${testOtherDeviceRowId}`)).toHaveTextContent('Saved.');
  });

  it('renders two device rows for two stations without mock when no test.N nickname', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice, mockDevice2] });

    renderCard();

    await screen.findByTestId(`settings-device-row-${testDeviceRowId}`);
    expect(screen.getByTestId(`settings-device-row-${testOtherDeviceRowId}`)).toBeInTheDocument();
    expect(screen.queryByTestId('settings-device-row-mockruntime1')).not.toBeInTheDocument();
  });

  it('adds 1 mock station when a device nickname is test.1', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDeviceTest1] });

    renderCard();

    await screen.findByTestId(`settings-device-row-${testDeviceRowId}`);
    expect(screen.getByTestId('settings-device-row-mockruntime1')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-device-row-mockruntime2')).not.toBeInTheDocument();
  });

  it('adds 2 mock stations when a device nickname is test.2', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDeviceTest2] });

    renderCard();

    await screen.findByTestId(`settings-device-row-${testDeviceRowId}`);
    expect(screen.getByTestId('settings-device-row-mockruntime1')).toBeInTheDocument();
    expect(screen.getByTestId('settings-device-row-mockruntime2')).toBeInTheDocument();
  });

  it('adds an editable runtime mock station when device nickname is test.1', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDeviceTest1] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await expandRow('mockruntime1');

    expect(screen.getByText('Mock Station')).toBeInTheDocument();
    expect(screen.getByTestId('settings-device-runtime-mock-note-mockruntime1')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('settings-device-nickname-input-mockruntime1'), {
      target: { value: 'Mock preview station' },
    });
    fireEvent.click(screen.getByTestId('settings-device-metric-mockruntime1-outdoor_temp'));
    fireEvent.click(screen.getByTestId('settings-device-save-button-mockruntime1'));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(settingsApi.updateDevice).not.toHaveBeenCalled();
  });

  it('updates mock station primary locally and clears it when the real station is promoted', async () => {
    // Device with test.1 nickname so a mock station is injected.
    const testDevice: SettingsDeviceDto = { ...mockDevice2, nickname: 'test.1' };
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [testDevice] });
    vi.mocked(settingsApi.updateDevice).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await screen.findByTestId('settings-device-row-mockruntime1');
    fireEvent.click(screen.getByTestId('settings-device-primary-radio-mockruntime1'));
    fireEvent.click(screen.getByTestId('settings-device-visibility-toggle-mockruntime1'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-device-primary-radio-mockruntime1')).toBeChecked();
    });
    expect(screen.getByTestId(`settings-device-primary-radio-${testOtherDeviceRowId}`)).not.toBeChecked();
    expect(screen.getByTestId('settings-device-visibility-toggle-mockruntime1')).not.toBeChecked();
    expect(screen.getByTestId('settings-device-autosave-status-mockruntime1')).toHaveTextContent('Saved.');
    expect(settingsApi.updateDevice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(`settings-device-primary-radio-${testOtherDeviceRowId}`));

    await waitFor(() => {
      expect(screen.getByTestId(`settings-device-primary-radio-${testOtherDeviceRowId}`)).toBeChecked();
    });
    expect(screen.getByTestId('settings-device-primary-radio-mockruntime1')).not.toBeChecked();
    expect(settingsApi.updateDevice).toHaveBeenCalledWith(
      testOtherDeviceId,
      expect.objectContaining({ isPrimary: true }),
      'mock-token',
    );
  });

  it('expands second station row independently', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice, mockDevice2] });

    renderCard();

    await expandRow(testOtherDeviceRowId);

    expect(screen.getByTestId(`settings-device-nickname-input-${testOtherDeviceRowId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-device-nickname-input-${testDeviceRowId}`)).toBeInTheDocument();
  });

  it('has no accessibility violations with devices collapsed', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    const { container } = renderCard();
    await screen.findByTestId('settings-devices-list');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations with device row expanded', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    const { container } = renderCard();
    await expandRow(testDeviceRowId);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations with empty state', async () => {
    const { container } = renderCard(false);
    // Wait for the public-sources query to settle so no state updates remain
    // in flight when axe runs (same pattern as the other two axe tests).
    await expandPublicNearbySources();
    await screen.findByTestId('settings-public-sources-empty');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Custom layout persistence ─────────────────────────────────────────────


  it('restores saved icon and position when returning to settings', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });

    // Simulate returning to settings after a save: layout API returns a block with icon/position.
    vi.mocked(dashboardApi.getDashboardLayout).mockResolvedValue({
      ok: true,
      data: {
        ...mockLayoutDto,
        layoutMode: 'custom',
        customItems: [{
          id: 'saved-block',
          type: 'metric-block',
          name: 'Comfort',
          size: '1x2',
          displayMode: 'rows',
          metrics: [],
          icon: 'Gauge',
          iconPosition: 'right',
        }],
      },
    });

    renderCard();

    // Navigate to custom layout.
    await screen.findByTestId('settings-layout-mode-tabs');
    fireEvent.click(screen.getByTestId('settings-layout-mode-custom'));
    await screen.findByTestId('settings-custom-layout-builder');

    // Expand the restored block.
    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    // The Gauge icon should be shown as selected.
    await waitFor(() => {
      expect(screen.getByTestId('settings-custom-layout-icon-Gauge'))
        .toHaveAttribute('aria-pressed', 'true');
    });

    // Position selector should be visible and Right should be active.
    expect(screen.getByTestId('settings-custom-layout-icon-position')).toBeInTheDocument();
    expect(screen.getByTestId('settings-custom-layout-icon-position-right'))
      .toHaveAttribute('aria-pressed', 'true');
  });
});

// ── Section 8E: External source rows in Default Settings ────────────────────

describe('DevicesCard — external source rows (Section 8E)', () => {
  const sourceId = faker.string.alphanumeric(8).toUpperCase();
  const sourceLat = faker.location.latitude({ min: 25, max: 49 });
  const sourceLon = faker.location.longitude({ min: -124, max: -66 });

  const mockPublicSource = {
    id: faker.string.uuid(),
    provider: 'WeatherGov' as const,
    sourceId,
    displayLabel: 'Smithfield Station',
    latitude: sourceLat,
    longitude: sourceLon,
    timezone: null,
    isEnabled: true,
    createdAtUtc: new Date().toISOString(),
    updatedAtUtc: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dashboardApi.getDashboardLayout).mockResolvedValue({ ok: true, data: mockLayoutDto });
    vi.mocked(dashboardApi.putDashboardLayout).mockResolvedValue({ ok: true, data: { ...mockLayoutDto, updatedAtUtc: '2026-06-02T00:00:00Z' } });
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [mockDevice] });
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({ ok: true, data: [mockPublicSource] });
    vi.mocked(publicSourcesApi.updatePublicSource).mockResolvedValue({ ok: true, data: mockPublicSource });
    vi.mocked(publicSourcesApi.deletePublicSource).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: true,
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov'],
        refreshIntervalMinutes: 15,
        pinnedStations: [{ provider: 'WeatherGov', sourceId, displayLabel: 'Smithfield Station' }],
      },
    });
    vi.mocked(neighborsApi.putNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: true,
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov'],
        refreshIntervalMinutes: 15,
        pinnedStations: [],
      },
    });
    vi.mocked(publicSourcesApi.discoverPublicSources).mockResolvedValue({ ok: true, data: [] });
  });

  it('shows public source row in the combined pinned station list with provider badge', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-devices-list');

    const externalList = await screen.findByTestId('settings-external-sources-list');
    expect(externalList).toBeInTheDocument();

    const badge = within(externalList).getByTestId('settings-external-source-provider-badge');
    expect(badge).toHaveTextContent('Weather.gov');
  });

  it('toggles visibility on public source row', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-external-sources-list');

    const macId = `public-${mockPublicSource.id}`;
    const toggle = await screen.findByTestId(`settings-external-source-visibility-toggle-${macId}`);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(vi.mocked(publicSourcesApi.updatePublicSource)).toHaveBeenCalledWith(
        mockPublicSource.id,
        expect.objectContaining({ isEnabled: false }),
        expect.any(String),
      );
    });
  });

  it('deletes public source when delete button clicked', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-external-sources-list');

    const macId = `public-${mockPublicSource.id}`;
    const deleteBtn = await screen.findByTestId(`settings-external-source-delete-${macId}`);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(vi.mocked(publicSourcesApi.deletePublicSource)).toHaveBeenCalledWith(
        mockPublicSource.id,
        expect.any(String),
      );
    });
  });

  it('expands external source row and shows supported metrics', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-external-sources-list');

    const macId = `public-${mockPublicSource.id}`;
    expect(screen.getByTestId('settings-external-source-provider-badge')).toHaveTextContent('Weather.gov');
    expect(screen.getByTestId(`settings-external-source-visibility-toggle-${macId}`)).toBeChecked();

    const expandBtn = await screen.findByTestId(`settings-external-source-toggle-${macId}`);
    fireEvent.click(expandBtn);

    const metricSection = await screen.findByTestId(`settings-external-source-metric-form-${macId}`);
    expect(metricSection).toBeInTheDocument();
    // Should show some known provider-supported metrics
    expect(within(metricSection).getByTestId(`settings-external-source-metric-${macId}-outdoor_temp`)).toBeInTheDocument();
    expect(within(metricSection).getByTestId(`settings-external-source-metric-${macId}-wind_speed`)).toBeInTheDocument();
    // Indoor-only metrics should NOT appear
    expect(within(metricSection).queryByTestId(`settings-external-source-metric-${macId}-indoor_temp`)).not.toBeInTheDocument();
  });

  it('saves selected metric keys when public source metric form is saved', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-external-sources-list');

    const macId = `public-${mockPublicSource.id}`;
    fireEvent.click(await screen.findByTestId(`settings-external-source-toggle-${macId}`));

    const metricSection = await screen.findByTestId(`settings-external-source-metric-form-${macId}`);
    fireEvent.click(within(metricSection).getByTestId(`settings-external-source-metric-${macId}-outdoor_temp`));
    fireEvent.click(within(metricSection).getByTestId(`settings-external-source-metric-save-button-${macId}`));

    await waitFor(() => {
      expect(vi.mocked(publicSourcesApi.updatePublicSource)).toHaveBeenCalled();
    });

    const call = vi.mocked(publicSourcesApi.updatePublicSource).mock.calls
      .find(([id]) => id === mockPublicSource.id);
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected public source update call.');
    const [, body] = call;
    expect(body.selectedMetricKeys).not.toContain('outdoor_temp');
  });

  it('public source metric form shows category and metric ordering controls', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-external-sources-list');

    const macId = `public-${mockPublicSource.id}`;
    fireEvent.click(await screen.findByTestId(`settings-external-source-toggle-${macId}`));

    await screen.findByTestId(`settings-external-source-metric-form-${macId}`);

    expect(screen.getByTestId(`settings-external-source-metric-category-move-up-${macId}-temperature`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-external-source-metric-category-move-down-${macId}-temperature`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-external-source-metric-move-up-${macId}-outdoor_temp`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-external-source-metric-move-down-${macId}-outdoor_temp`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-external-source-metric-save-button-${macId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-external-source-metric-reset-button-${macId}`)).toBeInTheDocument();
  });

  it('shows pinned station row in the Default station list', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-devices-list');

    const pinnedList = await screen.findByTestId('settings-pinned-sources-list');
    expect(pinnedList).toBeInTheDocument();

    const badge = within(pinnedList).getByTestId('settings-pinned-source-badge');
    expect(badge).toHaveTextContent('Pinned');
    expect(within(pinnedList).getByTestId('settings-pinned-source-provider')).toHaveTextContent('Weather.gov');
    expect(within(pinnedList).getByTestId(`settings-pinned-source-label-edit-pinned-WeatherGov-${sourceId}`)).toHaveValue('Smithfield Station');
    expect(within(pinnedList).getByTestId(`settings-pinned-source-visibility-toggle-pinned-WeatherGov-${sourceId}`)).toBeChecked();
  });

  it('saves pinned station label edits from the shared pinned row treatment', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    const labelInput = await screen.findByTestId<HTMLInputElement>(`settings-pinned-source-label-edit-${rowId}`);
    fireEvent.change(labelInput, { target: { value: 'Updated pinned station' } });
    fireEvent.blur(labelInput);

    await waitFor(() => {
      expect(vi.mocked(neighborsApi.putNeighborsConfig)).toHaveBeenCalled();
    });
    const body = vi.mocked(neighborsApi.putNeighborsConfig).mock.calls.at(-1)?.[0];
    const saved = body?.pinnedStations?.find((pin) => pin.provider === 'WeatherGov' && pin.sourceId === sourceId);
    expect(saved?.displayLabel).toBe('Updated pinned station');
  });

  it('saves pinned station dashboard visibility from the Dashboard checkbox', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    fireEvent.click(await screen.findByTestId(`settings-pinned-source-visibility-toggle-${rowId}`));

    await waitFor(() => {
      expect(vi.mocked(neighborsApi.putNeighborsConfig)).toHaveBeenCalled();
    });
    const body = vi.mocked(neighborsApi.putNeighborsConfig).mock.calls.at(-1)?.[0];
    const saved = body?.pinnedStations?.find((pin) => pin.provider === 'WeatherGov' && pin.sourceId === sourceId);
    expect(saved?.isEnabled).toBe(false);
  });

  it('unpin button calls saveNeighborsConfig without the pin', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    const unpinBtn = await screen.findByTestId(`settings-pinned-source-unpin-${rowId}`);
    fireEvent.click(unpinBtn);

    await waitFor(() => {
      expect(vi.mocked(neighborsApi.putNeighborsConfig)).toHaveBeenCalledWith(
        expect.objectContaining({ pinnedStations: [] }),
        expect.any(String),
      );
    });
  });

  it('expands pinned source row and shows PinnedMetricSelector with supported metrics', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    const expandBtn = await screen.findByTestId(`settings-pinned-source-toggle-${rowId}`);
    fireEvent.click(expandBtn);

    const form = await screen.findByTestId(`settings-pinned-metric-form-${rowId}`);
    expect(form).toBeInTheDocument();

    // WeatherGov pinned metrics: basic + daily extremes + NWS text fields
    expect(within(form).getByTestId(`settings-pinned-metric-${rowId}-outdoor_temp`)).toBeInTheDocument();
    expect(within(form).getByTestId(`settings-pinned-metric-${rowId}-wind_speed`)).toBeInTheDocument();
    expect(within(form).getByTestId(`settings-pinned-metric-${rowId}-daily_high_temp`)).toBeInTheDocument();
    expect(within(form).getByTestId(`settings-pinned-metric-${rowId}-daily_low_temp`)).toBeInTheDocument();
    expect(within(form).getByTestId(`settings-pinned-metric-${rowId}-nws_sky_conditions`)).toBeInTheDocument();
    expect(within(form).getByTestId(`settings-pinned-metric-${rowId}-nws_text_description`)).toBeInTheDocument();

    // Weather.gov pinned does not have these fields
    expect(within(form).queryByTestId(`settings-pinned-metric-${rowId}-solar_radiation`)).not.toBeInTheDocument();
    expect(within(form).queryByTestId(`settings-pinned-metric-${rowId}-uv_index`)).not.toBeInTheDocument();
    expect(within(form).queryByTestId(`settings-pinned-metric-${rowId}-rainfall_day`)).not.toBeInTheDocument();
    // Indoor-only metrics excluded
    expect(within(form).queryByTestId(`settings-pinned-metric-${rowId}-indoor_humidity`)).not.toBeInTheDocument();
    expect(within(form).queryByTestId(`settings-pinned-metric-${rowId}-indoor_temp`)).not.toBeInTheDocument();
  });

  it('PinnedMetricSelector shows category and metric ordering arrows', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    fireEvent.click(await screen.findByTestId(`settings-pinned-source-toggle-${rowId}`));
    await screen.findByTestId(`settings-pinned-metric-form-${rowId}`);

    // Category ordering arrows exist
    expect(screen.getByTestId(`settings-pinned-metric-category-move-up-${rowId}-temperature`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-pinned-metric-category-move-down-${rowId}-temperature`)).toBeInTheDocument();

    // Metric ordering arrows exist
    expect(screen.getByTestId(`settings-pinned-metric-move-up-${rowId}-outdoor_temp`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-pinned-metric-move-down-${rowId}-outdoor_temp`)).toBeInTheDocument();

    // Save and Reset buttons exist
    expect(screen.getByTestId(`settings-pinned-metric-save-button-${rowId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`settings-pinned-metric-reset-button-${rowId}`)).toBeInTheDocument();
  });

  it('saves selected metric keys via Save button on PinnedMetricSelector', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    fireEvent.click(await screen.findByTestId(`settings-pinned-source-toggle-${rowId}`));
    await screen.findByTestId(`settings-pinned-metric-form-${rowId}`);

    // Uncheck Outdoor Temp
    fireEvent.click(screen.getByTestId(`settings-pinned-metric-${rowId}-outdoor_temp`));
    // Click Save
    fireEvent.click(screen.getByTestId(`settings-pinned-metric-save-button-${rowId}`));

    await waitFor(() => {
      expect(vi.mocked(neighborsApi.putNeighborsConfig)).toHaveBeenCalled();
    });

    const body = vi.mocked(neighborsApi.putNeighborsConfig).mock.calls.at(-1)?.[0];
    expect(body).toBeDefined();
    if (!body) throw new Error('Expected neighbor config save body.');
    const selected = body.pinnedStations?.find((pin) => pin.provider === 'WeatherGov' && pin.sourceId === sourceId)
      ?.selectedMetricKeys;
    expect(selected).not.toContain('outdoor_temp');
  });

  it('shows layout mode toggle when user has no owned devices but has public sources', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({
      ok: true,
      data: [{
        id: faker.string.uuid(),
        provider: 'OpenMeteo',
        sourceId: faker.string.alphanumeric(8),
        displayLabel: 'Generated Public Source',
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        timezone: 'UTC',
        isEnabled: true,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
      }],
    });

    renderCard();

    expect(await screen.findByTestId('settings-layout-mode-tabs')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-devices-list')).not.toBeInTheDocument();
  });

  it('shows layout mode toggle when credentials are missing but public sources exist', async () => {
    vi.mocked(publicSourcesApi.getPublicSources).mockResolvedValue({
      ok: true,
      data: [{
        id: faker.string.uuid(),
        provider: 'OpenMeteo',
        sourceId: faker.string.alphanumeric(8),
        displayLabel: 'Generated Public Source',
        latitude: faker.location.latitude({ min: 25, max: 49 }),
        longitude: faker.location.longitude({ min: -124, max: -66 }),
        timezone: 'UTC',
        isEnabled: true,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
      }],
    });

    renderCard(false);

    expect(await screen.findByTestId('settings-layout-mode-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('settings-layout-mode-default')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('settings-devices-list')).not.toBeInTheDocument();
  });

  it('shows layout mode toggle when user has no owned devices but has pinned neighbor stations', async () => {
    vi.mocked(settingsApi.getDevices).mockResolvedValue({ ok: true, data: [] });
    const pinnedSourceId = faker.string.alphanumeric(8);
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: false,
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [{
          provider: 'WeatherGov',
          sourceId: pinnedSourceId,
          displayLabel: 'Generated Pinned Station',
        }],
      },
    });

    renderCard();

    expect(await screen.findByTestId('settings-layout-mode-tabs')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-devices-list')).not.toBeInTheDocument();
  });

  it('shows layout mode toggle when credentials are missing but pinned neighbor stations exist', async () => {
    const pinnedSourceId = faker.string.alphanumeric(8);
    vi.mocked(neighborsApi.getNeighborsConfig).mockResolvedValue({
      ok: true,
      data: {
        isEnabled: false,
        radiusMiles: 15,
        comparisonRadiusMiles: 25,
        maxAgeMinutes: 60,
        minStations: 3,
        enabledProviders: ['WeatherGov', 'OpenMeteo'],
        refreshIntervalMinutes: 15,
        pinnedStations: [{
          provider: 'WeatherGov',
          sourceId: pinnedSourceId,
          displayLabel: 'Generated Pinned Station',
        }],
      },
    });

    renderCard(false);

    expect(await screen.findByTestId('settings-layout-mode-tabs')).toBeInTheDocument();
    await expandPublicNearbySources();
    expect(screen.getByTestId('settings-pinned-sources-list')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-devices-list')).not.toBeInTheDocument();
  });

  it('moves metric category order and saves via Save button', async () => {
    renderCard(true);
    await expandPublicNearbySources();
    await screen.findByTestId('settings-pinned-sources-list');

    const rowId = `pinned-WeatherGov-${sourceId}`;
    fireEvent.click(await screen.findByTestId(`settings-pinned-source-toggle-${rowId}`));
    await screen.findByTestId(`settings-pinned-metric-form-${rowId}`);

    // All keys are selected by default; move Wind category to before Temperature
    fireEvent.click(screen.getByTestId(`settings-pinned-metric-category-move-up-${rowId}-wind`));
    fireEvent.click(screen.getByTestId(`settings-pinned-metric-category-move-up-${rowId}-wind`));

    fireEvent.click(screen.getByTestId(`settings-pinned-metric-save-button-${rowId}`));

    await waitFor(() => {
      expect(vi.mocked(neighborsApi.putNeighborsConfig)).toHaveBeenCalled();
    });

    const body = vi.mocked(neighborsApi.putNeighborsConfig).mock.calls.at(-1)?.[0];
    const selected = body?.pinnedStations?.find((pin) => pin.provider === 'WeatherGov')?.selectedMetricKeys ?? [];
    // wind_speed should appear before outdoor_temp (Wind category moved before Temperature)
    const windIdx = selected.indexOf('wind_speed');
    const tempIdx = selected.indexOf('outdoor_temp');
    expect(windIdx).toBeGreaterThanOrEqual(0);
    expect(tempIdx).toBeGreaterThanOrEqual(0);
    expect(windIdx).toBeLessThan(tempIdx);
  });
});
