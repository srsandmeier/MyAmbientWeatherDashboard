import type { UserPreferencesDto } from '../types/settings';
import type { MetricUnitFamily } from '../types/metrics';

// ── Temperature ──────────────────────────────────────────────────────────────

/** Converts °F to °C, or returns the original value when the target unit is F. */
export function convertTemperature(valueF: number | null, unit: 'F' | 'C'): number | null {
  if (valueF === null) return null;
  return unit === 'C' ? (valueF - 32) * (5 / 9) : valueF;
}

export function temperatureLabel(unit: 'F' | 'C'): string {
  return `°${unit}`;
}

// ── Wind direction ───────────────────────────────────────────────────────────

const CARDINAL_POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'] as const;

/** Converts a compass bearing (0–359°) to a 16-point cardinal abbreviation. */
export function degreesToCardinal(degrees: number): string {
  return CARDINAL_POINTS[Math.round(degrees / 22.5) % 16];
}

// ── Wind speed ───────────────────────────────────────────────────────────────

/** Converts mph to km/h or m/s, or returns the original value for mph. */
export function convertWindSpeed(valueMph: number | null, unit: 'mph' | 'kmh' | 'ms'): number | null {
  if (valueMph === null) return null;
  switch (unit) {
    case 'kmh': return valueMph * 1.60934;
    case 'ms': return valueMph * 0.44704;
    case 'mph': return valueMph;
  }
}

export function windSpeedLabel(unit: 'mph' | 'kmh' | 'ms'): string {
  switch (unit) {
    case 'kmh': return 'km/h';
    case 'ms': return 'm/s';
    case 'mph': return 'mph';
  }
}

// ── Pressure ─────────────────────────────────────────────────────────────────

/** Converts inHg to hPa (= mbar), or returns the original value for inHg. */
export function convertPressure(valueInHg: number | null, unit: 'inhg' | 'hpa' | 'mbar'): number | null {
  if (valueInHg === null) return null;
  // 1 inHg = 33.8639 hPa; 1 hPa = 1 mbar exactly
  return unit === 'inhg' ? valueInHg : valueInHg * 33.8639;
}

export function pressureLabel(unit: 'inhg' | 'hpa' | 'mbar'): string {
  switch (unit) {
    case 'hpa': return 'hPa';
    case 'mbar': return 'mbar';
    case 'inhg': return 'inHg';
  }
}

// ── Rainfall ─────────────────────────────────────────────────────────────────

/** Converts inches to mm, or returns the original value for inches. */
export function convertRainfall(valueIn: number | null, unit: 'in' | 'mm'): number | null {
  if (valueIn === null) return null;
  return unit === 'mm' ? valueIn * 25.4 : valueIn;
}

export function rainfallLabel(unit: 'in' | 'mm'): string {
  return unit === 'mm' ? 'mm' : 'in';
}

/** Converts miles to the requested display distance unit. */
export function convertDistance(valueMiles: number | null, unit: 'mi' | 'km'): number | null {
  if (valueMiles === null) return null;
  return unit === 'km' ? valueMiles * 1.609344 : valueMiles;
}

/** Converts a display distance value back to canonical miles. */
export function distanceToMiles(value: number, unit: 'mi' | 'km'): number {
  return unit === 'km' ? value / 1.609344 : value;
}

export function distanceLabel(unit: 'mi' | 'km'): string {
  return unit === 'km' ? 'km' : 'mi';
}

// ── Date / freshness ─────────────────────────────────────────────────────────

/**
 * Formats an ISO date string as MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD
 * according to the user's `dateFormat` preference.
 */
export function formatDateByPreference(
  isoString: string | null | undefined,
  format: 'mdy' | 'dmy' | 'iso',
): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  switch (format) {
    case 'dmy': return `${dd}/${mm}/${yyyy}`;
    case 'iso': return `${yyyy}-${mm}-${dd}`;
    case 'mdy': return `${mm}/${dd}/${yyyy}`;
  }
}

/**
 * Returns a human-friendly relative-time label for how stale a reading is,
 * e.g. "12s ago", "5m ago", "2h ago". Returns "—" for null input.
 */
export function formatFreshness(receivedAtUtc: string | null | undefined): string {
  if (!receivedAtUtc) return '—';
  const ageMs = Date.now() - new Date(receivedAtUtc).getTime();
  if (Number.isNaN(ageMs)) return '—';
  const ageSec = Math.floor(ageMs / 1000);
  if (ageSec < 60) return `${String(ageSec)}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${String(ageMin)}m ago`;
  return `${String(Math.floor(ageMin / 60))}h ago`;
}

// ── Unified display formatter ─────────────────────────────────────────────────

/**
 * Converts and formats a raw Ambient reading value for display according to the user's preferences.
 * Raw values are always in canonical Ambient units (°F, mph, inHg, inches).
 *
 * @param value - Raw value in canonical Ambient units, or null for missing sensors.
 * @param unitFamily - The metric's unit family from {@link MetricDefinition}.
 * @param prefs - User preferences controlling which display unit to use.
 * @param precision - Optional decimal places override; defaults to the family's natural precision.
 * @returns An object with the formatted `value` string and the display `unit` label.
 */
export function formatMetricValue(
  value: string | number | null | undefined,
  unitFamily: MetricUnitFamily,
  prefs: Pick<UserPreferencesDto, 'temperatureUnit' | 'speedUnit' | 'pressureUnit' | 'rainfallUnit' | 'temperatureDecimals'>,
  precision?: number,
): { readonly value: string; readonly unit: string } {
  if (unitFamily === 'text') {
    return { value: value != null ? String(value) : '—', unit: '' };
  }
  const v: number | null = (value as number | null | undefined) ?? null;
  let converted: number | null = null;
  let unit = '';

  switch (unitFamily) {
    case 'temperature':
      converted = convertTemperature(v, prefs.temperatureUnit);
      unit = temperatureLabel(prefs.temperatureUnit);
      break;
    case 'humidity':
      converted = v;
      unit = '%';
      break;
    case 'pressure':
      converted = convertPressure(v, prefs.pressureUnit);
      unit = pressureLabel(prefs.pressureUnit);
      break;
    case 'windSpeed':
      converted = convertWindSpeed(v, prefs.speedUnit);
      unit = windSpeedLabel(prefs.speedUnit);
      break;
    case 'rainfall':
      converted = convertRainfall(v, prefs.rainfallUnit);
      unit = rainfallLabel(prefs.rainfallUnit);
      break;
    case 'solarRadiation':
      converted = v;
      unit = 'W/m²';
      break;
    case 'uvIndex':
      converted = v;
      unit = '';
      break;
    case 'windDirection':
      return v === null
        ? { value: '—', unit: '' }
        : { value: degreesToCardinal(v), unit: `${Math.round(v).toString()}°` };
  }

  if (converted === null) return { value: '—', unit };

  const decimals = precision ?? defaultPrecision(unitFamily, prefs);
  return { value: converted.toFixed(decimals), unit };
}

function defaultPrecision(
  unitFamily: MetricUnitFamily,
  prefs: Pick<UserPreferencesDto, 'pressureUnit' | 'temperatureDecimals'>,
): number {
  switch (unitFamily) {
    case 'temperature': return prefs.temperatureDecimals;
    case 'humidity': return 0;
    case 'pressure': return prefs.pressureUnit === 'inhg' ? 2 : 1;
    case 'windSpeed': return 1;
    case 'rainfall': return 2;
    case 'solarRadiation': return 1;
    case 'uvIndex': return 0;
    case 'windDirection': return 0;
    case 'text': return 0;
  }
}
