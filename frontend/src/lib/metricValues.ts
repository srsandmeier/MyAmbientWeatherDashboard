import type { CurrentReadingDto } from '../types/dashboard';

/** Maps a text/string metric key to the corresponding string value from a current reading. */
export function getMetricStringValue(reading: CurrentReadingDto, key: string): string | null {
  switch (key) {
    case 'nws_sky_conditions': return reading.nwsSkyConditions ?? null;
    case 'nws_present_weather': return reading.nwsPresentWeather ?? null;
    case 'nws_text_description': return reading.nwsTextDescription ?? null;
    case 'nws_raw_metar': return reading.nwsRawMetar ?? null;
    case 'om_weather_description': return reading.omWeatherDescription ?? null;
    case 'om_sunrise':             return reading.omSunrise ?? null;
    case 'om_sunset':              return reading.omSunset ?? null;
    default: return null;
  }
}

/** Maps a metric registry key to the corresponding raw value from a current reading. */
export function getMetricValue(reading: CurrentReadingDto, key: string): number | null {
  switch (key) {
    case 'outdoor_temp': return reading.tempF;
    case 'indoor_temp': return reading.tempInF;
    case 'outdoor_humidity': return reading.humidity;
    case 'indoor_humidity': return reading.humidityIn;
    case 'pressure': return reading.baromRelIn;
    case 'wind_dir': return reading.windDir;
    case 'uv_index': return reading.uv;
    case 'solar_radiation': return reading.solarRadiation;
    case 'wind_speed': return reading.windSpeedMph;
    case 'wind_gust': return reading.windGustMph;
    case 'max_daily_gust': return reading.maxDailyGust;
    case 'feels_like': return reading.feelsLike;
    case 'indoor_feels_like': return reading.feelsLikeIn;
    case 'dew_point': return reading.dewPoint;
    case 'indoor_dew_point': return reading.dewPointIn;
    case 'rainfall_event': return reading.eventRainIn;
    case 'rainfall_day': return reading.dailyRainIn;
    case 'rainfall_week': return reading.weeklyRainIn;
    case 'rainfall_month': return reading.monthlyRainIn;
    case 'rainfall_year': return reading.yearlyRainIn;
    case 'om_cloud_cover': return reading.omCloudCover ?? null;
    case 'om_precip_probability': return reading.omPrecipProbability ?? null;
    case 'om_uv_index_max': return reading.omUvIndexMax ?? null;
    case 'om_precip_sum': return reading.omPrecipSumIn ?? null;
    case 'om_wind_speed_max': return reading.omWindSpeedMax ?? null;
    case 'om_wind_gust_max': return reading.omWindGustMax ?? null;
    case 'om_wind_dir_dominant': return reading.omWindDirDominant ?? null;
    default: return null;
  }
}
