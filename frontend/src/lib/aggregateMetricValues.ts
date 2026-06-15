import type { DailyExtremaDto } from '../types/dashboard';

/** Maps an aggregate metric registry key to the corresponding value from the daily extrema DTO. */
export function getAggregateMetricValue(extrema: DailyExtremaDto, key: string): number | null {
  switch (key) {
    case 'daily_high_temp': return extrema.dailyHighTempF;
    case 'daily_low_temp': return extrema.dailyLowTempF;
    case 'daily_high_temp_in': return extrema.dailyHighTempInF;
    case 'daily_low_temp_in': return extrema.dailyLowTempInF;
    default: return null;
  }
}
