import { CloudSun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import type { CurrentReadingDto } from '../../types/dashboard';
import type { UserPreferencesDto } from '../../types/settings';

interface StringConditionsRow {
  readonly key: string;
  readonly label: string;
  readonly kind: 'string';
  readonly field: keyof {
    [K in keyof CurrentReadingDto as CurrentReadingDto[K] extends string | null | undefined ? K : never]: unknown;
  };
}

interface NumericConditionsRow {
  readonly key: string;
  readonly label: string;
  readonly kind: 'numeric';
  readonly field: keyof {
    [K in keyof CurrentReadingDto as CurrentReadingDto[K] extends number | null | undefined ? K : never]: unknown;
  };
  readonly unitFamily: Parameters<typeof formatMetricValue>[1];
  readonly precision?: number;
}

type ConditionsRow = StringConditionsRow | NumericConditionsRow;

const ROWS: readonly ConditionsRow[] = [
  { key: 'nws_sky_conditions',    label: 'Sky Conditions',    kind: 'string',  field: 'nwsSkyConditions'   },
  { key: 'nws_present_weather',   label: 'Present Weather',   kind: 'string',  field: 'nwsPresentWeather'  },
  { key: 'nws_text_description',  label: 'Weather Description', kind: 'string', field: 'nwsTextDescription' },
  { key: 'nws_raw_metar',         label: 'Raw METAR',         kind: 'string',  field: 'nwsRawMetar'        },
  { key: 'om_weather_description', label: 'Weather Condition', kind: 'string', field: 'omWeatherDescription' },
  { key: 'om_sunrise',            label: 'Sunrise',           kind: 'string',  field: 'omSunrise'          },
  { key: 'om_sunset',             label: 'Sunset',            kind: 'string',  field: 'omSunset'           },
  { key: 'om_precip_sum',         label: 'Precip. (Today)',   kind: 'numeric', field: 'omPrecipSumIn', unitFamily: 'rainfall', precision: 2 },
];

interface ConditionsTileProps {
  readonly reading: CurrentReadingDto | undefined;
  readonly preferences: UserPreferencesDto;
  readonly selectedKeys: readonly string[];
  readonly stationLabel?: string;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly className?: string;
}

/** Dashboard tile that groups Weather.gov/NWS and Open-Meteo condition text fields. */
export function ConditionsTile({
  reading,
  preferences,
  selectedKeys,
  stationLabel,
  isLoading = false,
  isError = false,
  className,
}: ConditionsTileProps) {
  const rows = selectedKeys
    .map((key) => ROWS.find((row) => row.key === key))
    .filter((row): row is ConditionsRow => row !== undefined);

  function renderValue(row: ConditionsRow): string {
    if (isError || !reading) return '—';
    if (row.kind === 'string') {
      const val = reading[row.field];
      return formatMetricValue(val ?? null, 'text', preferences).value;
    }
    const val = reading[row.field];
    return formatMetricValue(val ?? null, row.unitFamily, preferences, row.precision).value;
  }

  return (
    <Card className={className} data-test-id="dashboard-conditions-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Conditions</CardTitle>
            <CardDescription>{stationLabel ?? reading?.deviceName ?? reading?.deviceId ?? 'No station'}</CardDescription>
          </div>
          <CloudSun className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-test-id="dashboard-conditions-loading">Loading</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No condition metrics selected.</p>
        ) : (
          <>
            <dl className="space-y-3" aria-live="polite">
              {rows.map((r) => (
                <div key={r.key}>
                  <dt className="text-xs text-muted-foreground">{r.label}</dt>
                  <dd className="break-words text-sm font-medium" data-test-id="dashboard-conditions-value">
                    {renderValue(r)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-conditions-freshness">
              Updated {formatFreshness(reading?.receivedAtUtc)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
