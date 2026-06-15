import { describe, expect, it } from 'vitest';
import { publicSourceDisplayName, type PublicWeatherSourceDto } from './publicSources';

function makeSource(displayLabel: string, provider: PublicWeatherSourceDto['provider'] = 'OpenMeteo'): PublicWeatherSourceDto {
  return {
    id: 'source-id',
    provider,
    sourceId: 'source-key',
    displayLabel,
    latitude: 0,
    longitude: 0,
    timezone: null,
    isEnabled: true,
    createdAtUtc: '2026-06-09T00:00:00Z',
    updatedAtUtc: '2026-06-09T00:00:00Z',
  };
}

describe('publicSourceDisplayName', () => {
  it('renders Open-Meteo labels with one provider prefix and a dash separator', () => {
    expect(publicSourceDisplayName(makeSource('Open-Meteo - Generated place'))).toBe('Open-Meteo - Generated place');
    expect(publicSourceDisplayName(makeSource('Open-Meteo — Generated place'))).toBe('Open-Meteo - Generated place');
    expect(publicSourceDisplayName(makeSource('Generated place'))).toBe('Open-Meteo - Generated place');
  });

  it('renders Weather.gov labels with one provider prefix and a dash separator', () => {
    expect(publicSourceDisplayName(makeSource('Weather.gov.Generated station', 'WeatherGov')))
      .toBe('Weather.gov - Generated station');
    expect(publicSourceDisplayName(makeSource('Generated station', 'WeatherGov'))).toBe('Weather.gov - Generated station');
  });
});
