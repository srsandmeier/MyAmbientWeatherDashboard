import { Activity, BatteryLow, RadioTower } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatFreshness } from '../../lib/units';
import type { CurrentReadingDto } from '../../types/dashboard';

interface StatusTileProps {
  readonly hubState: string;
  readonly reading: CurrentReadingDto | undefined;
  readonly stationLabel?: string;
  readonly isCurrentLoading?: boolean;
  readonly isCurrentError?: boolean;
  readonly isRainfallError?: boolean;
  readonly className?: string;
}

/** Dashboard tile for realtime and freshness state. */
export function StatusTile({
  hubState,
  reading,
  stationLabel,
  isCurrentLoading = false,
  isCurrentError = false,
  isRainfallError = false,
  className,
}: StatusTileProps) {
  const hasError = isCurrentError || isRainfallError;
  const label = hubStateLabel(hubState);

  return (
    <Card className={className} data-test-id="dashboard-status-tile">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm leading-5">Station Status</CardTitle>
            <CardDescription>{stationLabel ?? reading?.deviceName ?? reading?.deviceId ?? 'No station'}</CardDescription>
          </div>
          {hubState === 'connected' ? (
            <RadioTower className="h-5 w-5 text-green-600" aria-hidden="true" />
          ) : (
            <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div aria-live="polite">
          <p className="text-2xl font-semibold tracking-normal" data-test-id="dashboard-status-realtime">
            {label}
          </p>
          <p className="text-xs text-muted-foreground" data-test-id="dashboard-status-freshness">
            Updated {formatFreshness(reading?.receivedAtUtc)}
          </p>
        </div>
        {isCurrentLoading && (
          <p className="text-sm text-muted-foreground" role="status" data-test-id="dashboard-status-loading">
            Loading current data.
          </p>
        )}
        {hasError && (
          <p className="text-sm text-destructive" role="status" data-test-id="dashboard-status-error">
            Dashboard data is partially unavailable.
          </p>
        )}
        {reading?.battOut === 0 && (
          <p className="flex items-center gap-1 text-sm text-amber-600" role="status" data-test-id="dashboard-status-battery-low">
            <BatteryLow className="h-4 w-4" aria-hidden="true" />
            Outdoor sensor battery low
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function hubStateLabel(hubState: string): string {
  switch (hubState) {
    case 'connected': return 'Live';
    case 'connecting':
    case 'reconnecting': return 'Reconnecting';
    case 'disconnected': return 'Offline';
    default: return hubState.length > 0 ? hubState : 'Unknown';
  }
}
