import { useNavigate } from 'react-router';
import { CardDescription, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import { isHistoryMetricKey } from '../../lib/historyMetrics';
import { getMetricValue } from '../../lib/metricValues';
import { getAggregateMetricValue } from '../../lib/aggregateMetricValues';
import { METRIC_REGISTRY, type MetricDefinition } from '../../types/metrics';
import type { CurrentReadingDto } from '../../types/dashboard';
import type { UserPreferencesDto } from '../../types/settings';
import { useDashboardExtrema } from '../../hooks/useDashboardExtrema';

interface MetricTileProps {
  readonly metricKey: string;
  readonly reading: CurrentReadingDto | undefined;
  readonly preferences: UserPreferencesDto;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly stationLabel?: string;
  readonly className?: string;
}

/** Dashboard tile for one current metric value. */
export function MetricTile({
  metricKey,
  reading,
  preferences,
  isLoading = false,
  isError = false,
  stationLabel,
  className,
}: MetricTileProps) {
  const navigate = useNavigate();
  const definition = METRIC_REGISTRY[metricKey] as MetricDefinition | undefined;

  const { data: extrema, isPending: extremaLoading, isError: extremaError } = useDashboardExtrema();

  const isAggregate = definition?.isAggregate ?? false;

  const value = isAggregate
    ? (definition && extrema ? getAggregateMetricValue(extrema, definition.key) : null)
    : (definition && reading ? getMetricValue(reading, definition.key) : null);

  const effectiveLoading = isLoading || (isAggregate && extremaLoading);
  const effectiveError = isError || (isAggregate && extremaError);

  const formatted = definition
    ? formatMetricValue(value, definition.unitFamily, preferences)
    : { value: '—', unit: '' };

  const title = definition?.label ?? 'Unsupported metric';
  const station = stationLabel
    ?? (isAggregate ? extrema?.deviceName : reading?.deviceName)
    ?? (isAggregate ? extrema?.deviceId : reading?.deviceId)
    ?? 'No station';
  const freshness = isAggregate ? null : formatFreshness(reading?.receivedAtUtc);
  const disabled = definition === undefined || effectiveLoading || isAggregate || !isHistoryMetricKey(metricKey);

  const activate = () => {
    if (!disabled) {
      void navigate(`/metrics/${encodeURIComponent(metricKey)}`);
    }
  };

  return (
    <button
      type="button"
      className={cn(
        'flex h-full min-h-40 w-full flex-col rounded-xl border border-border bg-card text-left text-card-foreground shadow transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70',
        className,
      )}
      onClick={activate}
      disabled={disabled}
      data-test-id="dashboard-metric-tile"
      data-metric-key={metricKey}
      aria-label={`${title} metric tile`}
    >
      <CardHeader className="w-full pb-3">
        <CardTitle className="text-sm leading-5">{title}</CardTitle>
        <CardDescription className="truncate">{station}</CardDescription>
      </CardHeader>
      <div className="flex flex-1 flex-col justify-end px-6 pb-6">
        {effectiveLoading ? (
          <span className="text-2xl font-semibold" data-test-id="dashboard-metric-loading">
            Loading
          </span>
        ) : (
          <span className="flex items-baseline gap-2" aria-live="polite">
            <span className="text-3xl font-semibold tracking-normal" data-test-id="dashboard-metric-value">
              {effectiveError ? '—' : formatted.value}
            </span>
            {formatted.unit.length > 0 && (
              <span className="text-sm text-muted-foreground" data-test-id="dashboard-metric-unit">
                {formatted.unit}
              </span>
            )}
          </span>
        )}
        <span className="mt-3 text-xs text-muted-foreground" data-test-id="dashboard-metric-freshness">
          {isAggregate ? 'Today (UTC)' : `Updated ${freshness ?? '—'}`}
        </span>
      </div>
    </button>
  );
}
