import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useHasDataRouter } from '../../lib/useHasDataRouter';
import { ArrowDown, ArrowUp, Blocks, ChevronDown, ChevronRight, ListTree, Plus, Rows3, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  ALLOWED_METRIC_KEYS,
  METRIC_KEY_LABELS,
  type MetricKey,
  type SettingsDeviceDto,
} from '../../types/settings';
import { getDeviceSupportedMetricKeys } from '../../lib/providerMetricSupport';
import { weatherProviderLabel } from '../../lib/weatherProviderLabels';
import {
  CUSTOM_LAYOUT_MAX_ITEMS,
  CUSTOM_LAYOUT_TILE_SIZES,
  addMetricToBlock,
  createCustomLayoutItem,
  fillCapacity,
  isCustomLayoutTileSize,
  moveMetricInBlock,
  removeCustomLayoutItem,
  removeMetricFromBlock,
  setBlockDisplayMode,
  setBlockIcon,
  setBlockIconPosition,
  setBlockName,
  setDividerName,
  updateCustomLayoutItemSize,
  validateCustomLayoutItems,
  type CustomDividerItem,
  type CustomLayoutItem,
  type CustomLayoutItemType,
  type CustomMetricReference,
  type CustomMetricBlockItem,
  type CustomTickerItem,
} from '../../types/customLayout';
import { BLOCK_ICONS } from '../../lib/blockIcons';
import { normalizeMac } from '../../lib/macAddress';
import { UnsavedRouteGuard } from './UnsavedRouteGuard';

const MAX_METRICS_PER_BLOCK = 10;


function isExternalStationId(stationId: string): boolean {
  const normalized = stationId.toLowerCase();
  return normalized.startsWith('pinned:') || normalized.startsWith('public:');
}

function findDeviceByStationId(
  devices: readonly SettingsDeviceDto[],
  stationId: string,
): SettingsDeviceDto | undefined {
  const exact = devices.find((device) => device.macAddress === stationId);
  if (exact) return exact;

  const normalizedStationId = normalizeMac(stationId);
  return devices.find((device) => normalizeMac(device.macAddress) === normalizedStationId);
}

function isMetricSourceDisconnected(
  devices: readonly SettingsDeviceDto[],
  metric: CustomMetricReference,
  hasAmbientCredentials: boolean,
  isSourceInventoryLoading: boolean,
): boolean {
  if (isSourceInventoryLoading) return false;
  if (!isExternalStationId(metric.stationId) && !hasAmbientCredentials) return true;
  return findDeviceByStationId(devices, metric.stationId) === undefined;
}

function countDisconnectedMetrics(
  devices: readonly SettingsDeviceDto[],
  items: readonly CustomLayoutItem[],
  hasAmbientCredentials: boolean,
  isSourceInventoryLoading: boolean,
): number {
  return items.reduce((total, item) => {
    if (item.type !== 'metric-block') return total;
    return total + item.metrics.filter((metric) => (
      isMetricSourceDisconnected(devices, metric, hasAmbientCredentials, isSourceInventoryLoading)
    )).length;
  }, 0);
}

function getStationLabel(devices: readonly SettingsDeviceDto[], mac: string): string {
  const device = findDeviceByStationId(devices, mac);
  return device?.nickname ?? device?.name ?? mac;
}

function getPickerMetricKeys(
  devices: readonly SettingsDeviceDto[],
  stationId: string,
): readonly MetricKey[] {
  const source = devices.find((device) => device.macAddress === stationId);
  if (source) return getDeviceSupportedMetricKeys(source);
  return ALLOWED_METRIC_KEYS;
}

function getSourceKindLabel(source: SettingsDeviceDto | undefined): string {
  if (source?.sourceKind === 'public') return 'Public source';
  if (source?.sourceKind === 'pinned') return 'Pinned source';
  return 'Owned station';
}

function getItemTypeLabel(type: CustomLayoutItem['type']): string {
  if (type === 'metric-block') return 'Metric block';
  if (type === 'divider') return 'Divider';
  if (type === 'header-ticker') return 'Header ticker';
  return 'Footer ticker';
}

function getItemName(item: CustomLayoutItem): string {
  if (item.type === 'metric-block') return item.name || 'Metric block';
  return item.name ?? getItemTypeLabel(item.type);
}

function getItemSummary(item: CustomLayoutItem): string {
  if (item.type === 'metric-block') {
    const count = item.metrics.length;
    return `${count.toString()} metric${count !== 1 ? 's' : ''}`;
  }
  if (item.type === 'divider') {
    return item.name ? 'Named divider' : 'Blank divider';
  }
  return item.sourceLabels.length > 0
    ? `${item.sourceLabels.length.toString()} sources`
    : 'Paused ticker';
}

function AddItemButton({
  type,
  label,
  disabled,
  onAdd,
}: {
  readonly type: CustomLayoutItemType;
  readonly label: string;
  readonly disabled: boolean;
  readonly onAdd: (type: CustomLayoutItemType) => void;
}) {
  const Icon = type === 'metric-block' ? Blocks : type === 'divider' ? ListTree : Rows3;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => { onAdd(type); }}
      data-test-id={`settings-custom-layout-add-${type}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

function DividerEditor({
  item,
  onChange,
}: {
  readonly item: CustomDividerItem;
  readonly onChange: (updated: CustomLayoutItem) => void;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-3" data-test-id="settings-custom-layout-divider-editor">
      <div className="flex items-center gap-2">
        <Label htmlFor={`divider-name-${item.id}`} className="shrink-0 text-xs">Divider label</Label>
        <Input
          id={`divider-name-${item.id}`}
          value={item.name ?? ''}
          onChange={(e) => { onChange(setDividerName(item, e.target.value)); }}
          className="h-7 text-sm"
          placeholder="Optional"
          data-test-id="settings-custom-layout-divider-name"
        />
      </div>
    </div>
  );
}

function MetricBlockEditor({
  item,
  devices,
  hasAmbientCredentials,
  isSourceInventoryLoading,
  onChange,
}: {
  readonly item: CustomMetricBlockItem;
  readonly devices: readonly SettingsDeviceDto[];
  readonly hasAmbientCredentials: boolean;
  readonly isSourceInventoryLoading: boolean;
  readonly onChange: (updated: CustomLayoutItem) => void;
}) {
  const pickerDevices = useMemo(
    () => (
      hasAmbientCredentials
        ? devices
        : devices.filter((device) => isExternalStationId(device.macAddress))
    ),
    [devices, hasAmbientCredentials],
  );
  const [pickerMac, setPickerMac] = useState(pickerDevices[0]?.macAddress ?? '');
  const [pickerKey, setPickerKey] = useState<MetricKey>(ALLOWED_METRIC_KEYS[0]);
  const effectivePickerMac = pickerDevices.some((device) => device.macAddress === pickerMac)
    ? pickerMac
    : (pickerDevices[0]?.macAddress ?? '');
  const selectedSource = pickerDevices.find((device) => device.macAddress === effectivePickerMac);
  const pickerMetricKeys = getPickerMetricKeys(pickerDevices, effectivePickerMac);
  const effectivePickerKey = pickerMetricKeys.includes(pickerKey)
    ? pickerKey
    : (pickerMetricKeys[0] ?? ALLOWED_METRIC_KEYS[0]);

  const capacity = fillCapacity(item.size);
  const fillDisabled = item.metrics.length === 0 || item.metrics.length > capacity;
  const atMetricLimit = item.metrics.length >= MAX_METRICS_PER_BLOCK;
  const disconnectedMetricCount = item.metrics.filter((metric) => (
    isMetricSourceDisconnected(devices, metric, hasAmbientCredentials, isSourceInventoryLoading)
  )).length;
  const allMetricsDisconnected = item.metrics.length > 0 && disconnectedMetricCount === item.metrics.length;

  const handleAddMetric = () => {
    if (!effectivePickerMac || atMetricLimit) return;
    let updated = addMetricToBlock(item, { stationId: effectivePickerMac, metricKey: effectivePickerKey, labelOverride: null });
    if (item.name === '' && item.metrics.length === 0) {
      const source = getStationLabel(devices, effectivePickerMac);
      updated = setBlockName(updated, `${source} · ${METRIC_KEY_LABELS[effectivePickerKey]}`);
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3 border-t border-border pt-3" data-test-id="settings-custom-layout-block-editor">
      <div className="flex items-center gap-2">
        <Label htmlFor={`block-name-${item.id}`} className="shrink-0 text-xs">Block name</Label>
        <Input
          id={`block-name-${item.id}`}
          value={item.name}
          onChange={(e) => { onChange(setBlockName(item, e.target.value)); }}
          className="h-7 text-sm"
          placeholder="e.g. Comfort"
          data-test-id="settings-custom-layout-block-name"
        />
      </div>

      <div className="space-y-1" data-test-id="settings-custom-layout-icon-picker">
        <p className="text-xs text-muted-foreground">Block icon (optional)</p>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_ICONS.map(({ name, label, Icon }) => (
            <button
              key={name}
              type="button"
              title={label}
              aria-label={`${item.icon === name ? 'Remove' : 'Set'} ${label} icon`}
              aria-pressed={item.icon === name}
              onClick={() => { onChange(setBlockIcon(item, item.icon === name ? null : name)); }}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                item.icon === name
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
              data-test-id={`settings-custom-layout-icon-${name}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {item.icon && (
        <div className="flex items-center gap-2" data-test-id="settings-custom-layout-icon-position">
          <p className="text-xs text-muted-foreground">Icon position</p>
          {(['left', 'right'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              aria-label={`Icon on ${pos}`}
              aria-pressed={item.iconPosition === pos || (!item.iconPosition && pos === 'right')}
              onClick={() => { onChange(setBlockIconPosition(item, pos)); }}
              className={[
                'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                (item.iconPosition === pos || (!item.iconPosition && pos === 'right'))
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
              data-test-id={`settings-custom-layout-icon-position-${pos}`}
            >
              {pos.charAt(0).toUpperCase() + pos.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground" data-test-id="settings-custom-layout-metric-count">
          {item.metrics.length} / {MAX_METRICS_PER_BLOCK} metrics
        </span>
        {atMetricLimit && (
          <span className="text-xs font-medium text-destructive" data-test-id="settings-custom-layout-metric-limit-msg">
            10 metric limit reached
          </span>
        )}
      </div>

      {allMetricsDisconnected && (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive"
          role="alert"
          data-test-id="settings-custom-layout-block-disconnected"
        >
          All fields in this block reference disconnected sources. Reconnect the source, or replace/remove these fields.
        </p>
      )}

      {item.metrics.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-test-id="settings-custom-layout-metrics-empty">
          No metrics added yet.
        </p>
      ) : (
        <ol className="space-y-1" data-test-id="settings-custom-layout-metrics-list">
          {item.metrics.map((metric, index) => {
            const metricLabel = METRIC_KEY_LABELS[metric.metricKey];
            const canMoveMetricUp = index > 0;
            const canMoveMetricDown = index < item.metrics.length - 1;

            return (
              <li
                key={`${metric.stationId}-${metric.metricKey}-${index.toString()}`}
                className="rounded-sm border border-border bg-muted/30 px-2 py-1.5"
                data-test-id="settings-custom-layout-metric-row"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground" data-test-id="settings-custom-layout-metric-label">
                      {metricLabel}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground" data-test-id="settings-custom-layout-metric-station">
                      {getStationLabel(devices, metric.stationId)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    disabled={!canMoveMetricUp}
                    aria-label={canMoveMetricUp ? `Move ${metricLabel} up` : `${metricLabel} is already first in this block`}
                    title={canMoveMetricUp ? `Move ${metricLabel} up` : `${metricLabel} is already first in this block`}
                    onClick={() => { onChange(moveMetricInBlock(item, index, 'up')); }}
                    data-test-id="settings-custom-layout-metric-move-up"
                  >
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    disabled={!canMoveMetricDown}
                    aria-label={canMoveMetricDown ? `Move ${metricLabel} down` : `${metricLabel} is already last in this block`}
                    title={canMoveMetricDown ? `Move ${metricLabel} down` : `${metricLabel} is already last in this block`}
                    onClick={() => { onChange(moveMetricInBlock(item, index, 'down')); }}
                    data-test-id="settings-custom-layout-metric-move-down"
                  >
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                    aria-label={`Remove ${metricLabel}`}
                    onClick={() => { onChange(removeMetricFromBlock(item, index)); }}
                    data-test-id="settings-custom-layout-metric-remove"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
                {isMetricSourceDisconnected(devices, metric, hasAmbientCredentials, isSourceInventoryLoading) && (
                  <p
                    className="mt-1 text-xs font-medium text-destructive"
                    role="status"
                    data-test-id="settings-custom-layout-metric-disconnected"
                  >
                    Disconnected source. Reconnect {metric.stationId}, or replace/remove this field.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-end gap-2" data-test-id="settings-custom-layout-metric-picker">
        {pickerDevices.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`picker-station-${item.id}`}>
              Station
            </label>
            <select
              id={`picker-station-${item.id}`}
              value={effectivePickerMac}
              onChange={(e) => {
                const nextStation = e.target.value;
                const nextKeys = getPickerMetricKeys(pickerDevices, nextStation);
                setPickerMac(nextStation);
                setPickerKey(nextKeys.includes(pickerKey) ? pickerKey : (nextKeys[0] ?? ALLOWED_METRIC_KEYS[0]));
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              data-test-id="settings-custom-layout-metric-picker-station"
            >
              {pickerDevices.map((device) => (
                <option key={device.macAddress} value={device.macAddress}>
                  {getStationLabel(devices, device.macAddress)}
                </option>
              ))}
            </select>
            <div
              className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
              data-test-id="settings-custom-layout-metric-picker-source-provenance"
            >
              <span data-test-id="settings-custom-layout-metric-picker-source-kind">
                {getSourceKindLabel(selectedSource)}
              </span>
              {selectedSource?.provider && (
                <span
                  className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground"
                  data-test-id="settings-custom-layout-metric-picker-provider-badge"
                >
                  {weatherProviderLabel(selectedSource.provider)}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor={`picker-metric-${item.id}`}>
            Metric
          </label>
          <select
            id={`picker-metric-${item.id}`}
            value={effectivePickerKey}
            onChange={(e) => {
              const key = e.target.value;
              if ((ALLOWED_METRIC_KEYS as readonly string[]).includes(key)) {
                setPickerKey(key as MetricKey);
              }
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            data-test-id="settings-custom-layout-metric-picker-key"
          >
            {pickerMetricKeys.map((key) => (
              <option key={key} value={key}>{METRIC_KEY_LABELS[key]}</option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!effectivePickerMac || atMetricLimit}
          onClick={handleAddMetric}
          data-test-id="settings-custom-layout-metric-picker-add"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={`fill-mode-${item.id}`}
          checked={item.displayMode === 'fill'}
          disabled={fillDisabled}
          onChange={(e) => { onChange(setBlockDisplayMode(item, e.target.checked ? 'fill' : 'rows')); }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          data-test-id="settings-custom-layout-fill-mode"
        />
        <div>
          <label
            htmlFor={`fill-mode-${item.id}`}
            className="cursor-pointer text-xs font-medium text-foreground"
          >
            Fill tile
          </label>
          {fillDisabled && (
            <p className="text-xs text-muted-foreground" data-test-id="settings-custom-layout-fill-warning">
              {item.metrics.length === 0
                ? 'Add at least one metric to enable fill mode.'
                : `Fill mode for a ${item.size} block supports up to ${capacity.toString()} metrics.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const TICKER_SOURCE_LABEL_OPTIONS = [
  'outdoor_temp', 'outdoor_humidity', 'wind_speed', 'wind_dir',
  'pressure', 'uv_index', 'solar_radiation',
  'nws_sky_conditions', 'nws_present_weather',
  'nws_text_description', 'nws_raw_metar',
] as const satisfies readonly MetricKey[];

function TickerEditor({
  item,
  devices,
  onChange,
}: {
  readonly item: CustomTickerItem;
  readonly devices: readonly SettingsDeviceDto[];
  readonly onChange: (updated: CustomLayoutItem) => void;
}) {
  const channelId = item.channelStationId ?? '';
  const alertsZone = item.alertsZone ?? '';

  const setChannel = (value: string) => {
    onChange({ ...item, channelStationId: value === '' ? null : value });
  };

  const setAlertsZone = (value: string) => {
    onChange({ ...item, alertsZone: value === '' ? null : value.toUpperCase() });
  };

  const toggleLabel = (label: string) => {
    const next = item.sourceLabels.includes(label)
      ? item.sourceLabels.filter((l) => l !== label)
      : [...item.sourceLabels, label];
    onChange({ ...item, sourceLabels: next });
  };

  return (
    <div className="space-y-3 border-t border-border pt-3" data-test-id="settings-custom-layout-ticker-editor">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor={`ticker-channel-${item.id}`}>
          Channel source
        </label>
        <select
          id={`ticker-channel-${item.id}`}
          value={channelId}
          onChange={(e) => { setChannel(e.target.value); }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          data-test-id="settings-custom-layout-ticker-channel"
        >
          <option value="">Own Station</option>
          {devices.filter((d) => d.sourceKind === 'public' || d.sourceKind === 'pinned').map((d) => (
            <option key={d.macAddress} value={d.macAddress}>
              {d.nickname ?? d.name ?? d.macAddress}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-xs text-muted-foreground">Weather fields</legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {TICKER_SOURCE_LABEL_OPTIONS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
              data-test-id="settings-custom-layout-ticker-label-option"
            >
              <input
                type="checkbox"
                checked={item.sourceLabels.includes(key)}
                onChange={() => { toggleLabel(key); }}
                className="h-3.5 w-3.5 accent-primary"
                data-test-id={`settings-custom-layout-ticker-label-${key}`}
              />
              {METRIC_KEY_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`ticker-zone-${item.id}`} className="text-xs text-muted-foreground">
          NWS alerts zone <span className="opacity-60">(optional, e.g. NYZ072)</span>
        </Label>
        <Input
          id={`ticker-zone-${item.id}`}
          value={alertsZone}
          onChange={(e) => { setAlertsZone(e.target.value); }}
          maxLength={32}
          placeholder="e.g. NYZ072"
          className="h-8 w-40 text-sm uppercase"
          data-test-id="settings-custom-layout-ticker-zone"
        />
      </div>
    </div>
  );
}

function PreviewTile({
  item,
  devices,
  onFocus,
}: {
  readonly item: CustomLayoutItem;
  readonly devices: readonly SettingsDeviceDto[];
  readonly onFocus: (id: string) => void;
}) {
  const colSpan = parseInt(item.size.charAt(0), 10);
  const rowSpan = parseInt(item.size.charAt(2), 10);
  const minH = `${(rowSpan * 4).toString()}rem`;

  const baseClass = 'rounded-sm border border-border bg-muted/40 p-2 overflow-hidden cursor-pointer hover:border-ring hover:bg-accent/30 transition-colors';
  const style = { gridColumn: `span ${colSpan.toString()}`, gridRow: `span ${rowSpan.toString()}`, minHeight: minH };
  const handleClick = () => { onFocus(item.id); };

  const previewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
  };

  if (item.type === 'divider') {
    return (
      <div className={`${baseClass} flex items-center`} style={style} role="button" tabIndex={0} aria-label={`Preview: ${item.name ?? 'divider'}`} onClick={handleClick} onKeyDown={previewKeyDown} data-test-id="settings-custom-layout-preview-item">
        <div className="w-full">
          {item.name && <p className="mb-1 pr-3 text-xs font-medium text-muted-foreground">{item.name}</p>}
          <div className="h-px w-full bg-border" />
        </div>
      </div>
    );
  }

  if (item.type === 'header-ticker' || item.type === 'footer-ticker') {
    const tickerLabel = item.type === 'header-ticker' ? 'header ticker' : 'footer ticker';
    return (
      <div className={`${baseClass} flex items-center justify-center`} style={style} role="button" tabIndex={0} aria-label={`Preview: ${tickerLabel}`} onClick={handleClick} onKeyDown={previewKeyDown} data-test-id="settings-custom-layout-preview-item">
        <p className="text-xs italic text-muted-foreground">
          {item.type === 'header-ticker' ? 'Header ticker' : 'Footer ticker'}
        </p>
      </div>
    );
  }

  const block = item as CustomMetricBlockItem;
  const capacity = fillCapacity(block.size);
  const isFill = block.displayMode === 'fill' && block.metrics.length >= 1 && block.metrics.length <= capacity;

  return (
    <div className={baseClass} style={style} role="button" tabIndex={0} aria-label={`Preview: ${block.name.length > 0 ? block.name : 'metric block'}`} onClick={handleClick} onKeyDown={previewKeyDown} data-test-id="settings-custom-layout-preview-item">
      <div className="overflow-hidden pr-3">
        {block.name.length > 0 && (
          <p className="truncate text-xs font-semibold text-foreground">{block.name}</p>
        )}
        {isFill ? (
          <div
            className="mt-1 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${colSpan.toString()}, 1fr)` }}
          >
            {block.metrics.map((metric, i) => (
              <div key={i} className="flex items-center justify-center rounded bg-muted/30 p-1">
                <p className="truncate text-xs font-bold text-foreground" data-test-id="settings-custom-layout-preview-fill-label">
                  {METRIC_KEY_LABELS[metric.metricKey]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {block.metrics.map((metric, i) => (
              <li
                key={`${metric.stationId}-${metric.metricKey}-${i.toString()}`}
                className="truncate text-xs text-muted-foreground"
                data-test-id="settings-custom-layout-preview-metric"
              >
                {METRIC_KEY_LABELS[metric.metricKey]}
                <span className="ml-1 opacity-60">· {getStationLabel(devices, metric.stationId)}</span>
              </li>
            ))}
            {block.metrics.length === 0 && (
              <li className="text-xs italic text-muted-foreground">No metrics</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CustomLayoutBuilder({
  devices,
  initialItems = [],
  hasAmbientCredentials = true,
  isSourceInventoryLoading = false,
  onSave,
  isSaving = false,
  onItemsChange,
}: {
  readonly devices: readonly SettingsDeviceDto[];
  readonly initialItems?: readonly CustomLayoutItem[];
  readonly hasAmbientCredentials?: boolean;
  readonly isSourceInventoryLoading?: boolean;
  readonly onSave?: (items: readonly CustomLayoutItem[]) => Promise<void>;
  readonly isSaving?: boolean;
  readonly onItemsChange?: (items: readonly CustomLayoutItem[]) => void;
}) {
  const [items, setItems] = useState<readonly CustomLayoutItem[]>(initialItems);
  // Tracks the items as they were at the last successful save (or initial load).
  // Used as the "clean" baseline for hasUnsavedItems so that the UnsavedRouteGuard
  // deactivates immediately after a successful save, not after the parent remounts.
  const [lastSavedItems, setLastSavedItems] = useState<readonly CustomLayoutItem[]>(initialItems);
  const onItemsChangeRef = useRef(onItemsChange);
  useLayoutEffect(() => { onItemsChangeRef.current = onItemsChange; });
  useEffect(() => { onItemsChangeRef.current?.(items); }, [items]);
  const [nextItemNumber, setNextItemNumber] = useState(() => {
    let max = 0;
    for (const item of initialItems) {
      const match = /^custom-item-(\d+)$/.exec(item.id);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
    return max + 1;
  });
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const validation = useMemo(() => validateCustomLayoutItems(items), [items]);
  const disconnectedMetricCount = useMemo(
    () => countDisconnectedMetrics(devices, items, hasAmbientCredentials, isSourceInventoryLoading),
    [devices, hasAmbientCredentials, isSourceInventoryLoading, items],
  );
  const isAtLimit = items.length >= CUSTOM_LAYOUT_MAX_ITEMS;
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const focusItem = useCallback((id: string) => {
    setExpandedItemId(id);
    setTimeout(() => {
      itemRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

  const addItem = (type: CustomLayoutItemType) => {
    if (isAtLimit) return;
    const id = `custom-item-${nextItemNumber.toString()}`;
    setItems((current) => [...current, createCustomLayoutItem(type, id)]);
    setNextItemNumber((current) => current + 1);
    if (type === 'metric-block') setExpandedItemId(id);
  };

  const removeItem = (id: string) => {
    setItems((current) => removeCustomLayoutItem(current, id));
    setExpandedItemId((current) => (current === id ? null : current));
  };

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const updateSize = (itemId: string, size: string) => {
    if (!isCustomLayoutTileSize(size)) return;
    setItems((current) => current.map((item) => (
      item.id === itemId ? updateCustomLayoutItemSize(item, size) : item
    )));
  };

  const updateItem = (updated: CustomLayoutItem) => {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };
  const hasUnsavedItems = JSON.stringify(items) !== JSON.stringify(lastSavedItems);
  const hasDataRouter = useHasDataRouter();
  const saveItemsAndContinue = async (): Promise<boolean> => {
    if (!onSave) {
      return true;
    }

    setSaveError(null);
    setSavedMessage(false);
    try {
      const savedItems = items;
      await onSave(savedItems);
      setLastSavedItems(savedItems);
      setSavedMessage(true);
      setTimeout(() => { setSavedMessage(false); }, 3000);
      return true;
    } catch {
      setSaveError('Could not save. Please try again.');
      return false;
    }
  };
  const discardItems = () => {
    setItems(lastSavedItems);
    setExpandedItemId(null);
    setSavedMessage(false);
    setSaveError(null);
  };

  return (
    <section
      className="space-y-3 rounded-md border border-border bg-card p-3 text-card-foreground"
      aria-labelledby="custom-layout-heading"
      data-test-id="settings-custom-layout-builder"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="custom-layout-heading" className="text-sm font-semibold text-card-foreground">
            Custom Layout
          </h3>
          <p className="text-xs text-muted-foreground" data-test-id="settings-custom-layout-count">
            {items.length.toString()} / {CUSTOM_LAYOUT_MAX_ITEMS.toString()} items
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddItemButton type="metric-block" label="Add Block" disabled={isAtLimit} onAdd={addItem} />
          <AddItemButton type="divider" label="Add Divider" disabled={isAtLimit} onAdd={addItem} />
          <AddItemButton type="header-ticker" label="Header Ticker" disabled={isAtLimit} onAdd={addItem} />
          <AddItemButton type="footer-ticker" label="Footer Ticker" disabled={isAtLimit} onAdd={addItem} />
        </div>
      </div>

      {isAtLimit && (
        <p className="text-sm text-muted-foreground" role="status" data-test-id="settings-custom-layout-limit">
          Custom layouts are limited to 12 items.
        </p>
      )}

      {disconnectedMetricCount > 0 && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-test-id="settings-custom-layout-disconnected-warning"
        >
          {disconnectedMetricCount.toString()} saved custom layout field{disconnectedMetricCount === 1 ? '' : 's'} reference{disconnectedMetricCount === 1 ? 's' : ''} disconnected source{disconnectedMetricCount === 1 ? '' : 's'}. Reconnect the source, or replace/remove the field{disconnectedMetricCount === 1 ? '' : 's'}.
        </div>
      )}

      {hasDataRouter && (
        <UnsavedRouteGuard
          when={hasUnsavedItems}
          title="Save custom layout changes?"
          description="Your custom dashboard layout has unsaved changes."
          testId="settings-custom-layout-unsaved-prompt"
          isSaving={isSaving}
          onSave={saveItemsAndContinue}
          onDiscard={discardItems}
        />
      )}

      {!validation.isValid && (
        <div className="space-y-1 text-sm text-destructive" role="alert" data-test-id="settings-custom-layout-errors">
          {validation.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-[3]">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-test-id="settings-custom-layout-empty">
              No custom layout items yet.
            </p>
          ) : (
            <ol className="space-y-2" data-test-id="settings-custom-layout-list">
              {items.map((item, index) => {
                const isExpanded = expandedItemId === item.id;
                const isDivider = item.type === 'divider';
                const isMetricBlock = item.type === 'metric-block';
                const isTicker = item.type === 'header-ticker' || item.type === 'footer-ticker';
                const isExpandable = isDivider || isMetricBlock || isTicker;
                const itemName = getItemName(item);
                const canMoveItemUp = index > 0;
                const canMoveItemDown = index < items.length - 1;
                return (
                  <li
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el);
                      else itemRefs.current.delete(item.id);
                    }}
                    className={`rounded-md border p-3 text-foreground transition-colors ${expandedItemId === item.id ? 'border-ring bg-accent/20' : 'border-border bg-background'}`}
                    data-test-id="settings-custom-layout-item"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        {isExpandable && (
                          <button
                            type="button"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${itemName}`}
                            onClick={() => { setExpandedItemId((c) => (c === item.id ? null : item.id)); }}
                            data-test-id="settings-custom-layout-item-expand"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              : <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            }
                          </button>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground" data-test-id="settings-custom-layout-item-title">
                            {itemName}
                          </p>
                          <p className="text-xs text-muted-foreground" data-test-id="settings-custom-layout-item-summary">
                            {getItemTypeLabel(item.type)} · {getItemSummary(item)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-nowrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          Size
                          <select
                            value={item.size}
                            onChange={(event) => { updateSize(item.id, event.target.value); }}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                            data-test-id="settings-custom-layout-size-select"
                          >
                            {CUSTOM_LAYOUT_TILE_SIZES.map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={!canMoveItemUp}
                          aria-label={canMoveItemUp ? `Move ${itemName} up` : `${itemName} is already first`}
                          title={canMoveItemUp ? `Move ${itemName} up` : `${itemName} is already first`}
                          onClick={() => { moveItem(item.id, 'up'); }}
                          data-test-id="settings-custom-layout-move-up"
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={!canMoveItemDown}
                          aria-label={canMoveItemDown ? `Move ${itemName} down` : `${itemName} is already last`}
                          title={canMoveItemDown ? `Move ${itemName} down` : `${itemName} is already last`}
                          onClick={() => { moveItem(item.id, 'down'); }}
                          data-test-id="settings-custom-layout-move-down"
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Remove ${itemName}`}
                          onClick={() => { removeItem(item.id); }}
                          data-test-id="settings-custom-layout-remove-item"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && item.type === 'metric-block' && (
                      <MetricBlockEditor
                        item={item}
                        devices={devices}
                        hasAmbientCredentials={hasAmbientCredentials}
                        isSourceInventoryLoading={isSourceInventoryLoading}
                        onChange={updateItem}
                      />
                    )}
                    {isExpanded && item.type === 'divider' && (
                      <DividerEditor
                        item={item}
                        onChange={updateItem}
                      />
                    )}
                    {isExpanded && (item.type === 'header-ticker' || item.type === 'footer-ticker') && (
                      <TickerEditor
                        item={item}
                        devices={devices}
                        onChange={updateItem}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="min-w-0 flex-[2]" data-test-id="settings-custom-layout-preview-pane" aria-label="Preview pane">
          <p className="mb-2 text-xs font-medium text-muted-foreground">3-column preview</p>
          <div
            role="region"
            className="grid grid-cols-3 gap-2 rounded-md border border-dashed border-border p-2"
            aria-label="3-column preview"
            data-test-id="settings-custom-layout-preview"
          >
            {items.length === 0 ? (
              <div className="col-span-3 min-h-16 rounded-sm bg-muted/40" data-test-id="settings-custom-layout-preview-empty" />
            ) : (
              items.map((item) => (
                <PreviewTile key={item.id} item={item} devices={devices} onFocus={focusItem} />
              ))
            )}
          </div>
        </div>
      </div>
      {onSave && (
        <div className="flex items-center gap-3 flex-nowrap border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => {
              setSaveError(null);
              setSavedMessage(false);
              const savedItems = items;
              void onSave(savedItems).then(() => {
                setLastSavedItems(savedItems);
                setSavedMessage(true);
                setTimeout(() => { setSavedMessage(false); }, 3000);
              }).catch(() => {
                setSaveError('Could not save. Please try again.');
              });
            }}
            data-test-id="settings-custom-layout-save"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => {
              discardItems();
            }}
            data-test-id="settings-custom-layout-discard"
          >
            Reset
          </Button>
          {savedMessage && (
            <span
              className="text-sm text-green-800 dark:text-green-300"
              role="status"
              aria-live="polite"
              data-test-id="settings-custom-layout-saved-message"
            >
              Saved.
            </span>
          )}
          {saveError && (
            <span
              className="text-sm text-destructive"
              role="alert"
              aria-live="assertive"
              data-test-id="settings-custom-layout-save-error"
            >
              {saveError}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
