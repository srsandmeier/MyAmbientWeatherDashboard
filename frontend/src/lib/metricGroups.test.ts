import { describe, expect, it } from 'vitest';
import { NEIGHBOR_EXCLUDED_KEYS, NEIGHBOR_KEYS } from './metricGroups';

describe('NEIGHBOR_KEYS', () => {
  it('excludes Open-Meteo extended metrics the aggregated neighbor reading never populates', () => {
    const omKeys = NEIGHBOR_KEYS.filter((key) => key.startsWith('om_'));
    expect(omKeys).toEqual([]);
  });

  it('excludes indoor-only metrics', () => {
    for (const key of NEIGHBOR_KEYS) {
      expect(NEIGHBOR_EXCLUDED_KEYS.has(key)).toBe(false);
    }
  });

  it('keeps core outdoor metrics available', () => {
    expect(NEIGHBOR_KEYS).toContain('outdoor_temp');
    expect(NEIGHBOR_KEYS).toContain('wind_speed');
    expect(NEIGHBOR_KEYS).toContain('outdoor_humidity');
  });
});
