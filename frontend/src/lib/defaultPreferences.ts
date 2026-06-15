import type { UserPreferencesDto } from '../types/settings';

/** Default display preferences used when saved preferences are unavailable. */
export const DEFAULT_USER_PREFERENCES: UserPreferencesDto = {
  temperatureUnit: 'F',
  speedUnit: 'mph',
  pressureUnit: 'inhg',
  rainfallUnit: 'in',
  distanceUnit: 'mi',
  theme: 'system',
  dateFormat: 'mdy',
  temperatureDecimals: 1,
  dailyExtremaTimezone: 'local',
};
