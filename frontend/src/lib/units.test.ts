import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  convertTemperature, temperatureLabel,
  convertWindSpeed, windSpeedLabel,
  convertPressure, pressureLabel,
  convertRainfall, rainfallLabel,
  formatDateByPreference,
  formatFreshness,
  formatMetricValue,
} from './units';
import type { UserPreferencesDto } from '../types/settings';

const prefs: UserPreferencesDto = {
  temperatureUnit: 'F',
  speedUnit: 'mph',
  pressureUnit: 'inhg',
  rainfallUnit: 'in',
  distanceUnit: 'mi',
  theme: 'system',
  dateFormat: 'mdy',
  temperatureDecimals: 1,
        dailyExtremaTimezone: 'utc' as const,
};

// ── Temperature ──────────────────────────────────────────────────────────────

describe('convertTemperature', () => {
  it('returns null for null input', () => { expect(convertTemperature(null, 'C')).toBeNull(); });
  it('converts 32 °F to 0 °C', () => { expect(convertTemperature(32, 'C')).toBeCloseTo(0); });
  it('converts 212 °F to 100 °C', () => { expect(convertTemperature(212, 'C')).toBeCloseTo(100); });
  it('converts -40 °F to -40 °C', () => { expect(convertTemperature(-40, 'C')).toBeCloseTo(-40); });
  it('returns value as-is for F', () => { expect(convertTemperature(72.5, 'F')).toBe(72.5); });
});

describe('temperatureLabel', () => {
  it('returns °F for F', () => { expect(temperatureLabel('F')).toBe('°F'); });
  it('returns °C for C', () => { expect(temperatureLabel('C')).toBe('°C'); });
});

// ── Wind speed ───────────────────────────────────────────────────────────────

describe('convertWindSpeed', () => {
  it('returns null for null input', () => { expect(convertWindSpeed(null, 'kmh')).toBeNull(); });
  it('returns mph value as-is', () => { expect(convertWindSpeed(60, 'mph')).toBe(60); });
  it('converts 60 mph to km/h', () => { expect(convertWindSpeed(60, 'kmh')).toBeCloseTo(96.56, 1); });
  it('converts 60 mph to m/s', () => { expect(convertWindSpeed(60, 'ms')).toBeCloseTo(26.82, 1); });
});

describe('windSpeedLabel', () => {
  it('returns mph', () => { expect(windSpeedLabel('mph')).toBe('mph'); });
  it('returns km/h', () => { expect(windSpeedLabel('kmh')).toBe('km/h'); });
  it('returns m/s', () => { expect(windSpeedLabel('ms')).toBe('m/s'); });
});

// ── Pressure ─────────────────────────────────────────────────────────────────

describe('convertPressure', () => {
  it('returns null for null input', () => { expect(convertPressure(null, 'hpa')).toBeNull(); });
  it('returns inHg value as-is', () => { expect(convertPressure(29.92, 'inhg')).toBe(29.92); });
  it('converts 29.92 inHg to hPa', () => { expect(convertPressure(29.92, 'hpa')).toBeCloseTo(1013.25, 0); });
  it('converts 29.92 inHg to mbar (same as hPa)', () => { expect(convertPressure(29.92, 'mbar')).toBeCloseTo(1013.25, 0); });
});

describe('pressureLabel', () => {
  it('returns inHg', () => { expect(pressureLabel('inhg')).toBe('inHg'); });
  it('returns hPa', () => { expect(pressureLabel('hpa')).toBe('hPa'); });
  it('returns mbar', () => { expect(pressureLabel('mbar')).toBe('mbar'); });
});

// ── Rainfall ─────────────────────────────────────────────────────────────────

describe('convertRainfall', () => {
  it('returns null for null input', () => { expect(convertRainfall(null, 'mm')).toBeNull(); });
  it('returns inches value as-is', () => { expect(convertRainfall(1.5, 'in')).toBe(1.5); });
  it('converts 1 inch to 25.4 mm', () => { expect(convertRainfall(1, 'mm')).toBeCloseTo(25.4); });
});

describe('rainfallLabel', () => {
  it('returns in', () => { expect(rainfallLabel('in')).toBe('in'); });
  it('returns mm', () => { expect(rainfallLabel('mm')).toBe('mm'); });
});

// ── Date formatting ───────────────────────────────────────────────────────────

describe('formatDateByPreference', () => {
  it('returns — for null', () => { expect(formatDateByPreference(null, 'mdy')).toBe('—'); });
  it('returns — for invalid date', () => { expect(formatDateByPreference('not-a-date', 'iso')).toBe('—'); });
  it('formats as MM/DD/YYYY (mdy)', () => {
    expect(formatDateByPreference('2026-05-15T00:00:00Z', 'mdy')).toBe('05/15/2026');
  });
  it('formats as DD/MM/YYYY (dmy)', () => {
    expect(formatDateByPreference('2026-05-15T00:00:00Z', 'dmy')).toBe('15/05/2026');
  });
  it('formats as YYYY-MM-DD (iso)', () => {
    expect(formatDateByPreference('2026-05-15T00:00:00Z', 'iso')).toBe('2026-05-15');
  });
});

// ── Freshness ─────────────────────────────────────────────────────────────────

describe('formatFreshness', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns — for null', () => { expect(formatFreshness(null)).toBe('—'); });

  it('shows seconds when age < 60s', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    const received = new Date('2026-06-01T11:59:48Z').toISOString();
    expect(formatFreshness(received)).toBe('12s ago');
  });

  it('shows minutes when age < 60m', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    const received = new Date('2026-06-01T11:55:00Z').toISOString();
    expect(formatFreshness(received)).toBe('5m ago');
  });

  it('shows hours when age >= 60m', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    const received = new Date('2026-06-01T10:00:00Z').toISOString();
    expect(formatFreshness(received)).toBe('2h ago');
  });
});

// ── formatMetricValue ─────────────────────────────────────────────────────────

describe('formatMetricValue', () => {
  it('returns — for null value', () => {
    const result = formatMetricValue(null, 'temperature', prefs);
    expect(result.value).toBe('—');
    expect(result.unit).toBe('°F');
  });

  it('formats temperature in F', () => {
    const result = formatMetricValue(72.5, 'temperature', prefs);
    expect(result.value).toBe('72.5');
    expect(result.unit).toBe('°F');
  });

  it('formats temperature in C', () => {
    const result = formatMetricValue(32, 'temperature', { ...prefs, temperatureUnit: 'C' });
    expect(result.value).toBe('0.0');
    expect(result.unit).toBe('°C');
  });

  it('formats humidity with 0 decimals', () => {
    const result = formatMetricValue(62, 'humidity', prefs);
    expect(result.value).toBe('62');
    expect(result.unit).toBe('%');
  });

  it('formats pressure in inHg with 2 decimals', () => {
    const result = formatMetricValue(29.92, 'pressure', prefs);
    expect(result.value).toBe('29.92');
    expect(result.unit).toBe('inHg');
  });

  it('formats wind speed in mph', () => {
    const result = formatMetricValue(15.5, 'windSpeed', prefs);
    expect(result.value).toBe('15.5');
    expect(result.unit).toBe('mph');
  });

  it('formats rainfall in inches with 2 decimals', () => {
    const result = formatMetricValue(0.25, 'rainfall', prefs);
    expect(result.value).toBe('0.25');
    expect(result.unit).toBe('in');
  });

  it('formats rainfall in mm', () => {
    const result = formatMetricValue(1, 'rainfall', { ...prefs, rainfallUnit: 'mm' });
    expect(result.value).toBe('25.40');
    expect(result.unit).toBe('mm');
  });

  it('formats solar radiation with no unit', () => {
    const result = formatMetricValue(500, 'solarRadiation', prefs);
    expect(result.value).toBe('500.0');
    expect(result.unit).toBe('W/m²');
  });

  it('formats uv index with 0 decimals and no unit', () => {
    const result = formatMetricValue(8, 'uvIndex', prefs);
    expect(result.value).toBe('8');
    expect(result.unit).toBe('');
  });

  it('respects precision override', () => {
    const result = formatMetricValue(72.456, 'temperature', prefs, 2);
    expect(result.value).toBe('72.46');
  });

  it('text family passes string through with empty unit', () => {
    const result = formatMetricValue('FEW @ 600ft, BKN @ 3,000ft', 'text', prefs);
    expect(result.value).toBe('FEW @ 600ft, BKN @ 3,000ft');
    expect(result.unit).toBe('');
  });

  it('text family returns — for null', () => {
    const result = formatMetricValue(null, 'text', prefs);
    expect(result.value).toBe('—');
    expect(result.unit).toBe('');
  });

  it('text family returns — for undefined', () => {
    const result = formatMetricValue(undefined, 'text', prefs);
    expect(result.value).toBe('—');
    expect(result.unit).toBe('');
  });
});
