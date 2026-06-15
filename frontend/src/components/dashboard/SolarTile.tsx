import { Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { MetricHistoryValueLink } from './MetricHistoryValueLink';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import type { MetricUnitFamily } from '../../types/metrics';
import type { CurrentReadingDto } from '../../types/dashboard';
import type { UserPreferencesDto } from '../../types/settings';

const ROWS = [
  { key: 'solar_radiation', label: 'Solar',          field: 'solarRadiation' as const, unitFamily: 'solarRadiation' as MetricUnitFamily, precision: 1 },
  { key: 'uv_index',        label: 'UV Index',        field: 'uv'             as const, unitFamily: 'uvIndex'        as MetricUnitFamily, precision: 0 },
  { key: 'om_uv_index_max', label: 'UV Max (Today)', field: 'omUvIndexMax'   as const, unitFamily: 'uvIndex'        as MetricUnitFamily, precision: 0 },
] as const;

type SolarRow = typeof ROWS[number];

interface SolarTileProps {
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

/** Dashboard tile that groups solar radiation and UV index. */
export function SolarTile({
  reading,
  preferences,
  selectedKeys,
  stationLabel,
  historyDeviceId,
  canOpenHistory = true,
  isLoading = false,
  isError = false,
  className,
}: SolarTileProps) {
  const rows = selectedKeys
    .map((key) => ROWS.find((row) => row.key === key))
    .filter((row): row is SolarRow => row !== undefined);

  return (
    <Card className={className} data-test-id="dashboard-solar-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Solar &amp; UV</CardTitle>
            <CardDescription>{stationLabel ?? reading?.deviceName ?? reading?.deviceId ?? 'No station'}</CardDescription>
          </div>
          <Sun className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-test-id="dashboard-solar-loading">Loading</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No solar metrics selected.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2" aria-live="polite">
              {rows.map((r) => {
                const val = reading ? reading[r.field] : null;
                const f = formatMetricValue(val, r.unitFamily, preferences, r.precision);
                return (
                  <div key={r.key}>
                    <dt className="text-xs text-muted-foreground">{r.label}</dt>
                    <dd className="text-base font-semibold" data-test-id="dashboard-solar-value">
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
            <p className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-solar-freshness">
              Updated {formatFreshness(reading?.receivedAtUtc)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
