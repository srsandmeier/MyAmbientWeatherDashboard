const HISTORY_METRIC_KEYS = new Set([
  'wind_dir',
  'outdoor_temp',
  'indoor_temp',
  'outdoor_humidity',
  'indoor_humidity',
  'pressure',
  'uv_index',
  'solar_radiation',
  'wind_speed',
  'wind_gust',
  'max_daily_gust',
  'feels_like',
  'indoor_feels_like',
  'dew_point',
  'indoor_dew_point',
  'rainfall_event',
  'rainfall_day',
  'rainfall_week',
  'rainfall_month',
  'rainfall_year',
] as const);

/** Returns true when the owned-station history endpoint can chart this metric. */
export function isHistoryMetricKey(metricKey: string): boolean {
  return HISTORY_METRIC_KEYS.has(metricKey as never);
}

/** Builds a metric history route, preserving the owned station when known. */
export function getMetricHistoryPath(metricKey: string, deviceId?: string | null): string {
  const metricPath = `/metrics/${encodeURIComponent(metricKey)}`;
  if (!deviceId) return metricPath;
  return `${metricPath}?deviceId=${encodeURIComponent(deviceId)}`;
}
