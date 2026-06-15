import { describe, expect, it } from 'vitest';
import { getMetricHistoryPath, isHistoryMetricKey } from './historyMetrics';
import { testDeviceId } from '../test/weatherTestData';

describe('historyMetrics', () => {
  it('recognizes chartable owned-station history metrics', () => {
    expect(isHistoryMetricKey('outdoor_temp')).toBe(true);
    expect(isHistoryMetricKey('rainfall_day')).toBe(true);
    expect(isHistoryMetricKey('max_daily_gust')).toBe(true);
  });

  it('rejects dashboard-only and text metrics', () => {
    expect(isHistoryMetricKey('daily_high_temp')).toBe(false);
    expect(isHistoryMetricKey('nws_sky_conditions')).toBe(false);
  });

  it('builds a station-specific history path', () => {
    expect(getMetricHistoryPath('outdoor_temp', testDeviceId)).toBe(
      `/metrics/outdoor_temp?deviceId=${encodeURIComponent(testDeviceId)}`,
    );
  });
});
