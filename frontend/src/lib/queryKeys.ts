import type { MetricHistoryParams } from '../types/metrics';

/** Centralized TanStack Query key factory. Add keys here as new BFF endpoints are implemented. */
export const queryKeys = {
  health: () => ['health'] as const,
  settings: {
    preferences: () => ['settings', 'preferences'] as const,
    credentialsStatus: () => ['settings', 'credentials-status'] as const,
    devices: () => ['settings', 'devices'] as const,
    publicSources: {
      list: () => ['settings', 'public-sources'] as const,
      current: (id: string) => ['public-sources', 'current', id] as const,
    },
  },
  metrics: {
    history: (metricKey: string, params: MetricHistoryParams) =>
      ['metrics', 'history', metricKey, params] as const,
  },
  dashboard: {
    current: () => ['dashboard', 'current'] as const,
    rainfall: () => ['dashboard', 'rainfall'] as const,
    layout: () => ['dashboard', 'layout'] as const,
    extrema: () => ['dashboard', 'daily-extremes'] as const,
  },
  neighbors: {
    config: () => ['neighbors', 'config'] as const,
    stations: () => ['neighbors', 'stations'] as const,
    stationCurrent: (provider: string, sourceId: string) =>
      ['neighbors', 'station-current', provider, sourceId] as const,
  },
  alerts: {
    active: (areaCode?: string | null) => ['alerts', 'active', areaCode ?? 'station'] as const,
  },
} as const;
