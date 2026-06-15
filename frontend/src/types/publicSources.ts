import type { SettingsDeviceDto } from './settings';
import { weatherProviderLabel } from '../lib/weatherProviderLabels';

export type PublicWeatherSourceProvider = 'WeatherGov' | 'OpenMeteo';

export interface PublicWeatherSourceDto {
  readonly id: string;
  readonly provider: PublicWeatherSourceProvider;
  readonly sourceId: string;
  readonly displayLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string | null;
  readonly isEnabled: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface CreatePublicWeatherSourceRequest {
  readonly provider: PublicWeatherSourceProvider;
  readonly sourceId: string;
  readonly displayLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone?: string | null;
  readonly isEnabled: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
}

export interface UpdatePublicWeatherSourceRequest {
  readonly displayLabel?: string | null;
  readonly isEnabled?: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
}

export interface DiscoveredPublicSourceDto {
  readonly provider: PublicWeatherSourceProvider;
  readonly sourceId: string;
  readonly displayLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string | null;
}

export function publicSourceStationId(id: string): string {
  return `public:${id}`;
}

export function publicSourceDisplayName(source: PublicWeatherSourceDto): string {
  const providerLabel = weatherProviderLabel(source.provider);
  const labelWithoutProvider = source.displayLabel
    .replace(/^(Weather\.gov|WeatherGov|Open-Meteo|OpenMeteo)\s*(?:[.—-]|\s—\s|\s-\s)?\s*/iu, '')
    .trim();

  return labelWithoutProvider.length > 0
    ? `${providerLabel} - ${labelWithoutProvider}`
    : providerLabel;
}

export function sourceToDevice(source: PublicWeatherSourceDto): SettingsDeviceDto {
  return {
    macAddress: publicSourceStationId(source.id),
    name: publicSourceDisplayName(source),
    nickname: null,
    isPrimary: false,
    displayOnDashboard: source.isEnabled,
    selectedMetricKeys: source.selectedMetricKeys ?? null,
    latitude: source.latitude,
    longitude: source.longitude,
    elevationMeters: null,
    address: null,
    location: source.displayLabel,
    lastSyncAtUtc: source.updatedAtUtc,
    tz: source.timezone,
    sourceKind: 'public',
    provider: source.provider,
    sourceId: source.sourceId,
  };
}
