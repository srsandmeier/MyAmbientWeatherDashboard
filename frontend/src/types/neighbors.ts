import type { SettingsDeviceDto } from './settings';

/** A specific neighbor station pinned to the dashboard */
export interface PinnedNeighborStationDto {
  readonly provider: string;
  readonly sourceId: string;
  readonly displayLabel: string | null;
  readonly selectedMetricKeys?: readonly string[] | null;
  readonly isEnabled?: boolean;
}

/** Stable synthetic MAC used to key pinned stations in device/readings maps. */
export function pinnedStationId(provider: string, sourceId: string): string {
  return `pinned:${provider}:${sourceId}`;
}

/** Converts a pinned station to a SettingsDeviceDto for use in layout pickers. */
export function pinnedToDevice(pin: PinnedNeighborStationDto): SettingsDeviceDto {
  return {
    macAddress: pinnedStationId(pin.provider, pin.sourceId),
    name: pin.displayLabel ?? pin.sourceId,
    nickname: null,
    isPrimary: false,
    displayOnDashboard: pin.isEnabled ?? true,
    selectedMetricKeys: pin.selectedMetricKeys ?? null,
    latitude: null,
    longitude: null,
    elevationMeters: null,
    address: null,
    location: null,
    lastSyncAtUtc: null,
    sourceKind: 'pinned',
    provider: pin.provider,
    sourceId: pin.sourceId,
  };
}

/** Matches backend NeighborConfigDto */
export interface NeighborConfigDto {
  readonly isEnabled: boolean;
  readonly enabledStationMacAddresses?: readonly string[] | null;
  readonly radiusMiles: number;
  readonly comparisonRadiusMiles: number;
  readonly maxAgeMinutes: number;
  readonly minStations: number;
  readonly enabledProviders: readonly string[];
  readonly refreshIntervalMinutes: number;
  readonly discoveryLocationQuery?: string | null;
  readonly municipality?: string | null;
  /** Whether the AmbientOpen provider is enabled server-side. Drives the UI checkbox availability. */
  readonly isAmbientOpenAvailable?: boolean;
  /** Maximum radius in miles that the Ambient Open API reliably supports. */
  readonly ambientOpenMaxRadiusMiles?: number;
  /** Stations the user has pinned to the dashboard. */
  readonly pinnedStations?: readonly PinnedNeighborStationDto[];
}

/** PUT /api/neighbors/config request body */
export interface UpdateNeighborConfigRequest {
  readonly isEnabled: boolean;
  readonly enabledStationMacAddresses?: readonly string[] | null;
  readonly radiusMiles: number;
  readonly comparisonRadiusMiles?: number | null;
  readonly maxAgeMinutes: number;
  readonly minStations: number;
  readonly enabledProviders: readonly string[];
  readonly refreshIntervalMinutes: number;
  readonly discoveryLocationQuery?: string | null;
  readonly municipality?: string | null;
  /** When provided, replaces the pinned stations list. Omit to preserve existing pins. */
  readonly pinnedStations?: readonly PinnedNeighborStationDto[];
}

/** Matches backend NeighborStationDto — a discovered nearby public station */
export interface NeighborStationDto {
  readonly provider: string;
  readonly sourceId: string;
  readonly name: string | null;
  readonly discoveryKind?: string | null;
  readonly lat: number;
  readonly lon: number;
  readonly distanceMiles: number;
  readonly lastObservedAtUtc: string | null;
  readonly freshnessMinutes: number | null;
  readonly tempF: number | null;
  readonly humidity: number | null;
  readonly dewPoint: number | null;
  readonly feelsLike: number | null;
  readonly baromRelIn: number | null;
  readonly baromAbsIn: number | null;
  readonly windSpeedMph: number | null;
  readonly windGustMph: number | null;
  readonly windDir: number | null;
  readonly hourlyRainIn: number | null;
  readonly dailyRainIn: number | null;
  readonly weeklyRainIn: number | null;
  readonly monthlyRainIn: number | null;
  readonly yearlyRainIn: number | null;
  readonly solarRadiation: number | null;
  readonly uv: number | null;
}

/** Matches backend AggregatedNeighborReadingDto */
export interface AggregatedNeighborReadingDto {
  readonly contributingStationCount: number;
  readonly isBelowMinStations: boolean;
  readonly tempF: number | null;
  readonly humidity: number | null;
  readonly dewPoint: number | null;
  readonly feelsLike: number | null;
  readonly baromRelIn: number | null;
  readonly baromAbsIn: number | null;
  readonly windSpeedMph: number | null;
  readonly windGustMph: number | null;
  readonly windDir: number | null;
  readonly hourlyRainIn: number | null;
  readonly dailyRainIn: number | null;
  readonly weeklyRainIn: number | null;
  readonly monthlyRainIn: number | null;
  readonly yearlyRainIn: number | null;
  readonly solarRadiation: number | null;
  readonly uv: number | null;
}

/** Provider names recognized by the backend */
export const NEIGHBOR_PROVIDERS = ['WeatherGov', 'OpenMeteo', 'AmbientOpen'] as const;
export type NeighborProvider = (typeof NEIGHBOR_PROVIDERS)[number];

export const NEIGHBOR_PROVIDER_LABELS: Record<NeighborProvider, string> = {
  WeatherGov: 'Weather.gov (NWS)',
  OpenMeteo: 'Open-Meteo',
  AmbientOpen: 'Ambient Open',
};
