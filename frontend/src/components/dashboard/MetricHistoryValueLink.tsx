import { Link } from 'react-router';
import type React from 'react';
import { getMetricHistoryPath, isHistoryMetricKey } from '../../lib/historyMetrics';
import { cn } from '../../lib/utils';

interface MetricHistoryValueLinkProps {
  readonly metricKey: string;
  readonly label: string;
  readonly deviceId?: string | null;
  readonly enabled?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** Clickable dashboard value that opens the owned-station history chart when available. */
export function MetricHistoryValueLink({
  metricKey,
  label,
  deviceId,
  enabled = true,
  className,
  children,
}: MetricHistoryValueLinkProps) {
  const canOpenHistory = enabled && isHistoryMetricKey(metricKey);

  if (!canOpenHistory) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to={getMetricHistoryPath(metricKey, deviceId)}
      className={cn(
        'inline-flex rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      aria-label={`Open ${label} history chart`}
      data-test-id="dashboard-metric-history-link"
      data-metric-key={metricKey}
    >
      {children}
    </Link>
  );
}
