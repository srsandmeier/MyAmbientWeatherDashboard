import { ALLOWED_METRIC_KEYS, type MetricKey, type SettingsDeviceDto } from '../types/settings';

const BASIC_PUBLIC_METRICS = [
  'outdoor_temp',
  'feels_like',
  'dew_point',
  'outdoor_humidity',
  'pressure',
  'wind_dir',
  'wind_speed',
  'wind_gust',
] as const satisfies readonly MetricKey[];

// ── Public sources (saved via the Add form) ──────────────────────────────────
// These use the PublicSourceCurrentReadingService which has its own API calls
// and does not map daily extremes or precipitation from WeatherGov/OpenMeteo.

const WEATHER_GOV_PUBLIC_METRICS = [
  ...BASIC_PUBLIC_METRICS,
  'nws_sky_conditions',
  'nws_present_weather',
  'nws_text_description',
  'nws_raw_metar',
] as const satisfies readonly MetricKey[];

/** Open-Meteo extended (om_*) metrics shared by the public and pinned variants. */
const OPEN_METEO_EXTENDED_METRICS = [
  'om_cloud_cover',
  'om_precip_probability',
  'om_weather_description',
  'om_sunrise',
  'om_sunset',
  'om_uv_index_max',
  'om_precip_sum',
  'om_wind_speed_max',
  'om_wind_gust_max',
  'om_wind_dir_dominant',
] as const satisfies readonly MetricKey[];

const OPEN_METEO_PUBLIC_METRICS = [
  ...BASIC_PUBLIC_METRICS,
  'uv_index',
  ...OPEN_METEO_EXTENDED_METRICS,
] as const satisfies readonly MetricKey[];

// ── Pinned stations (neighbor pins) ──────────────────────────────────────────
// These use WeatherGovNearbyObservationProvider / OpenMeteoNearbyBaselineProvider
// which map additional fields including daily extremes and hourly precipitation.

const WEATHER_GOV_PINNED_METRICS = [
  ...BASIC_PUBLIC_METRICS,
  'daily_high_temp',    // from maxTemperatureLast24Hours
  'daily_low_temp',     // from minTemperatureLast24Hours
  'nws_sky_conditions',
  'nws_present_weather',
  'nws_text_description',
  'nws_raw_metar',
] as const satisfies readonly MetricKey[];

const OPEN_METEO_PINNED_METRICS = [
  ...BASIC_PUBLIC_METRICS,
  'uv_index',
  'rainfall_event',     // maps from hourlyRainIn (current-hour precipitation)
  'daily_high_temp',    // from daily.temperature_2m_max[0]
  'daily_low_temp',     // from daily.temperature_2m_min[0]
  ...OPEN_METEO_EXTENDED_METRICS,
] as const satisfies readonly MetricKey[];

// AmbientOpen is only used as a pinned provider, not as a saved public source.
const AMBIENT_OPEN_METRICS = [
  ...BASIC_PUBLIC_METRICS,
  'rainfall_event',     // maps from hourlyRainIn
  'rainfall_day',
  'rainfall_week',
  'rainfall_month',
  'rainfall_year',
  'solar_radiation',
  'uv_index',
] as const satisfies readonly MetricKey[];

const ALL_METRIC_SET = new Set<string>(ALLOWED_METRIC_KEYS);

/** Returns metrics the current backend can populate for a public/pinned provider. */
export function getProviderSupportedMetricKeys(
  sourceKind: SettingsDeviceDto['sourceKind'],
  provider: string | null | undefined,
): readonly MetricKey[] | null {
  if (sourceKind !== 'public' && sourceKind !== 'pinned') return null;

  switch (provider ?? '') {
    case 'WeatherGov':
      return sourceKind === 'pinned' ? WEATHER_GOV_PINNED_METRICS : WEATHER_GOV_PUBLIC_METRICS;
    case 'OpenMeteo':
      return sourceKind === 'pinned' ? OPEN_METEO_PINNED_METRICS : OPEN_METEO_PUBLIC_METRICS;
    case 'AmbientOpen':
      return AMBIENT_OPEN_METRICS;
    default:
      return BASIC_PUBLIC_METRICS;
  }
}

export function getDeviceSupportedMetricKeys(device: SettingsDeviceDto): readonly MetricKey[] {
  return getProviderSupportedMetricKeys(device.sourceKind, device.provider)
    ?? ALLOWED_METRIC_KEYS;
}

export function normalizeSupportedMetricKeys(
  keys: readonly string[] | null | undefined,
  supportedKeys: readonly MetricKey[],
): readonly MetricKey[] {
  if (keys === null || keys === undefined) return supportedKeys;

  const supported = new Set<string>(supportedKeys);
  return keys.filter((key): key is MetricKey => supported.has(key) && ALL_METRIC_SET.has(key));
}
