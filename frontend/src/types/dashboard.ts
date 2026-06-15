import type { CustomLayoutItem, LayoutMode } from './customLayout';

/** Matches backend CurrentReadingDto */
export interface CurrentReadingDto {
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly timestampUtc: string;
  readonly receivedAtUtc: string;
  readonly tempF: number | null;
  /** Outdoor sensor battery status: 1 = OK, 0 = Low/Critical. */
  readonly battOut: number | null;
  readonly tempInF: number | null;
  readonly feelsLike: number | null;
  readonly feelsLikeIn: number | null;
  readonly dewPoint: number | null;
  readonly dewPointIn: number | null;
  readonly humidity: number | null;
  readonly humidityIn: number | null;
  readonly baromRelIn: number | null;
  readonly baromAbsIn: number | null;
  readonly windDir: number | null;
  readonly windSpeedMph: number | null;
  readonly windGustMph: number | null;
  readonly maxDailyGust: number | null;
  readonly solarRadiation: number | null;
  readonly uv: number | null;
  /** 24-hour high temperature in °F. Populated for pinned/neighbor stations; null for owned stations. */
  readonly dailyHighTempF: number | null;
  /** 24-hour low temperature in °F. Populated for pinned/neighbor stations; null for owned stations. */
  readonly dailyLowTempF: number | null;
  readonly nwsSkyConditions: string | null;
  readonly nwsPresentWeather: string | null;
  readonly nwsTextDescription: string | null;
  readonly nwsRawMetar: string | null;
  /** Open-Meteo extended fields — null for all non-OpenMeteo sources. */
  readonly omCloudCover: number | null;
  readonly omPrecipProbability: number | null;
  readonly omWeatherDescription: string | null;
  readonly omSunrise: string | null;
  readonly omSunset: string | null;
  readonly omUvIndexMax: number | null;
  readonly omPrecipSumIn: number | null;
  readonly omWindSpeedMax: number | null;
  readonly omWindGustMax: number | null;
  readonly omWindDirDominant: number | null;
  readonly hourlyRainIn: number | null;
  readonly eventRainIn: number | null;
  readonly dailyRainIn: number | null;
  readonly weeklyRainIn: number | null;
  readonly monthlyRainIn: number | null;
  readonly yearlyRainIn: number | null;
  readonly totalRainIn: number | null;
  readonly lastRain: string | null;
  readonly tz: string | null;
  /** Data source: `"own"` for the user's own station, `"neighbors"` for aggregated nearby stations. Absent on cached entries pre-dating this field; treat absence as `"own"`. */
  readonly source?: string;
}

/** Matches backend ReadingUpdatedEventDto */
export interface ReadingUpdatedEventDto {
  readonly reading: CurrentReadingDto;
}

/** Matches backend DashboardRainfallDto — rainfall accumulation snapshot from the current reading. */
export interface DashboardRainfallDto {
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly timestampUtc: string | null;
  readonly receivedAtUtc: string;
  readonly eventRainIn: number | null;
  readonly dailyRainIn: number | null;
  readonly weeklyRainIn: number | null;
  readonly monthlyRainIn: number | null;
  readonly yearlyRainIn: number | null;
  readonly lastRain: string | null;
}

/** Matches backend DailyExtremaDto — daily high/low temperatures computed from stored readings. */
export interface DailyExtremaDto {
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly dateUtc: string;
  readonly dailyHighTempF: number | null;
  readonly dailyLowTempF: number | null;
  readonly dailyHighTempInF: number | null;
  readonly dailyLowTempInF: number | null;
}

/** Matches backend DashboardTileDto — a single dashboard tile definition. */
export interface DashboardTileDto {
  readonly i: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly type: 'metric' | 'rainfall' | 'status' | 'temperature' | 'humidity' | 'wind' | 'solar' | 'conditions';
  readonly metricKey?: string | null;
  readonly deviceId?: string | null;
}

/** PUT /api/dashboard/layout request body — matches backend DashboardLayoutPayloadDto. */
export interface SaveDashboardLayoutRequest {
  readonly layoutMode: LayoutMode;
  readonly tiles: readonly DashboardTileDto[];
  readonly customItems: readonly CustomLayoutItem[];
}

/** Matches backend DashboardLayoutDto — user's active dashboard layout. */
export interface DashboardLayoutDto {
  readonly id: string;
  readonly name: string;
  readonly layoutMode: LayoutMode;
  readonly tiles: readonly DashboardTileDto[];
  readonly customItems: readonly CustomLayoutItem[];
  readonly updatedAtUtc: string;
}
