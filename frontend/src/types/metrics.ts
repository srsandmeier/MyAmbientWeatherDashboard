// ── Metric registry ─────────────────────────────────────────────────────────

/** Broad classification of a metric's measurement type. Mirrors backend MetricCategory. */
export type MetricCategory = 'scalar' | 'rainfall';

/** Unit family for a metric. Mirrors backend MetricUnitFamily. */
export type MetricUnitFamily =
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'windSpeed'
  | 'windDirection'
  | 'rainfall'
  | 'solarRadiation'
  | 'uvIndex'
  | 'text';

/** Accumulation window for a rainfall metric's snapshot value. Mirrors backend RainfallAggregationMode. */
export type RainfallAggregationMode =
  | 'none'
  | 'event'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

/** Canonical definition of a displayable weather metric. Mirrors backend MetricDefinition. */
export interface MetricDefinition {
  readonly key: string;
  readonly label: string;
  readonly category: MetricCategory;
  readonly ambientField: string;
  readonly unitFamily: MetricUnitFamily;
  readonly displayPrecision: number;
  readonly rainfallAggregation: RainfallAggregationMode;
  readonly isIndoor: boolean;
  readonly isNeighbourEligible: boolean;
  /** True when the value comes from GET /api/dashboard/daily-extremes rather than /current. */
  readonly isAggregate: boolean;
}

/** Canonical registry of all supported displayable weather metrics. Mirrors backend MetricRegistry. */
export const METRIC_REGISTRY: Readonly<Record<string, MetricDefinition>> = {
  outdoor_temp: {
    key: 'outdoor_temp', label: 'Outdoor Temperature', category: 'scalar',
    ambientField: 'tempf', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  indoor_temp: {
    key: 'indoor_temp', label: 'Indoor Temperature', category: 'scalar',
    ambientField: 'tempinf', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: true, isNeighbourEligible: false, isAggregate: false,
  },
  outdoor_humidity: {
    key: 'outdoor_humidity', label: 'Outdoor Humidity', category: 'scalar',
    ambientField: 'humidity', unitFamily: 'humidity', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  indoor_humidity: {
    key: 'indoor_humidity', label: 'Indoor Humidity', category: 'scalar',
    ambientField: 'humidityin', unitFamily: 'humidity', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: true, isNeighbourEligible: false, isAggregate: false,
  },
  pressure: {
    key: 'pressure', label: 'Barometric Pressure', category: 'scalar',
    ambientField: 'baromrelin', unitFamily: 'pressure', displayPrecision: 2,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  uv_index: {
    key: 'uv_index', label: 'UV Index', category: 'scalar',
    ambientField: 'uv', unitFamily: 'uvIndex', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  solar_radiation: {
    key: 'solar_radiation', label: 'Solar Radiation', category: 'scalar',
    ambientField: 'solarradiation', unitFamily: 'solarRadiation', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  wind_dir: {
    key: 'wind_dir', label: 'Wind Direction', category: 'scalar',
    ambientField: 'winddir', unitFamily: 'windDirection', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  wind_speed: {
    key: 'wind_speed', label: 'Wind Speed', category: 'scalar',
    ambientField: 'windspeedmph', unitFamily: 'windSpeed', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  wind_gust: {
    key: 'wind_gust', label: 'Wind Gust', category: 'scalar',
    ambientField: 'windgustmph', unitFamily: 'windSpeed', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  max_daily_gust: {
    key: 'max_daily_gust', label: 'Max Daily Gust', category: 'scalar',
    ambientField: 'maxdailygust', unitFamily: 'windSpeed', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  feels_like: {
    key: 'feels_like', label: 'Outdoor Feels Like', category: 'scalar',
    ambientField: 'feelsLike', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  indoor_feels_like: {
    key: 'indoor_feels_like', label: 'Indoor Feels Like', category: 'scalar',
    ambientField: 'feelsLikein', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: true, isNeighbourEligible: false, isAggregate: false,
  },
  dew_point: {
    key: 'dew_point', label: 'Outdoor Dew Point', category: 'scalar',
    ambientField: 'dewPoint', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  indoor_dew_point: {
    key: 'indoor_dew_point', label: 'Indoor Dew Point', category: 'scalar',
    ambientField: 'dewPointin', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: true, isNeighbourEligible: false, isAggregate: false,
  },
  rainfall_event: {
    key: 'rainfall_event', label: 'Event Rainfall', category: 'rainfall',
    ambientField: 'eventrainin', unitFamily: 'rainfall', displayPrecision: 2,
    rainfallAggregation: 'event', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  rainfall_day: {
    key: 'rainfall_day', label: 'Daily Rainfall', category: 'rainfall',
    ambientField: 'dailyrainin', unitFamily: 'rainfall', displayPrecision: 2,
    rainfallAggregation: 'daily', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  rainfall_week: {
    key: 'rainfall_week', label: 'Weekly Rainfall', category: 'rainfall',
    ambientField: 'weeklyrainin', unitFamily: 'rainfall', displayPrecision: 2,
    rainfallAggregation: 'weekly', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  rainfall_month: {
    key: 'rainfall_month', label: 'Monthly Rainfall', category: 'rainfall',
    ambientField: 'monthlyrainin', unitFamily: 'rainfall', displayPrecision: 2,
    rainfallAggregation: 'monthly', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  rainfall_year: {
    key: 'rainfall_year', label: 'Annual Rainfall', category: 'rainfall',
    ambientField: 'yearlyrainin', unitFamily: 'rainfall', displayPrecision: 2,
    rainfallAggregation: 'yearly', isIndoor: false, isNeighbourEligible: true, isAggregate: false,
  },
  // ── Daily aggregate metrics (computed from stored history) ──────────────────
  daily_high_temp: {
    key: 'daily_high_temp', label: 'Today Outdoor High', category: 'scalar',
    ambientField: '', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
  daily_low_temp: {
    key: 'daily_low_temp', label: 'Today Outdoor Low', category: 'scalar',
    ambientField: '', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
  daily_high_temp_in: {
    key: 'daily_high_temp_in', label: 'Today Indoor High', category: 'scalar',
    ambientField: '', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: true, isNeighbourEligible: false, isAggregate: true,
  },
  daily_low_temp_in: {
    key: 'daily_low_temp_in', label: 'Today Indoor Low', category: 'scalar',
    ambientField: '', unitFamily: 'temperature', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: true, isNeighbourEligible: false, isAggregate: true,
  },
  // ── NWS text fields (WeatherGov only) ───────────────────────────────────────
  nws_sky_conditions: {
    key: 'nws_sky_conditions', label: 'Sky Conditions', category: 'scalar',
    ambientField: 'nws_sky_conditions', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  nws_present_weather: {
    key: 'nws_present_weather', label: 'Present Weather', category: 'scalar',
    ambientField: 'nws_present_weather', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  nws_text_description: {
    key: 'nws_text_description', label: 'Weather Description', category: 'scalar',
    ambientField: 'nws_text_description', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  nws_raw_metar: {
    key: 'nws_raw_metar', label: 'Raw METAR', category: 'scalar',
    ambientField: 'nws_raw_metar', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  // ── Open-Meteo extended metrics (OpenMeteo provider only) ──────────────────
  om_cloud_cover: {
    key: 'om_cloud_cover', label: 'Cloud Cover', category: 'scalar',
    ambientField: 'om_cloud_cover', unitFamily: 'humidity', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  om_precip_probability: {
    key: 'om_precip_probability', label: 'Precip. Probability', category: 'scalar',
    ambientField: 'om_precip_probability', unitFamily: 'humidity', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  om_weather_description: {
    key: 'om_weather_description', label: 'Weather Condition', category: 'scalar',
    ambientField: 'om_weather_description', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  om_sunrise: {
    key: 'om_sunrise', label: 'Sunrise', category: 'scalar',
    ambientField: 'om_sunrise', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  om_sunset: {
    key: 'om_sunset', label: 'Sunset', category: 'scalar',
    ambientField: 'om_sunset', unitFamily: 'text', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: false,
  },
  om_uv_index_max: {
    key: 'om_uv_index_max', label: 'UV Max (Today)', category: 'scalar',
    ambientField: 'om_uv_index_max', unitFamily: 'uvIndex', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
  om_precip_sum: {
    key: 'om_precip_sum', label: 'Precip. (Today)', category: 'rainfall',
    ambientField: 'om_precip_sum', unitFamily: 'rainfall', displayPrecision: 2,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
  om_wind_speed_max: {
    key: 'om_wind_speed_max', label: 'Max Wind (Today)', category: 'scalar',
    ambientField: 'om_wind_speed_max', unitFamily: 'windSpeed', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
  om_wind_gust_max: {
    key: 'om_wind_gust_max', label: 'Max Gust (Today)', category: 'scalar',
    ambientField: 'om_wind_gust_max', unitFamily: 'windSpeed', displayPrecision: 1,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
  om_wind_dir_dominant: {
    key: 'om_wind_dir_dominant', label: 'Dominant Wind (Today)', category: 'scalar',
    ambientField: 'om_wind_dir_dominant', unitFamily: 'windDirection', displayPrecision: 0,
    rainfallAggregation: 'none', isIndoor: false, isNeighbourEligible: false, isAggregate: true,
  },
} as const;

// ── Metric history ───────────────────────────────────────────────────────────

/** Valid preset range identifiers for metric history queries. */
export type MetricHistoryRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'custom' | 'date';

/** Aggregation resolution for metric history. */
export type MetricHistoryGranularity = 'auto' | 'raw' | 'hour' | 'day';

/** Supported history data source in Phase 8. */
export type MetricHistorySource = 'my';

/** A single time-series data point. */
export interface MetricHistoryPoint {
  readonly timestampUtc: string;
  readonly value: number | null;
}

/** Chart-ready metric history response from GET /api/metrics/{metricKey}/history. */
export interface MetricHistoryResponse {
  readonly metricKey: string;
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly range: string;
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly granularity: 'raw' | 'hour' | 'day';
  readonly unit: string;
  readonly points: readonly MetricHistoryPoint[];
  readonly warnings: readonly string[];
}

/** Query parameters for GET /api/metrics/{metricKey}/history. */
export interface MetricHistoryParams {
  readonly range?: MetricHistoryRange;
  readonly deviceId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly date?: string;
  readonly granularity?: MetricHistoryGranularity;
  readonly source?: MetricHistorySource;
}
