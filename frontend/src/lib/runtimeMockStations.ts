import { ALLOWED_METRIC_KEYS, type SettingsDeviceDto, type UpdateDeviceSettingsRequest } from '../types/settings';

/** Prefix shared by all runtime mock station identifiers. */
const MOCK_MAC_PREFIX = 'mock-runtime-';
const STORAGE_KEY_PREFIX = 'ambient-weather-dashboard:runtime-mock-station';

// Mock stations emulate owned Ambient hardware, which never reports
// Open-Meteo extended (om_*) metrics — exclude them so mock tiles match
// what a real Ambient station can display.
const MOCK_METRIC_KEYS = ALLOWED_METRIC_KEYS.filter((key) => !key.startsWith('om_'));

/** Normalizes MAC addresses for runtime matching without changing persisted data. */
export function normalizeRuntimeMac(mac: string): string {
  return mac.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function getMockMac(index: number): string {
  return `${MOCK_MAC_PREFIX}${String(index)}`;
}

export function isRuntimeMockMac(mac: string): boolean {
  const normalized = normalizeRuntimeMac(mac);
  return normalized.startsWith(normalizeRuntimeMac(MOCK_MAC_PREFIX));
}

function buildDefaultMockStation(index: number): SettingsDeviceDto {
  return {
    macAddress: getMockMac(index),
    name: `Mock Runtime Station ${String(index)}`,
    nickname: index === 1 ? 'Mock Station' : `Mock Station ${String(index)}`,
    isPrimary: false,
    displayOnDashboard: true,
    selectedMetricKeys: MOCK_METRIC_KEYS,
    latitude: null,
    longitude: null,
    elevationMeters: null,
    address: null,
    location: 'Runtime preview',
    lastSyncAtUtc: null,
    isMock: true,
  };
}

const runtimeMockStationCache = new Map<number, SettingsDeviceDto>();

function getRuntimeMockStation(index: number): SettingsDeviceDto {
  const cached = runtimeMockStationCache.get(index);
  if (cached !== undefined) {
    return cached;
  }
  const station = loadRuntimeMockStation(index);
  runtimeMockStationCache.set(index, station);
  return station;
}

/**
 * Returns the number of mock stations to add based on test.N nicknames.
 * Devices with nickname "test.1" → 1 mock; "test.2" → 2 mocks; max wins across all devices.
 */
function countMocksFromNicknames(devices: readonly SettingsDeviceDto[]): number {
  let max = 0;
  for (const device of devices) {
    if (isRuntimeMockMac(device.macAddress)) continue;
    const match = device.nickname?.match(/^test\.(\d+)$/i);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return max;
}

/** Adds runtime mock stations based on test.N device nicknames. */
export function withRuntimeMockStations(
  devices: readonly SettingsDeviceDto[],
): readonly SettingsDeviceDto[] {
  const realDevices = devices.filter((d) => !isRuntimeMockMac(d.macAddress));
  const count = countMocksFromNicknames(realDevices);

  if (count === 0) {
    return normalizeRuntimePrimary(realDevices);
  }

  const existingMocks = devices.filter((d) => isRuntimeMockMac(d.macAddress));
  const mocks: SettingsDeviceDto[] = [];
  for (let i = 1; i <= count; i++) {
    const existing = existingMocks.find(
      (d) => normalizeRuntimeMac(d.macAddress) === normalizeRuntimeMac(getMockMac(i)),
    );
    mocks.push(existing ?? getRuntimeMockStation(i));
  }

  return normalizeRuntimePrimary([...realDevices, ...mocks]);
}

function normalizeRuntimePrimary(
  devices: readonly SettingsDeviceDto[],
): readonly SettingsDeviceDto[] {
  const hasMockPrimary = devices.some(
    (device) => isRuntimeMockMac(device.macAddress) && device.isPrimary,
  );
  const hasRealPrimary = devices.some(
    (device) => !isRuntimeMockMac(device.macAddress) && device.isPrimary,
  );

  if (!hasMockPrimary && !hasRealPrimary) {
    return devices;
  }

  return devices.map((device) => {
    const isMock = isRuntimeMockMac(device.macAddress);
    if (hasMockPrimary && !isMock) {
      return { ...device, isPrimary: false };
    }

    if (!hasMockPrimary && hasRealPrimary && isMock && device.isPrimary) {
      return { ...device, isPrimary: false };
    }

    return device;
  });
}

/** Applies runtime-only station changes to the local settings device list. */
export function updateRuntimeSettingsDevice(
  devices: readonly SettingsDeviceDto[] | undefined,
  macAddress: string,
  patch: UpdateDeviceSettingsRequest,
): readonly SettingsDeviceDto[] | undefined {
  if (!devices) {
    return devices;
  }

  const targetMac = normalizeRuntimeMac(macAddress);
  const updatedDevices = devices.map((device) => {
    const isTarget = normalizeRuntimeMac(device.macAddress) === targetMac;
    if (patch.isPrimary === true && !isTarget) {
      return { ...device, isPrimary: false };
    }

    if (!isTarget) {
      return device;
    }

    return {
      ...device,
      nickname: patch.nickname === undefined ? device.nickname : patch.nickname,
      isPrimary: patch.isPrimary ?? device.isPrimary,
      displayOnDashboard: patch.displayOnDashboard ?? device.displayOnDashboard,
      selectedMetricKeys: patch.selectedMetricKeys === undefined
        ? device.selectedMetricKeys
        : patch.selectedMetricKeys,
    };
  });

  const updatedMockStation = updatedDevices.find(
    (device) => device.isMock === true && normalizeRuntimeMac(device.macAddress) === targetMac,
  );
  if (updatedMockStation) {
    const index = parseInt(normalizeRuntimeMac(targetMac).slice(normalizeRuntimeMac(MOCK_MAC_PREFIX).length), 10);
    if (!isNaN(index)) {
      runtimeMockStationCache.set(index, updatedMockStation);
      saveRuntimeMockStation(index, updatedMockStation);
    }
  }

  return updatedDevices;
}

function loadRuntimeMockStation(index: number): SettingsDeviceDto {
  const stored = readStoredRuntimeMockStation(index);
  const defaults = buildDefaultMockStation(index);
  if (!stored) {
    return defaults;
  }

  return {
    ...defaults,
    nickname: stored.nickname,
    isPrimary: stored.isPrimary,
    displayOnDashboard: stored.displayOnDashboard,
    selectedMetricKeys: stored.selectedMetricKeys,
  };
}

function readStoredRuntimeMockStation(index: number): Pick<
  SettingsDeviceDto,
  'nickname' | 'isPrimary' | 'displayOnDashboard' | 'selectedMetricKeys'
> | null {
  const storage = getBrowserStorage();
  if (storage === null) {
    return null;
  }

  try {
    const raw = storage.getItem(`${STORAGE_KEY_PREFIX}:${String(index)}`);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isStoredRuntimeMockStation(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveRuntimeMockStation(index: number, station: SettingsDeviceDto): void {
  const storage = getBrowserStorage();
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(
      `${STORAGE_KEY_PREFIX}:${String(index)}`,
      JSON.stringify({
        nickname: station.nickname,
        isPrimary: station.isPrimary,
        displayOnDashboard: station.displayOnDashboard,
        selectedMetricKeys: station.selectedMetricKeys,
      }),
    );
  } catch {
    // Runtime mock station preferences are a local convenience only.
  }
}

function getBrowserStorage(): Storage | null {
  if (import.meta.env.MODE === 'test') {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  if (window.location.protocol === 'about:') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStoredRuntimeMockStation(value: unknown): value is Pick<
  SettingsDeviceDto,
  'nickname' | 'isPrimary' | 'displayOnDashboard' | 'selectedMetricKeys'
> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const nicknameValid = record.nickname === null || typeof record.nickname === 'string';
  return nicknameValid
    && typeof record.isPrimary === 'boolean'
    && typeof record.displayOnDashboard === 'boolean'
    && Array.isArray(record.selectedMetricKeys)
    && record.selectedMetricKeys.every((key) => typeof key === 'string');
}
