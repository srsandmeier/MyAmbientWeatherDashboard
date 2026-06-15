import { createElement, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatFreshness, formatMetricValue } from '../../lib/units';
import { getMetricStringValue, getMetricValue } from '../../lib/metricValues';
import { getAggregateMetricValue } from '../../lib/aggregateMetricValues';
import { resolveBlockIcon } from '../../lib/blockIcons';
import { useDashboardExtrema } from '../../hooks/useDashboardExtrema';
import { METRIC_REGISTRY } from '../../types/metrics';
import { METRIC_KEY_LABELS, type SettingsDeviceDto, type UserPreferencesDto } from '../../types/settings';
import type { WeatherAlertDto } from '../../types/alerts';
import type { CurrentReadingDto } from '../../types/dashboard';
import { MetricHistoryValueLink } from './MetricHistoryValueLink';

/** Renders the icon chosen for a metric block, or nothing when no icon is set. */
function BlockIconDisplay({ icon }: { readonly icon?: string | null }) {
  const Icon = resolveBlockIcon(icon);
  if (!Icon) return null;
  return createElement(Icon, { className: 'h-5 w-5 shrink-0 text-muted-foreground', 'aria-hidden': 'true' });
}
import type {
  CustomLayoutItem,
  CustomMetricBlockItem,
  CustomMetricReference,
  CustomTickerItem,
} from '../../types/customLayout';
import type { UseDashboardCurrentResult } from '../../hooks/useDashboardCurrent';

interface CustomDashboardRendererProps {
  readonly items: readonly CustomLayoutItem[];
  readonly current: UseDashboardCurrentResult;
  readonly preferences: UserPreferencesDto;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly alerts?: readonly WeatherAlertDto[];
  readonly publicSourceReadings?: ReadonlyMap<string, CurrentReadingDto>;
  readonly pinnedStationReadings?: ReadonlyMap<string, CurrentReadingDto>;
  /** True while any external (pinned/public) source query is in-flight. Prevents premature
   * error state on external-source metric cells before their readings have arrived. */
  readonly isExternalLoading?: boolean;
  /** Per-zone alert lists for ticker items that specify an alertsZone override. */
  readonly tickerAlertsMap?: ReadonlyMap<string, readonly WeatherAlertDto[]>;
}

export function CustomDashboardRenderer({
  items,
  current,
  preferences,
  devices,
  alerts = [],
  publicSourceReadings = new Map(),
  pinnedStationReadings = new Map(),
  isExternalLoading = false,
  tickerAlertsMap = new Map(),
}: CustomDashboardRendererProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-test-id="custom-dashboard-empty">
        No custom layout items configured. Go to Settings → My Stations → Custom to add tiles.
      </p>
    );
  }

  const disconnectedCount = countDisconnectedMetricRefs(
    items,
    devices,
    publicSourceReadings,
    pinnedStationReadings,
    isExternalLoading,
  );

  return (
    <div className="space-y-4">
      {disconnectedCount > 0 && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
          data-test-id="custom-dashboard-disconnected-warning"
        >
          {disconnectedCount} custom layout field{disconnectedCount === 1 ? ' is' : 's are'} disconnected.
          Reconnect the source or edit the custom layout in Settings.
        </div>
      )}
      <div
        className="grid grid-cols-3 gap-4"
        style={{ gridAutoRows: 'minmax(8rem, auto)' }}
        data-test-id="custom-dashboard-grid"
      >
        {items.map((item) => (
          <CustomGridTile
            key={item.id}
            item={item}
            current={current}
            preferences={preferences}
            devices={devices}
            alerts={alerts}
            publicSourceReadings={publicSourceReadings}
            pinnedStationReadings={pinnedStationReadings}
            isExternalLoading={isExternalLoading}
            tickerAlertsMap={tickerAlertsMap}
          />
        ))}
      </div>
    </div>
  );
}

function CustomGridTile({
  item,
  current,
  preferences,
  devices,
  alerts,
  publicSourceReadings,
  pinnedStationReadings,
  isExternalLoading,
  tickerAlertsMap,
}: {
  readonly item: CustomLayoutItem;
  readonly current: UseDashboardCurrentResult;
  readonly preferences: UserPreferencesDto;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly alerts: readonly WeatherAlertDto[];
  readonly publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isExternalLoading: boolean;
  readonly tickerAlertsMap: ReadonlyMap<string, readonly WeatherAlertDto[]>;
}) {
  const col = parseInt(item.size.charAt(0), 10);
  const row = parseInt(item.size.charAt(2), 10);

  return (
    <div
      style={{ gridColumn: `span ${col.toString()}`, gridRow: `span ${row.toString()}` }}
      data-test-id="custom-dashboard-tile"
      data-tile-id={item.id}
      data-tile-size={item.size}
    >
      {renderItem(item, current, preferences, devices, alerts, publicSourceReadings, pinnedStationReadings, isExternalLoading, tickerAlertsMap)}
    </div>
  );
}

function renderItem(
  item: CustomLayoutItem,
  current: UseDashboardCurrentResult,
  preferences: UserPreferencesDto,
  devices: readonly SettingsDeviceDto[] | undefined,
  alerts: readonly WeatherAlertDto[],
  publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>,
  pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>,
  isExternalLoading: boolean,
  tickerAlertsMap: ReadonlyMap<string, readonly WeatherAlertDto[]>,
) {
  if (item.type === 'divider') {
    return <DividerTile name={item.name} />;
  }

  if (item.type === 'header-ticker' || item.type === 'footer-ticker') {
    const zoneAlerts = item.alertsZone
      ? (tickerAlertsMap.get(item.alertsZone) ?? alerts)
      : alerts;
    const channelReading =
      (item.channelStationId
        ? (pinnedStationReadings.get(item.channelStationId) ??
           publicSourceReadings.get(item.channelStationId))
        : undefined) ?? current.data;
    return (
      <TickerTile
        item={item}
        currentData={channelReading}
        currentIsPending={current.isPending}
        preferences={preferences}
        alerts={zoneAlerts}
      />
    );
  }

  const block = item as CustomMetricBlockItem;
  const colSpan = parseInt(block.size.charAt(0), 10);
  const capacity = colSpan * parseInt(block.size.charAt(2), 10);
  if (block.displayMode === 'fill' && block.metrics.length >= 1 && block.metrics.length <= capacity) {
    return (
      <FillMetricTile
        item={block}
        colSpan={colSpan}
        current={current}
        preferences={preferences}
        devices={devices}
        publicSourceReadings={publicSourceReadings}
        pinnedStationReadings={pinnedStationReadings}
        isExternalLoading={isExternalLoading}
      />
    );
  }

  return (
    <MetricBlockTile
      item={block}
      current={current}
      preferences={preferences}
      devices={devices}
      publicSourceReadings={publicSourceReadings}
      pinnedStationReadings={pinnedStationReadings}
      isExternalLoading={isExternalLoading}
    />
  );
}

function DividerTile({ name }: { readonly name: string | null }) {
  return (
    <div className="flex h-full items-center gap-3" data-test-id="custom-dashboard-divider">
      {name && (
        <span className="shrink-0 text-sm font-medium text-muted-foreground">{name}</span>
      )}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

const DEFAULT_TICKER_KEYS = [
  'outdoor_temp', 'outdoor_humidity', 'wind_speed', 'wind_dir',
  'pressure', 'uv_index', 'solar_radiation',
] as const;

interface TickerEntry {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly kind?: 'weather' | 'alert';
}

function buildTickerEntries(
  sourceLabels: readonly string[],
  currentData: CurrentReadingDto | undefined,
  preferences: UserPreferencesDto,
): readonly TickerEntry[] {
  const keys = sourceLabels.length > 0 ? sourceLabels : DEFAULT_TICKER_KEYS;
  return keys.flatMap((key) => {
    const definition = METRIC_REGISTRY[key] as typeof METRIC_REGISTRY[string] | undefined;
    if (!definition) return [];
    const rawValue = currentData
      ? (definition.unitFamily === 'text'
          ? getMetricStringValue(currentData, key)
          : getMetricValue(currentData, key))
      : null;
    const formatted = formatMetricValue(rawValue, definition.unitFamily, preferences);
    const label = METRIC_KEY_LABELS[key as keyof typeof METRIC_KEY_LABELS];
    return [{ label, value: formatted.value, unit: formatted.unit }];
  });
}

function buildAlertTickerEntries(alerts: readonly WeatherAlertDto[]): readonly TickerEntry[] {
  return alerts.map((alert) => ({
    label: alert.event ?? alert.severity ?? 'Weather alert',
    value: alert.headline ?? alert.description ?? 'Active weather alert',
    unit: '',
    kind: 'alert' as const,
  }));
}

function TickerTile({
  item,
  currentData,
  currentIsPending,
  preferences,
  alerts,
}: {
  readonly item: CustomTickerItem;
  readonly currentData: CurrentReadingDto | undefined;
  readonly currentIsPending: boolean;
  readonly preferences: UserPreferencesDto;
  readonly alerts: readonly WeatherAlertDto[];
}) {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [isPaused, setIsPaused] = useState(item.isPaused || prefersReduced);

  const entries = alerts.length > 0 ? buildAlertTickerEntries(alerts) : buildTickerEntries(item.sourceLabels, currentData, preferences);
  const positionLabel = item.position === 'header' ? 'Header' : 'Footer';
  const regionLabel = item.name ?? `${positionLabel} weather ticker`;
  const duration = Math.max(10, entries.length * 3);

  return (
    <div
      className="flex h-full items-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-3 shadow"
      role="region"
      aria-label={regionLabel}
      data-test-id="custom-dashboard-ticker"
    >
      <span
        className="sr-only"
        data-test-id={item.position === 'header' ? 'dashboard-header-ticker' : 'dashboard-footer-ticker'}
      >
        {regionLabel}
      </span>
      {/* sr-only status announces pause/resume without live-region noise during scroll */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {isPaused ? `${regionLabel} paused` : ''}
      </span>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        {currentIsPending ? (
          <span className="text-sm text-muted-foreground">Loading…</span>
        ) : entries.length === 0 ? (
          <span className="text-sm text-muted-foreground">No weather data</span>
        ) : (
          <div
            className={isPaused ? 'flex flex-wrap gap-x-6 gap-y-1' : 'ticker-animate flex whitespace-nowrap'}
            style={isPaused ? undefined : { '--ticker-duration': `${duration.toString()}s` } as React.CSSProperties}
            aria-live="off"
            aria-hidden={isPaused ? undefined : 'true'}
            data-test-id="custom-dashboard-ticker-content"
          >
            {(isPaused ? entries : [...entries, ...entries]).map((entry, i) => (
              <span
                key={i}
                className="inline-flex items-baseline gap-1 text-sm mr-6"
                data-test-id="custom-dashboard-ticker-entry"
              >
                <span className="font-medium text-muted-foreground">{entry.label}:</span>
                <span className="font-semibold text-foreground">{entry.value}</span>
                {entry.unit.length > 0 && (
                  <span className="text-xs text-muted-foreground">{entry.unit}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* paused: show entries in a static accessible list for screen readers */}
        {!isPaused && entries.length > 0 && (
          <ul className="sr-only" aria-label={`${regionLabel} values`}>
            {entries.map((entry, i) => (
              <li key={i}>{entry.label}: {entry.value} {entry.unit}</li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={isPaused ? 'Resume ticker' : 'Pause ticker'}
        aria-pressed={isPaused}
        onClick={() => { setIsPaused((p) => !p); }}
        data-test-id="custom-dashboard-ticker-pause"
      >
        {isPaused
          ? <Play className="h-4 w-4" aria-hidden="true" />
          : <Pause className="h-4 w-4" aria-hidden="true" />
        }
      </button>
    </div>
  );
}

function fillValueClass(colSpan: number, rowSpan: number): string {
  const area = colSpan * rowSpan;
  if (area >= 9) return 'text-8xl';
  if (area >= 6) return 'text-7xl';
  if (area >= 4) return 'text-5xl';
  if (area >= 2) return 'text-4xl';
  return 'text-3xl';
}

function isExternalStationId(stationId: string): boolean {
  return stationId.startsWith('pinned:') || stationId.startsWith('public:');
}

interface SourceReadingResult {
  readonly reading: CurrentReadingDto | undefined;
  readonly isExternal: boolean;
  readonly isDisconnected: boolean;
  readonly disconnectedMessage: string | null;
}

function resolveSourceReading(
  metricRef: CustomMetricReference,
  devices: readonly SettingsDeviceDto[] | undefined,
  pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>,
  publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>,
  ownReading: CurrentReadingDto | undefined,
  isExternalLoading: boolean,
): SourceReadingResult {
  const external = pinnedStationReadings.get(metricRef.stationId) ?? publicSourceReadings.get(metricRef.stationId);
  if (external) return { reading: external, isExternal: true, isDisconnected: false, disconnectedMessage: null };
  const isExternal = isExternalStationId(metricRef.stationId);
  const sourceLabel = stationLabel(devices, metricRef);

  if (isExternal) {
    const isDisconnected = !isExternalLoading;
    return {
      reading: undefined,
      isExternal: true,
      isDisconnected,
      disconnectedMessage: isDisconnected
        ? `${sourceLabel} is not connected. Re-add or re-enable this source in Settings.`
        : null,
    };
  }

  if (!hasStationSource(devices, metricRef.stationId)) {
    return {
      reading: undefined,
      isExternal: false,
      isDisconnected: true,
      disconnectedMessage: `${sourceLabel} is not connected. Re-enter Ambient Weather credentials to refresh this field.`,
    };
  }

  return { reading: ownReading, isExternal: false, isDisconnected: false, disconnectedMessage: null };
}

function countDisconnectedMetricRefs(
  items: readonly CustomLayoutItem[],
  devices: readonly SettingsDeviceDto[] | undefined,
  publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>,
  pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>,
  isExternalLoading: boolean,
): number {
  let count = 0;
  for (const item of items) {
    if (item.type !== 'metric-block') continue;
    for (const metric of item.metrics) {
      const { isDisconnected } = resolveSourceReading(
        metric,
        devices,
        pinnedStationReadings,
        publicSourceReadings,
        undefined,
        isExternalLoading,
      );
      if (isDisconnected) count += 1;
    }
  }
  return count;
}

/** Returns the reading whose timestamp should appear in the tile's freshness footer.
 * For all-external tiles, uses the first resolved external reading.
 * For mixed or own-station tiles, uses the own-station reading to avoid showing a stale
 * external timestamp next to live own-station data. */
function resolveFreshnessSource(
  metrics: readonly CustomMetricReference[],
  pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>,
  publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>,
  ownReading: CurrentReadingDto | undefined,
): CurrentReadingDto | undefined {
  for (const ref of metrics) {
    if (!isExternalStationId(ref.stationId)) return ownReading;
  }
  for (const ref of metrics) {
    const external = pinnedStationReadings.get(ref.stationId) ?? publicSourceReadings.get(ref.stationId);
    if (external) return external;
  }
  return ownReading;
}

function FillCell({
  metricRef,
  current,
  preferences,
  devices,
  publicSourceReadings,
  pinnedStationReadings,
  isExternalLoading,
  extrema,
  showLabel = true,
  valueClass = 'text-2xl',
}: {
  readonly metricRef: CustomMetricReference;
  readonly current: UseDashboardCurrentResult;
  readonly preferences: UserPreferencesDto;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly showLabel?: boolean;
  readonly valueClass?: string;
  readonly publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isExternalLoading: boolean;
  readonly extrema: ReturnType<typeof useDashboardExtrema>;
}) {
  const definition = METRIC_REGISTRY[metricRef.metricKey];
  const isAggregate = definition.isAggregate;

  const {
    reading: sourceReading,
    isExternal: isExternalStation,
    isDisconnected,
    disconnectedMessage,
  } = resolveSourceReading(metricRef, devices, pinnedStationReadings, publicSourceReadings, current.data, isExternalLoading);
  const rawValue = isAggregate
    ? (extrema.data ? getAggregateMetricValue(extrema.data, metricRef.metricKey) : null)
    : definition.unitFamily === 'text'
      ? (sourceReading ? getMetricStringValue(sourceReading, metricRef.metricKey) : null)
      : (sourceReading ? getMetricValue(sourceReading, metricRef.metricKey) : null);

  const formatted = formatMetricValue(rawValue, definition.unitFamily, preferences);
  const metricLabel = metricRef.labelOverride ?? METRIC_KEY_LABELS[metricRef.metricKey];
  const source = stationLabel(devices, metricRef);
  const label = `${source} · ${metricLabel}`;
  const ownedAmbientDevice = findOwnedAmbientDevice(devices, metricRef);
  const isPending = isAggregate ? extrema.isPending
    : (isExternalStation ? isExternalLoading : current.isPending);
  const isError = isAggregate ? extrema.isError
    : (isDisconnected || (isExternalStation ? sourceReading === undefined && !isExternalLoading : current.isError));
  const isValueUnavailable = isPending || isError;

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      {showLabel && <p className="text-xs text-muted-foreground">{label}</p>}
      {isDisconnected && disconnectedMessage && (
        <p className="text-center text-xs font-medium text-amber-700 dark:text-amber-300" data-test-id="custom-dashboard-field-warning">
          {disconnectedMessage}
        </p>
      )}
      <MetricHistoryValueLink
        metricKey={metricRef.metricKey}
        label={label}
        deviceId={ownedAmbientDevice?.macAddress}
        enabled={ownedAmbientDevice !== null && !isValueUnavailable}
        className={`${valueClass} font-bold leading-none text-foreground`}
      >
        <span aria-live="polite" data-test-id="custom-dashboard-fill-value">
          {isPending ? '…' : isError ? '—' : formatted.value}
        </span>
      </MetricHistoryValueLink>
      {!isPending && !isError && formatted.unit.length > 0 && (
        <span className="text-sm text-muted-foreground" data-test-id="custom-dashboard-fill-unit">{formatted.unit}</span>
      )}
    </div>
  );
}

function FillMetricTile({
  item,
  colSpan,
  current,
  preferences,
  devices,
  publicSourceReadings,
  pinnedStationReadings,
  isExternalLoading,
}: {
  readonly item: CustomMetricBlockItem;
  readonly colSpan: number;
  readonly current: UseDashboardCurrentResult;
  readonly preferences: UserPreferencesDto;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isExternalLoading: boolean;
}) {
  const extrema = useDashboardExtrema();
  const freshness = formatFreshness(
    resolveFreshnessSource(item.metrics, pinnedStationReadings, publicSourceReadings, current.data)?.receivedAtUtc,
  );
  const disconnectedMetrics = item.metrics.filter((metric) => (
    resolveSourceReading(metric, devices, pinnedStationReadings, publicSourceReadings, current.data, isExternalLoading)
      .isDisconnected
  ));
  const rowSpan = parseInt(item.size.charAt(2), 10);

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow text-card-foreground"
      data-test-id="custom-dashboard-fill-tile"
    >
      {item.icon && (
        <div className="mb-1 flex items-center justify-between gap-2">
          {item.iconPosition === 'left' && (
            <span data-test-id="custom-dashboard-fill-icon-left"><BlockIconDisplay icon={item.icon} /></span>
          )}
          {item.name.length > 0 && (
            <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground" data-test-id="custom-dashboard-fill-name">
              {item.name}
            </p>
          )}
          {!item.name.length && <span className="flex-1" />}
          {item.iconPosition !== 'left' && (
            <span data-test-id="custom-dashboard-fill-icon-right"><BlockIconDisplay icon={item.icon} /></span>
          )}
        </div>
      )}
      {!item.icon && item.name.length > 0 && (
        <p className="mb-1 text-xs font-medium text-muted-foreground" data-test-id="custom-dashboard-fill-name">
          {item.name}
        </p>
      )}
      {disconnectedMetrics.length === item.metrics.length && item.metrics.length > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200" data-test-id="custom-dashboard-block-disconnected">
          No available fields in this block. Reconnect the source or edit this tile in Settings.
        </p>
      )}
      {item.metrics.length === 1 ? (
        <div className="flex flex-1 items-center justify-center">
          <FillCell
            metricRef={item.metrics[0]}
            current={current}
            preferences={preferences}
            devices={devices}
            publicSourceReadings={publicSourceReadings}
            pinnedStationReadings={pinnedStationReadings}
            isExternalLoading={isExternalLoading}
            extrema={extrema}
            showLabel={false}
            valueClass={fillValueClass(colSpan, rowSpan)}
          />
        </div>
      ) : (
        <div
          className="flex-1"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(colSpan, item.metrics.length).toString()}, 1fr)`, alignItems: 'center' }}
        >
          {item.metrics.map((ref, i) => (
            <FillCell
              key={`${ref.stationId}-${ref.metricKey}-${i.toString()}`}
              metricRef={ref}
              current={current}
              preferences={preferences}
              devices={devices}
              publicSourceReadings={publicSourceReadings}
              pinnedStationReadings={pinnedStationReadings}
              isExternalLoading={isExternalLoading}
              extrema={extrema}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground" data-test-id="custom-dashboard-fill-freshness">
        {freshness}
      </p>
    </div>
  );
}

function MetricBlockTile({
  item,
  current,
  preferences,
  devices,
  publicSourceReadings,
  pinnedStationReadings,
  isExternalLoading,
}: {
  readonly item: CustomMetricBlockItem;
  readonly current: UseDashboardCurrentResult;
  readonly preferences: UserPreferencesDto;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isExternalLoading: boolean;
}) {
  const extrema = useDashboardExtrema();
  const freshness = formatFreshness(
    resolveFreshnessSource(item.metrics, pinnedStationReadings, publicSourceReadings, current.data)?.receivedAtUtc,
  );
  const disconnectedMetrics = item.metrics.filter((metric) => (
    resolveSourceReading(metric, devices, pinnedStationReadings, publicSourceReadings, current.data, isExternalLoading)
      .isDisconnected
  ));

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border bg-card shadow text-card-foreground"
      data-test-id="custom-dashboard-block-tile"
    >
      {(item.name.length > 0 || item.icon) && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            {item.icon && item.iconPosition === 'left' && (
              <span data-test-id="custom-dashboard-block-icon-left"><BlockIconDisplay icon={item.icon} /></span>
            )}
            <div className="min-w-0 flex-1">
              {item.name.length > 0 && (
                <p className="text-sm font-semibold text-foreground" data-test-id="custom-dashboard-block-name">
                  {item.name}
                </p>
              )}
            </div>
            {item.icon && item.iconPosition !== 'left' && (
              <span data-test-id="custom-dashboard-block-icon-right"><BlockIconDisplay icon={item.icon} /></span>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto px-4 py-2">
        {item.metrics.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground" data-test-id="custom-dashboard-block-empty">
            No metrics configured.
          </p>
        ) : (
          <>
            {disconnectedMetrics.length === item.metrics.length && (
              <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200" data-test-id="custom-dashboard-block-disconnected">
                No available fields in this block. Reconnect the source or edit this tile in Settings.
              </p>
            )}
            <div className="divide-y divide-border/50">
              {item.metrics.map((ref, i) => (
                <MetricRow
                  key={`${ref.stationId}-${ref.metricKey}-${i.toString()}`}
                  metricRef={ref}
                  current={current}
                  preferences={preferences}
                  devices={devices}
                  publicSourceReadings={publicSourceReadings}
                  pinnedStationReadings={pinnedStationReadings}
                  isExternalLoading={isExternalLoading}
                  extrema={extrema}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground" data-test-id="custom-dashboard-block-freshness">
        {freshness}
      </p>
    </div>
  );
}

function MetricRow({
  metricRef,
  current,
  preferences,
  devices,
  publicSourceReadings,
  pinnedStationReadings,
  isExternalLoading,
  extrema,
}: {
  readonly metricRef: CustomMetricReference;
  readonly current: UseDashboardCurrentResult;
  readonly preferences: UserPreferencesDto;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly publicSourceReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly pinnedStationReadings: ReadonlyMap<string, CurrentReadingDto>;
  readonly isExternalLoading: boolean;
  readonly extrema: ReturnType<typeof useDashboardExtrema>;
}) {
  const definition = METRIC_REGISTRY[metricRef.metricKey];
  const isAggregate = definition.isAggregate;

  const {
    reading: sourceReading,
    isExternal: isExternalStation,
    isDisconnected,
    disconnectedMessage,
  } = resolveSourceReading(metricRef, devices, pinnedStationReadings, publicSourceReadings, current.data, isExternalLoading);
  const rawValue = isAggregate
    ? (extrema.data ? getAggregateMetricValue(extrema.data, metricRef.metricKey) : null)
    : definition.unitFamily === 'text'
      ? (sourceReading ? getMetricStringValue(sourceReading, metricRef.metricKey) : null)
      : (sourceReading ? getMetricValue(sourceReading, metricRef.metricKey) : null);

  const formatted = formatMetricValue(rawValue, definition.unitFamily, preferences);
  const label = metricRef.labelOverride ?? METRIC_KEY_LABELS[metricRef.metricKey];
  const sourceLabel = stationLabel(devices, metricRef);
  const ownedAmbientDevice = findOwnedAmbientDevice(devices, metricRef);
  const isPending = isAggregate ? extrema.isPending
    : (isExternalStation ? isExternalLoading : current.isPending);
  const isError = isAggregate ? extrema.isError
    : (isDisconnected || (isExternalStation ? sourceReading === undefined && !isExternalLoading : current.isError));
  const isValueUnavailable = isPending || isError;

  if (definition.unitFamily === 'text') {
    return (
      <div className="py-1.5" data-test-id="custom-dashboard-metric-row">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground" data-test-id="custom-dashboard-metric-label">
            {label}
          </p>
          <p className="truncate text-xs text-muted-foreground/60">{sourceLabel}</p>
          {isDisconnected && disconnectedMessage && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300" data-test-id="custom-dashboard-field-warning">
              {disconnectedMessage}
            </p>
          )}
        </div>
        <MetricHistoryValueLink
          metricKey={metricRef.metricKey}
          label={`${sourceLabel} · ${label}`}
          deviceId={ownedAmbientDevice?.macAddress}
          enabled={ownedAmbientDevice !== null && !isValueUnavailable}
          className="mt-0.5 text-xs font-semibold text-foreground break-words"
        >
          <span aria-live="polite" data-test-id="custom-dashboard-metric-value">
            {isPending ? '…' : isError ? '—' : formatted.value}
          </span>
        </MetricHistoryValueLink>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5" data-test-id="custom-dashboard-metric-row">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground" data-test-id="custom-dashboard-metric-label">
          {label}
        </p>
        <p className="truncate text-xs text-muted-foreground/70">{sourceLabel}</p>
        {isDisconnected && disconnectedMessage && (
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300" data-test-id="custom-dashboard-field-warning">
            {disconnectedMessage}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right" aria-live="polite">
        {isPending ? (
          <span className="text-sm text-muted-foreground" data-test-id="custom-dashboard-metric-value">…</span>
        ) : (
          <MetricHistoryValueLink
            metricKey={metricRef.metricKey}
            label={`${sourceLabel} · ${label}`}
            deviceId={ownedAmbientDevice?.macAddress}
            enabled={ownedAmbientDevice !== null && !isValueUnavailable}
            className="text-sm font-semibold text-foreground"
          >
            <span data-test-id="custom-dashboard-metric-value">
              {isError ? '—' : formatted.value}
              {!isError && formatted.unit.length > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">{formatted.unit}</span>
              )}
            </span>
          </MetricHistoryValueLink>
        )}
      </div>
    </div>
  );
}

function findOwnedAmbientDevice(
  devices: readonly SettingsDeviceDto[] | undefined,
  ref: CustomMetricReference,
): SettingsDeviceDto | null {
  if (!devices) return null;
  const mac = ref.stationId.toUpperCase().replace(/:/g, '');
  const device = devices.find(
    (d) => d.macAddress.toUpperCase().replace(/:/g, '') === mac,
  );
  if (!device) return null;
  return (device.sourceKind ?? 'ambient') === 'ambient' ? device : null;
}

function stationLabel(
  devices: readonly SettingsDeviceDto[] | undefined,
  ref: CustomMetricReference,
): string {
  if (!devices) return ref.stationId;
  const mac = ref.stationId.toUpperCase().replace(/:/g, '');
  const device = devices.find(
    (d) => d.macAddress.toUpperCase().replace(/:/g, '') === mac,
  );
  return device?.nickname ?? device?.name ?? ref.stationId;
}

function hasStationSource(
  devices: readonly SettingsDeviceDto[] | undefined,
  stationId: string,
): boolean {
  if (!devices) return false;
  const normalized = normalizeStationId(stationId);
  return devices.some((device) => normalizeStationId(device.macAddress) === normalized);
}

function normalizeStationId(stationId: string): string {
  return stationId.toUpperCase().replace(/:/g, '');
}
