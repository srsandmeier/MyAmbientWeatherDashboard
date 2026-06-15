import { Thermometer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { MetricHistoryValueLink } from './MetricHistoryValueLink';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import type { CurrentReadingDto, DailyExtremaDto } from '../../types/dashboard';
import type { UserPreferencesDto } from '../../types/settings';

// Live rows read from CurrentReadingDto.
interface LiveRow {
  readonly key: string;
  readonly label: string;
  readonly source: 'current';
  readonly field: keyof Pick<
    CurrentReadingDto,
    'tempF' | 'feelsLike' | 'dewPoint' | 'tempInF' | 'feelsLikeIn' | 'dewPointIn'
  >;
}

// Aggregate rows read from DailyExtremaDto.
interface AggRow {
  readonly key: string;
  readonly label: string;
  readonly source: 'extrema';
  readonly field: keyof Pick<
    DailyExtremaDto,
    'dailyHighTempF' | 'dailyLowTempF' | 'dailyHighTempInF' | 'dailyLowTempInF'
  >;
}

type TemperatureRow = LiveRow | AggRow;

const ALL_ROWS: readonly TemperatureRow[] = [
  { key: 'outdoor_temp',       label: 'Outdoor',          source: 'current', field: 'tempF' },
  { key: 'feels_like',         label: 'Outdoor Feels',    source: 'current', field: 'feelsLike' },
  { key: 'dew_point',          label: 'Outdoor Dew Pt',   source: 'current', field: 'dewPoint' },
  { key: 'daily_high_temp',    label: 'Today Outdoor Hi', source: 'extrema', field: 'dailyHighTempF' },
  { key: 'daily_low_temp',     label: 'Today Outdoor Lo', source: 'extrema', field: 'dailyLowTempF' },
  { key: 'indoor_temp',        label: 'Indoor',           source: 'current', field: 'tempInF' },
  { key: 'indoor_feels_like',  label: 'Indoor Feels',     source: 'current', field: 'feelsLikeIn' },
  { key: 'indoor_dew_point',   label: 'Indoor Dew Pt',    source: 'current', field: 'dewPointIn' },
  { key: 'daily_high_temp_in', label: 'Today Indoor Hi',  source: 'extrema', field: 'dailyHighTempInF' },
  { key: 'daily_low_temp_in',  label: 'Today Indoor Lo',  source: 'extrema', field: 'dailyLowTempInF' },
];

interface TemperatureTileProps {
  readonly reading: CurrentReadingDto | undefined;
  readonly extrema: DailyExtremaDto | undefined;
  readonly preferences: UserPreferencesDto;
  readonly selectedKeys: readonly string[];
  readonly stationLabel?: string;
  readonly historyDeviceId?: string | null;
  readonly canOpenHistory?: boolean;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly className?: string;
}

/** Dashboard tile that groups all selected temperature-family metrics. */
export function TemperatureTile({
  reading,
  extrema,
  preferences,
  selectedKeys,
  stationLabel,
  historyDeviceId,
  canOpenHistory = true,
  isLoading = false,
  isError = false,
  className,
}: TemperatureTileProps) {
  const rows = selectedKeys
    .map((key) => ALL_ROWS.find((row) => row.key === key))
    .filter((row): row is TemperatureRow => row !== undefined);

  function getLabel(row: TemperatureRow): string {
    return row.label;
  }

  function getValue(row: TemperatureRow): number | null {
    if (row.source === 'extrema') {
      return extrema ? (extrema[row.field] ?? null) : null;
    }
    return reading ? (reading[row.field] ?? null) : null;
  }

  function fmt(row: TemperatureRow) {
    return formatMetricValue(getValue(row), 'temperature', preferences);
  }

  return (
    <Card className={className} data-test-id="dashboard-temperature-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Temperature</CardTitle>
            <CardDescription>{stationLabel ?? reading?.deviceName ?? reading?.deviceId ?? 'No station'}</CardDescription>
          </div>
          <Thermometer className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-test-id="dashboard-temperature-loading">Loading</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No temperature metrics selected.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3" aria-live="polite">
              {rows.map((r) => (
                <TempRow
                  key={r.key}
                  row={r}
                  label={getLabel(r)}
                  formatted={fmt(r)}
                  isError={isError}
                  historyDeviceId={historyDeviceId}
                  canOpenHistory={canOpenHistory && r.source === 'current'}
                />
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-temperature-freshness">
              Updated {formatFreshness(reading?.receivedAtUtc)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface TempRowProps {
  readonly row: TemperatureRow;
  readonly label: string;
  readonly formatted: { value: string; unit: string };
  readonly isError: boolean;
  readonly historyDeviceId?: string | null;
  readonly canOpenHistory: boolean;
}

function TempRow({ row, label, formatted, isError, historyDeviceId, canOpenHistory }: TempRowProps) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold" data-test-id="dashboard-temperature-value">
        <MetricHistoryValueLink
          metricKey={row.key}
          label={label}
          deviceId={historyDeviceId}
          enabled={canOpenHistory}
        >
          {isError ? '—' : `${formatted.value}${formatted.unit}`}
        </MetricHistoryValueLink>
      </dd>
    </div>
  );
}
