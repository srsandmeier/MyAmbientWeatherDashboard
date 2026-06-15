import { Wind } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { MetricHistoryValueLink } from './MetricHistoryValueLink';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import type { CurrentReadingDto } from '../../types/dashboard';
import type { MetricUnitFamily } from '../../types/metrics';
import type { UserPreferencesDto } from '../../types/settings';

const ROWS = [
  { key: 'wind_dir',           label: 'Direction',          field: 'windDir'          as const, unitFamily: 'windDirection' as MetricUnitFamily },
  { key: 'wind_speed',         label: 'Speed',              field: 'windSpeedMph'     as const, unitFamily: 'windSpeed'     as MetricUnitFamily },
  { key: 'wind_gust',          label: 'Gust',               field: 'windGustMph'      as const, unitFamily: 'windSpeed'     as MetricUnitFamily },
  { key: 'max_daily_gust',     label: 'Max Gust',           field: 'maxDailyGust'     as const, unitFamily: 'windSpeed'     as MetricUnitFamily },
  { key: 'om_wind_speed_max',  label: 'Max Wind (Today)',   field: 'omWindSpeedMax'   as const, unitFamily: 'windSpeed'     as MetricUnitFamily },
  { key: 'om_wind_gust_max',   label: 'Max Gust (Today)',   field: 'omWindGustMax'    as const, unitFamily: 'windSpeed'     as MetricUnitFamily },
  { key: 'om_wind_dir_dominant', label: 'Dominant (Today)', field: 'omWindDirDominant' as const, unitFamily: 'windDirection' as MetricUnitFamily },
] as const;

type WindRow = typeof ROWS[number];

interface WindTileProps {
  readonly reading: CurrentReadingDto | undefined;
  readonly preferences: UserPreferencesDto;
  readonly selectedKeys: readonly string[];
  readonly stationLabel?: string;
  readonly historyDeviceId?: string | null;
  readonly canOpenHistory?: boolean;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly className?: string;
}

/** Dashboard tile that groups selected wind metrics. */
export function WindTile({
  reading,
  preferences,
  selectedKeys,
  stationLabel,
  historyDeviceId,
  canOpenHistory = true,
  isLoading = false,
  isError = false,
  className,
}: WindTileProps) {
  const rows = selectedKeys
    .map((key) => ROWS.find((row) => row.key === key))
    .filter((row): row is WindRow => row !== undefined);

  function fmt(row: typeof ROWS[number]) {
    const val = reading ? reading[row.field] : null;
    return formatMetricValue(val, row.unitFamily, preferences);
  }

  return (
    <Card className={className} data-test-id="dashboard-wind-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Wind</CardTitle>
            <CardDescription>{stationLabel ?? reading?.deviceName ?? reading?.deviceId ?? 'No station'}</CardDescription>
          </div>
          <Wind className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-test-id="dashboard-wind-loading">Loading</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wind metrics selected.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2" aria-live="polite">
              {rows.map((r) => {
                const f = fmt(r);
                return (
                  <div key={r.key}>
                    <dt className="text-xs text-muted-foreground">{r.label}</dt>
                    <dd className="text-base font-semibold" data-test-id="dashboard-wind-value">
                      <MetricHistoryValueLink
                        metricKey={r.key}
                        label={r.label}
                        deviceId={historyDeviceId}
                        enabled={canOpenHistory}
                      >
                        {isError ? '—' : f.unit ? `${f.value} ${f.unit}` : f.value}
                      </MetricHistoryValueLink>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-wind-freshness">
              Updated {formatFreshness(reading?.receivedAtUtc)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
