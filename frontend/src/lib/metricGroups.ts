/** Metric keys that belong to each dashboard group tile. */

export const TEMPERATURE_METRICS = [
  'outdoor_temp', 'feels_like', 'dew_point',
  'daily_high_temp', 'daily_low_temp',
  'indoor_temp', 'indoor_feels_like', 'indoor_dew_point',
  'daily_high_temp_in', 'daily_low_temp_in',
] as const;

export const HUMIDITY_METRICS = [
  'outdoor_humidity', 'indoor_humidity', 'pressure',
  'om_cloud_cover', 'om_precip_probability',
] as const;

export const WIND_METRICS = [
  'wind_dir', 'wind_speed', 'wind_gust', 'max_daily_gust',
  'om_wind_speed_max', 'om_wind_gust_max', 'om_wind_dir_dominant',
] as const;

export const SOLAR_METRICS = ['solar_radiation', 'uv_index', 'om_uv_index_max'] as const;

export const RAINFALL_METRICS = [
  'rainfall_event', 'rainfall_day', 'rainfall_week', 'rainfall_month', 'rainfall_year',
] as const;

export const CONDITIONS_METRICS = [
  'nws_sky_conditions', 'nws_present_weather', 'nws_text_description', 'nws_raw_metar',
  'om_weather_description', 'om_sunrise', 'om_sunset', 'om_precip_sum',
] as const;

/** Metrics rendered as individual tiles rather than a group card. */
export const INDIVIDUAL_METRICS: readonly string[] = [];

/**
 * Metric keys that are indoor-only and should be hidden when viewing neighbor aggregate data.
 * Neighbor stations do not report indoor sensors.
 */
export const NEIGHBOR_EXCLUDED_KEYS = new Set([
  // Indoor sensors — neighbor stations don't report these
  'indoor_temp', 'indoor_feels_like', 'indoor_dew_point',
  'daily_high_temp_in', 'daily_low_temp_in',
  'indoor_humidity',
  // 24-hour max gust — not available from any neighbor provider
  'max_daily_gust',
  // Open-Meteo extended metrics — the aggregated neighbor reading never
  // populates these; they are only available on individual pinned stations
  'om_cloud_cover', 'om_precip_probability', 'om_weather_description',
  'om_sunrise', 'om_sunset', 'om_uv_index_max', 'om_precip_sum',
  'om_wind_speed_max', 'om_wind_gust_max', 'om_wind_dir_dominant',
]);

/** All outdoor metric keys available from neighbor/pinned providers (no indoor sensors). */
export const NEIGHBOR_KEYS = [
  ...TEMPERATURE_METRICS,
  ...HUMIDITY_METRICS,
  ...WIND_METRICS,
  ...SOLAR_METRICS,
  ...RAINFALL_METRICS,
  ...CONDITIONS_METRICS,
].filter((k) => !NEIGHBOR_EXCLUDED_KEYS.has(k));
