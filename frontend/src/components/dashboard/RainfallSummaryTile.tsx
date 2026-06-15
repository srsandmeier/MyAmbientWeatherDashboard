import { CloudRain } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { MetricHistoryValueLink } from './MetricHistoryValueLink';
import { formatDateByPreference, formatMetricValue } from '../../lib/units';
import type { DashboardRainfallDto } from '../../types/dashboard';
import type { UserPreferencesDto } from '../../types/settings';

interface RainfallRow {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
}

const ALL_ROWS: readonly RainfallRow[] = [
  { key: 'rainfall_event', label: 'Event',         value: null },
  { key: 'rainfall_day',   label: 'Today',         value: null },
  { key: 'rainfall_week',  label: 'This Week',     value: null },
  { key: 'rainfall_month', label: 'Current Month', value: null },
  { key: 'rainfall_year',  label: 'This Year',     value: null },
];

interface RainfallSummaryTileProps {
  readonly rainfall: DashboardRainfallDto | undefined;
  readonly preferences: UserPreferencesDto;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly className?: string;
  /**
   * Rainfall metric keys that should be displayed.
   * When undefined (device has no selection yet) all rows are shown.
   * When an empty array the tile shows a "no rainfall metrics selected" message.
   */
  readonly selectedKeys?: readonly string[];
  readonly stationLabel?: string;
  readonly historyDeviceId?: string | null;
  readonly canOpenHistory?: boolean;
}

/** Dashboard tile that summarizes current rainfall accumulation windows. */
export function RainfallSummaryTile({
  rainfall,
  preferences,
  isLoading = false,
  isError = false,
  className,
  selectedKeys,
  stationLabel,
  historyDeviceId,
  canOpenHistory = true,
}: RainfallSummaryTileProps) {
  const rows: RainfallRow[] = ALL_ROWS
    .filter((r) => selectedKeys === undefined || selectedKeys.includes(r.key))
    .map((r) => ({ ...r, value: getValue(r.key, rainfall) }));

  return (
    <Card className={className} data-test-id="dashboard-rainfall-summary-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Rainfall</CardTitle>
            <CardDescription>
              {stationLabel ?? rainfall?.deviceName ?? rainfall?.deviceId ?? 'No station'}
            </CardDescription>
          </div>
          <CloudRain className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-test-id="dashboard-rainfall-loading">
            Loading
          </p>
        ) : (
          <>
            {isError && (
              <p className="mb-3 text-sm text-destructive" role="status" data-test-id="dashboard-rainfall-error">
                Rainfall is unavailable.
              </p>
            )}
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-test-id="dashboard-rainfall-no-selection">
                No rainfall metrics selected. Choose rainfall metrics in Settings.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2" aria-live="polite">
                {rows.map((row) => {
                  const formatted = formatMetricValue(row.value, 'rainfall', preferences, 2);
                  return (
                    <div key={row.key}>
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="text-base font-semibold" data-test-id="dashboard-rainfall-value">
                        <MetricHistoryValueLink
                          metricKey={row.key}
                          label={row.label}
                          deviceId={historyDeviceId}
                          enabled={canOpenHistory}
                        >
                          {formatted.value} {formatted.unit}
                        </MetricHistoryValueLink>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
            {rainfall?.lastRain && (
              <p className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-rainfall-last-rain">
                Last rain {formatDateByPreference(rainfall.lastRain, preferences.dateFormat)}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function getValue(key: string, rainfall: DashboardRainfallDto | undefined): number | null {
  if (!rainfall) return null;
  switch (key) {
    case 'rainfall_event': return rainfall.eventRainIn;
    case 'rainfall_day': return rainfall.dailyRainIn;
    case 'rainfall_week': return rainfall.weeklyRainIn;
    case 'rainfall_month': return rainfall.monthlyRainIn;
    case 'rainfall_year': return rainfall.yearlyRainIn;
    default: return null;
  }
}
