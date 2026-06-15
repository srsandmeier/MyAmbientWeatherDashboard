import type { RecentDayOption } from '../../lib/recentDays';
import type { MetricHistoryGranularity, MetricHistoryRange } from '../../types/metrics';

const RANGE_OPTIONS: readonly { readonly value: MetricHistoryRange; readonly label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

const GRANULARITY_OPTIONS: readonly { readonly value: MetricHistoryGranularity; readonly label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'raw', label: 'Raw' },
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
];

export type MetricHistoryViewMode = 'rolling' | 'day';

export interface MetricHistoryStationOption {
  readonly value: string;
  readonly label: string;
}

interface MetricHistoryControlsProps {
  readonly viewMode: MetricHistoryViewMode;
  readonly range: MetricHistoryRange;
  readonly dayChoice: string;
  readonly date: string;
  readonly granularity: MetricHistoryGranularity;
  readonly deviceId: string;
  readonly recentDayOptions: readonly RecentDayOption[];
  readonly stationOptions: readonly MetricHistoryStationOption[];
  readonly comparisonDeviceId: string;
  readonly comparisonStationOptions: readonly MetricHistoryStationOption[];
  readonly comparisonStatus: string;
  readonly showComparison?: boolean;
  readonly onViewModeChange: (value: MetricHistoryViewMode) => void;
  readonly onRangeChange: (value: MetricHistoryRange) => void;
  readonly onDayChoiceChange: (value: string) => void;
  readonly onDateChange: (value: string) => void;
  readonly onGranularityChange: (value: MetricHistoryGranularity) => void;
  readonly onDeviceChange: (value: string) => void;
  readonly onComparisonDeviceChange: (value: string) => void;
}

/** Controls for selecting the visible metric-history chart series. */
export function MetricHistoryControls({
  viewMode,
  range,
  dayChoice,
  date,
  granularity,
  deviceId,
  recentDayOptions,
  stationOptions,
  comparisonDeviceId,
  comparisonStationOptions,
  comparisonStatus,
  showComparison = true,
  onViewModeChange,
  onRangeChange,
  onDayChoiceChange,
  onDateChange,
  onGranularityChange,
  onDeviceChange,
  onComparisonDeviceChange,
}: MetricHistoryControlsProps) {
  return (
    <div className="space-y-4" data-test-id="metric-detail-control-panel">
      <div className="grid gap-3 md:grid-cols-5" role="group" aria-labelledby="metric-detail-controls-heading">
        <span id="metric-detail-controls-heading" className="sr-only">Metric history controls</span>
        <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-view-mode">
          View
          <select
            id="metric-detail-view-mode"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={viewMode}
            onChange={(event) => { onViewModeChange(event.target.value as MetricHistoryViewMode); }}
            data-test-id="metric-detail-view-mode"
          >
            <option value="rolling">Rolling</option>
            <option value="day">Single day</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-range">
          Range
          <select
            id="metric-detail-range"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
            value={range}
            disabled={viewMode !== 'rolling'}
            onChange={(event) => { onRangeChange(event.target.value as MetricHistoryRange); }}
            data-test-id="metric-detail-range"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-day">
          Day
          <select
            id="metric-detail-day"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={dayChoice}
            onChange={(event) => { onDayChoiceChange(event.target.value); }}
            data-test-id="metric-detail-day"
          >
            {recentDayOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
            <option value="custom">Custom date...</option>
          </select>
        </label>

        {viewMode === 'day' && dayChoice === 'custom' && (
          <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-date">
            Custom Date
            <input
              id="metric-detail-date"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              type="date"
              value={date}
              onChange={(event) => { onDateChange(event.target.value); }}
              data-test-id="metric-detail-date"
            />
          </label>
        )}

        <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-granularity">
          Granularity
          <select
            id="metric-detail-granularity"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={granularity}
            onChange={(event) => { onGranularityChange(event.target.value as MetricHistoryGranularity); }}
            data-test-id="metric-detail-granularity"
          >
            {GRANULARITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-device">
          Station
          <select
            id="metric-detail-device"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={deviceId}
            onChange={(event) => { onDeviceChange(event.target.value); }}
            data-test-id="metric-detail-device"
          >
            <option value="">Primary station</option>
            {stationOptions.map((station) => (
              <option key={station.value} value={station.value}>{station.label}</option>
            ))}
          </select>
        </label>
      </div>

      {showComparison && (
        <div className="grid gap-3" role="group" aria-labelledby="metric-detail-series-heading">
          <span id="metric-detail-series-heading" className="sr-only">Chart series controls</span>
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-medium" htmlFor="metric-detail-comparison-device">
              Compare
              <select
                id="metric-detail-comparison-device"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
                value={comparisonDeviceId}
                disabled={comparisonStationOptions.length === 0}
                onChange={(event) => { onComparisonDeviceChange(event.target.value); }}
                data-test-id="metric-detail-comparison-device"
              >
                <option value="">No comparison</option>
                {comparisonStationOptions.map((station) => (
                  <option key={station.value} value={station.value}>{station.label}</option>
                ))}
              </select>
            </label>
            {comparisonDeviceId.length > 0 && (
              <p
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                data-test-id="metric-detail-overlay-state"
              >
                {comparisonStatus}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
