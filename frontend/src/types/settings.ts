export interface AmbientCredentialStatusDto {
  readonly hasCredentials: boolean;
}

export interface UserPreferencesDto {
  readonly temperatureUnit: 'F' | 'C';
  readonly speedUnit: 'mph' | 'kmh' | 'ms';
  readonly pressureUnit: 'inhg' | 'hpa' | 'mbar';
  readonly rainfallUnit: 'in' | 'mm';
  readonly distanceUnit: 'mi' | 'km';
  readonly theme: 'light' | 'dark' | 'system';
  readonly dateFormat: 'mdy' | 'dmy' | 'iso';
  readonly temperatureDecimals: 0 | 1 | 2;
  readonly dailyExtremaTimezone: 'utc' | 'local';
}

export interface SettingsDeviceDto {
  readonly macAddress: string;
  readonly name: string | null;
  readonly nickname: string | null;
  readonly isPrimary: boolean;
  readonly displayOnDashboard: boolean;
  readonly selectedMetricKeys: readonly string[] | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly elevationMeters: number | null;
  readonly address: string | null;
  readonly location: string | null;
  readonly lastSyncAtUtc: string | null;
  readonly tz?: string | null;
  readonly isMock?: boolean;
  readonly sourceKind?: 'ambient' | 'public' | 'pinned';
  readonly provider?: string;
  readonly sourceId?: string;
}

export interface UpdateDeviceSettingsRequest {
  readonly nickname?: string | null;
  readonly isPrimary?: boolean;
  readonly displayOnDashboard?: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
}

export interface UpdatePreferencesRequest {
  readonly temperatureUnit: string;
  readonly speedUnit: string;
  readonly pressureUnit: string;
  readonly rainfallUnit: string;
  readonly distanceUnit: string;
  readonly theme: string;
  readonly dateFormat: string;
  readonly temperatureDecimals: number;
  readonly dailyExtremaTimezone: string;
}

export interface SaveCredentialsRequest {
  readonly apiKey: string;
  readonly applicationKey: string;
}

/** Metric keys available for per-device selection. Full definitions live in METRIC_REGISTRY (types/metrics.ts). */
export const ALLOWED_METRIC_KEYS = [
  'outdoor_temp',
  'indoor_temp',
  'outdoor_humidity',
  'indoor_humidity',
  'pressure',
  'uv_index',
  'solar_radiation',
  'wind_dir',
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
  'daily_high_temp',
  'daily_low_temp',
  'daily_high_temp_in',
  'daily_low_temp_in',
  'nws_sky_conditions',
  'nws_present_weather',
  'nws_text_description',
  'nws_raw_metar',
  // ── Open-Meteo extended metrics ──────────────────────────────────────────────
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
] as const;

export type MetricKey = (typeof ALLOWED_METRIC_KEYS)[number];

export const METRIC_KEY_LABELS: Record<MetricKey, string> = {
  outdoor_temp: 'Outdoor Temp',
  indoor_temp: 'Indoor Temp',
  outdoor_humidity: 'Outdoor Humidity',
  indoor_humidity: 'Indoor Humidity',
  pressure: 'Pressure',
  uv_index: 'UV Index',
  solar_radiation: 'Solar Radiation',
  wind_dir: 'Wind Direction',
  wind_speed: 'Wind Speed',
  wind_gust: 'Wind Gust',
  max_daily_gust: 'Max Daily Gust',
  feels_like: 'Outdoor Feels Like',
  indoor_feels_like: 'Indoor Feels Like',
  dew_point: 'Outdoor Dew Point',
  indoor_dew_point: 'Indoor Dew Point',
  rainfall_event: 'Last Rain Event',
  rainfall_day: 'Daily Rainfall',
  rainfall_week: 'Weekly Rainfall',
  rainfall_month: 'Monthly Rainfall',
  rainfall_year: 'Yearly Rainfall',
  daily_high_temp: 'Today Outdoor High',
  daily_low_temp: 'Today Outdoor Low',
  daily_high_temp_in: 'Today Indoor High',
  daily_low_temp_in: 'Today Indoor Low',
  nws_sky_conditions: 'Sky Conditions',
  nws_present_weather: 'Present Weather',
  nws_text_description: 'Weather Description',
  nws_raw_metar: 'Raw METAR',
  om_cloud_cover: 'Cloud Cover',
  om_precip_probability: 'Precip. Probability',
  om_weather_description: 'Weather Condition',
  om_sunrise: 'Sunrise',
  om_sunset: 'Sunset',
  om_uv_index_max: 'UV Max (Today)',
  om_precip_sum: 'Precip. (Today)',
  om_wind_speed_max: 'Max Wind (Today)',
  om_wind_gust_max: 'Max Gust (Today)',
  om_wind_dir_dominant: 'Dominant Wind (Today)',
};
