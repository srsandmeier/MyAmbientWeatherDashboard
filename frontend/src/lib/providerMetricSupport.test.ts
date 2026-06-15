import { describe, expect, it } from 'vitest';
import { getProviderSupportedMetricKeys, normalizeSupportedMetricKeys } from './providerMetricSupport';

describe('providerMetricSupport', () => {
  it('pinned Weather.gov includes daily extremes from maxTemperatureLast24Hours', () => {
    const keys = getProviderSupportedMetricKeys('pinned', 'WeatherGov');

    expect(keys).toContain('outdoor_temp');
    expect(keys).toContain('pressure');
    expect(keys).toContain('wind_speed');
    expect(keys).toContain('daily_high_temp');
    expect(keys).toContain('daily_low_temp');
    // NWS does not provide these for pinned stations
    expect(keys).not.toContain('uv_index');
    expect(keys).not.toContain('solar_radiation');
    expect(keys).not.toContain('rainfall_day');
    expect(keys).not.toContain('rainfall_event');
  });

  it('pinned Weather.gov includes NWS text fields', () => {
    const keys = getProviderSupportedMetricKeys('pinned', 'WeatherGov');

    expect(keys).toContain('nws_sky_conditions');
    expect(keys).toContain('nws_present_weather');
    expect(keys).toContain('nws_text_description');
    expect(keys).toContain('nws_raw_metar');
  });

  it('public Weather.gov includes NWS text fields', () => {
    const keys = getProviderSupportedMetricKeys('public', 'WeatherGov');

    expect(keys).toContain('nws_sky_conditions');
    expect(keys).toContain('nws_present_weather');
    expect(keys).toContain('nws_text_description');
    expect(keys).toContain('nws_raw_metar');
  });

  it('public Weather.gov does not include daily extremes (PublicSourceService does not map them)', () => {
    const keys = getProviderSupportedMetricKeys('public', 'WeatherGov');

    expect(keys).toContain('outdoor_temp');
    expect(keys).not.toContain('daily_high_temp');
    expect(keys).not.toContain('daily_low_temp');
  });

  it('Open-Meteo and AmbientOpen do not include NWS text fields', () => {
    const openMeteoPublic = getProviderSupportedMetricKeys('public', 'OpenMeteo');
    const openMeteoPinned = getProviderSupportedMetricKeys('pinned', 'OpenMeteo');
    const ambientOpen = getProviderSupportedMetricKeys('pinned', 'AmbientOpen');

    for (const keys of [openMeteoPublic, openMeteoPinned, ambientOpen]) {
      expect(keys).not.toContain('nws_sky_conditions');
      expect(keys).not.toContain('nws_text_description');
    }
  });

  it('public Open-Meteo includes UV but not rainfall or daily extremes', () => {
    const keys = getProviderSupportedMetricKeys('public', 'OpenMeteo');

    expect(keys).toContain('outdoor_temp');
    expect(keys).toContain('uv_index');
    expect(keys).not.toContain('solar_radiation');
    expect(keys).not.toContain('rainfall_day');
    expect(keys).not.toContain('rainfall_event');
    expect(keys).not.toContain('daily_high_temp');
    expect(keys).not.toContain('daily_low_temp');
  });

  it('pinned Open-Meteo includes UV, hourly rainfall_event, and daily extremes', () => {
    const keys = getProviderSupportedMetricKeys('pinned', 'OpenMeteo');

    expect(keys).toContain('outdoor_temp');
    expect(keys).toContain('uv_index');
    expect(keys).toContain('rainfall_event');
    expect(keys).toContain('daily_high_temp');
    expect(keys).toContain('daily_low_temp');
    // OpenMeteo does not have daily accumulations
    expect(keys).not.toContain('rainfall_day');
    expect(keys).not.toContain('solar_radiation');
  });

  it('Ambient Open pinned includes rainfall totals, solar, UV, and rainfall_event', () => {
    const keys = getProviderSupportedMetricKeys('pinned', 'AmbientOpen');

    expect(keys).toContain('rainfall_event');
    expect(keys).toContain('rainfall_day');
    expect(keys).toContain('rainfall_week');
    expect(keys).toContain('rainfall_month');
    expect(keys).toContain('rainfall_year');
    expect(keys).toContain('solar_radiation');
    expect(keys).toContain('uv_index');
    // AmbientOpen does not provide 24h temperature extremes
    expect(keys).not.toContain('daily_high_temp');
    expect(keys).not.toContain('daily_low_temp');
  });

  it('public Open-Meteo includes all om_ extended metrics', () => {
    const keys = getProviderSupportedMetricKeys('public', 'OpenMeteo');

    expect(keys).toContain('om_cloud_cover');
    expect(keys).toContain('om_precip_probability');
    expect(keys).toContain('om_weather_description');
    expect(keys).toContain('om_sunrise');
    expect(keys).toContain('om_sunset');
    expect(keys).toContain('om_uv_index_max');
    expect(keys).toContain('om_precip_sum');
    expect(keys).toContain('om_wind_speed_max');
    expect(keys).toContain('om_wind_gust_max');
    expect(keys).toContain('om_wind_dir_dominant');
  });

  it('pinned Open-Meteo includes all om_ extended metrics', () => {
    const keys = getProviderSupportedMetricKeys('pinned', 'OpenMeteo');

    expect(keys).toContain('om_cloud_cover');
    expect(keys).toContain('om_precip_probability');
    expect(keys).toContain('om_weather_description');
    expect(keys).toContain('om_sunrise');
    expect(keys).toContain('om_sunset');
    expect(keys).toContain('om_uv_index_max');
    expect(keys).toContain('om_precip_sum');
    expect(keys).toContain('om_wind_speed_max');
    expect(keys).toContain('om_wind_gust_max');
    expect(keys).toContain('om_wind_dir_dominant');
  });

  it('WeatherGov and AmbientOpen do not include om_ extended metrics', () => {
    const wgPublic = getProviderSupportedMetricKeys('public', 'WeatherGov');
    const wgPinned = getProviderSupportedMetricKeys('pinned', 'WeatherGov');
    const ambientOpen = getProviderSupportedMetricKeys('pinned', 'AmbientOpen');

    for (const keys of [wgPublic, wgPinned, ambientOpen]) {
      expect(keys).not.toContain('om_cloud_cover');
      expect(keys).not.toContain('om_weather_description');
      expect(keys).not.toContain('om_uv_index_max');
    }
  });

  it('filters stale selections to pinned Weather.gov supported fields', () => {
    const keys = normalizeSupportedMetricKeys(
      ['outdoor_temp', 'solar_radiation', 'rainfall_day', 'wind_speed'],
      getProviderSupportedMetricKeys('pinned', 'WeatherGov') ?? [],
    );

    expect(keys).toEqual(['outdoor_temp', 'wind_speed']);
  });
});
