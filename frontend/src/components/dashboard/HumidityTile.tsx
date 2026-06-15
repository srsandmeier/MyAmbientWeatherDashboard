import { Gauge } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { MetricHistoryValueLink } from './MetricHistoryValueLink';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import type { CurrentReadingDto } from '../../types/dashboard';
import type { UserPreferencesDto } from '../../types/settings';

const ROWS = [
  { key: 'outdoor_humidity',    label: 'Outdoor humidity',    field: 'humidity'          },
  { key: 'indoor_humidity',     label: 'Indoor humidity',     field: 'humidityIn'        },
  { key: 'om_cloud_cover',      label: 'Cloud cover',         field: 'omCloudCover'      },
  { key: 'om_precip_probability', label: 'Precip. probability', field: 'omPrecipProbability' },
] as const;

type HumidityRow = typeof ROWS[number];
type FieldName = HumidityRow['field'];

interface HumidityTileProps {
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

/** Dashboard tile that groups humidity and barometric pressure. */
export function HumidityTile({
  reading,
  preferences,
  selectedKeys,
  stationLabel,
  historyDeviceId,
  canOpenHistory = true,
  isLoading = false,
  isError = false,
  className,
}: HumidityTileProps) {
  const rows = selectedKeys
    .map((key) => ROWS.find((row) => row.key === key))
    .filter((row): row is HumidityRow => row !== undefined);
  const orderedItems = selectedKeys.filter((key) => key === 'pressure' || rows.some((row) => row.key === key));

  function fmt(field: FieldName) {
    const val = reading ? reading[field] : null;
    return formatMetricValue(val, 'humidity', preferences, 0);
  }

  const pressure = formatMetricValue(reading?.baromRelIn ?? null, 'pressure', preferences);

  return (
    <Card className={className} data-test-id="dashboard-humidity-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Atmosphere</CardTitle>
            <CardDescription>{stationLabel ?? reading?.deviceName ?? reading?.deviceId ?? 'No station'}</CardDescription>
          </div>
          <Gauge className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-test-id="dashboard-humidity-loading">Loading</p>
        ) : orderedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No atmosphere metrics selected.</p>
        ) : (
          <>
            <div className="space-y-3" aria-live="polite">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {orderedItems.map((key) => {
                  if (key === 'pressure') {
                    return (
                      <div key={key}>
                        <dt className="text-xs text-muted-foreground">Barometric pressure</dt>
                        <dd className="text-base font-semibold" data-test-id="dashboard-pressure-value">
                          <MetricHistoryValueLink
                            metricKey="pressure"
                            label="Barometric pressure"
                            deviceId={historyDeviceId}
                            enabled={canOpenHistory}
                          >
                            {isError ? '—' : `${pressure.value} ${pressure.unit}`}
                          </MetricHistoryValueLink>
                        </dd>
                      </div>
                    );
                  }

                  const r = rows.find((row) => row.key === key);
                  if (!r) return null;

                    const f = fmt(r.field);
                    return (
                      <div key={r.key}>
                        <dt className="text-xs text-muted-foreground">{r.label}</dt>
                        <dd className="text-2xl font-semibold" data-test-id="dashboard-humidity-value">
                          <MetricHistoryValueLink
                            metricKey={r.key}
                            label={r.label}
                            deviceId={historyDeviceId}
                            enabled={canOpenHistory}
                          >
                            {isError ? '—' : `${f.value}${f.unit}`}
                          </MetricHistoryValueLink>
                        </dd>
                      </div>
                    );
                })}
              </dl>
            </div>
            <p className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-humidity-freshness">
              Updated {formatFreshness(reading?.receivedAtUtc)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
