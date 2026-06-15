import { describe, it, expect } from 'vitest';
import { METRIC_REGISTRY } from './metrics';
import { ALLOWED_METRIC_KEYS } from './settings';

const EXPECTED_KEYS = [
  'outdoor_temp', 'indoor_temp',
  'outdoor_humidity', 'indoor_humidity',
  'pressure', 'uv_index', 'solar_radiation',
  'wind_dir', 'wind_speed', 'wind_gust', 'max_daily_gust',
  'feels_like', 'indoor_feels_like',
  'dew_point', 'indoor_dew_point',
  'rainfall_event', 'rainfall_day', 'rainfall_week', 'rainfall_month', 'rainfall_year',
  'daily_high_temp', 'daily_low_temp', 'daily_high_temp_in', 'daily_low_temp_in',
  'nws_sky_conditions', 'nws_present_weather', 'nws_text_description', 'nws_raw_metar',
  'om_cloud_cover', 'om_precip_probability', 'om_weather_description',
  'om_sunrise', 'om_sunset', 'om_uv_index_max', 'om_precip_sum',
  'om_wind_speed_max', 'om_wind_gust_max', 'om_wind_dir_dominant',
] as const;

describe('METRIC_REGISTRY', () => {
  it('contains exactly the expected number of entries', () => {
    expect(Object.keys(METRIC_REGISTRY)).toHaveLength(EXPECTED_KEYS.length);
  });

  it('contains all expected keys', () => {
    for (const key of EXPECTED_KEYS) {
      expect(METRIC_REGISTRY).toHaveProperty(key);
    }
  });

  it('has no duplicate keys', () => {
    const keys = Object.keys(METRIC_REGISTRY);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('each definition key matches its dictionary key', () => {
    for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
      expect(def.key).toBe(key);
    }
  });

  it('all definitions have a non-empty label and valid display precision', () => {
    for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
      expect(def.label, `label for ${key}`).toBeTruthy();
      expect(def.displayPrecision, `displayPrecision for ${key}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('non-aggregate definitions have a non-empty ambientField', () => {
    const liveEntries = Object.entries(METRIC_REGISTRY).filter(([, def]) => !def.isAggregate);
    for (const [key, def] of liveEntries) {
      expect(def.ambientField, `ambientField for ${key}`).toBeTruthy();
    }
  });

  it('aggregate metrics have isAggregate true and temperature unit family', () => {
    const aggregateKeys = ['daily_high_temp', 'daily_low_temp', 'daily_high_temp_in', 'daily_low_temp_in'];
    for (const key of aggregateKeys) {
      expect(METRIC_REGISTRY[key].isAggregate, `${key} should be aggregate`).toBe(true);
      expect(METRIC_REGISTRY[key].unitFamily).toBe('temperature');
      expect(METRIC_REGISTRY[key].isNeighbourEligible).toBe(false);
    }
  });

  it('rainfall keys have rainfall category and non-none aggregation', () => {
    const rainfallKeys = ['rainfall_event', 'rainfall_day', 'rainfall_week', 'rainfall_month', 'rainfall_year'];
    for (const key of rainfallKeys) {
      expect(METRIC_REGISTRY[key].category).toBe('rainfall');
      expect(METRIC_REGISTRY[key].rainfallAggregation).not.toBe('none');
    }
  });

  it('scalar keys have scalar category and none aggregation', () => {
    const scalarKeys = ['outdoor_temp', 'indoor_temp', 'outdoor_humidity', 'indoor_humidity',
      'pressure', 'uv_index', 'solar_radiation', 'wind_dir', 'wind_speed'];
    for (const key of scalarKeys) {
      expect(METRIC_REGISTRY[key].category).toBe('scalar');
      expect(METRIC_REGISTRY[key].rainfallAggregation).toBe('none');
    }
  });

  it('indoor metrics are marked isIndoor', () => {
    expect(METRIC_REGISTRY.indoor_temp.isIndoor).toBe(true);
    expect(METRIC_REGISTRY.indoor_humidity.isIndoor).toBe(true);
  });

  it('outdoor metrics are not marked isIndoor', () => {
    expect(METRIC_REGISTRY.outdoor_temp.isIndoor).toBe(false);
    expect(METRIC_REGISTRY.outdoor_humidity.isIndoor).toBe(false);
    expect(METRIC_REGISTRY.wind_speed.isIndoor).toBe(false);
  });

  it('every ALLOWED_METRIC_KEY from device settings exists in the registry', () => {
    for (const key of ALLOWED_METRIC_KEYS) {
      expect(METRIC_REGISTRY, `ALLOWED_METRIC_KEY '${key}' must exist in METRIC_REGISTRY`).toHaveProperty(key);
    }
  });
});
