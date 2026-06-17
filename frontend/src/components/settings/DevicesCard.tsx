import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHasDataRouter } from '../../lib/useHasDataRouter';
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { CustomLayoutBuilder } from './CustomLayoutBuilder';
import { NeighborsConfigPanel } from './NeighborsConfigPanel';
import { UnsavedRouteGuard } from './UnsavedRouteGuard';
import { useDashboardLayout, useSaveDashboardLayout } from '../../hooks/useDashboardLayout';
import {
  useCreatePublicSource,
  useDeletePublicSource,
  usePublicSources,
  useUpdatePublicSource,
} from '../../hooks/usePublicSources';
import { useNeighborsConfig } from '../../hooks/useNeighborsConfig';
import { useSaveNeighborsConfig } from '../../hooks/useSaveNeighborsConfig';
import { useAuth } from '../../lib/auth';
import { getProviderSupportedMetricKeys, normalizeSupportedMetricKeys } from '../../lib/providerMetricSupport';
import { normalizeMac } from '../../lib/macAddress';
import { queryKeys } from '../../lib/queryKeys';
import { updateRuntimeSettingsDevice, withRuntimeMockStations } from '../../lib/runtimeMockStations';
import { weatherProviderLabel } from '../../lib/weatherProviderLabels';
import { getDevices, syncDevices, updateDevice } from '../../api/settings';
import {
  METRIC_KEY_LABELS,
  type SettingsDeviceDto,
  type MetricKey,
} from '../../types/settings';
import type { CustomLayoutItem, LayoutMode } from '../../types/customLayout';
import { discoverPublicSources } from '../../api/publicSources';
import {
  publicSourceDisplayName,
  sourceToDevice,
  type DiscoveredPublicSourceDto,
  type PublicWeatherSourceDto,
  type PublicWeatherSourceProvider,
} from '../../types/publicSources';
import { pinnedToDevice, type NeighborConfigDto, type PinnedNeighborStationDto } from '../../types/neighbors';

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function formatElevation(meters: number): string {
  const ft = Math.round(meters * 3.28084);
  return `${Math.round(meters).toString()} m (${ft.toLocaleString()} ft)`;
}

function StationInfoBlock({ device }: { readonly device: SettingsDeviceDto }) {
  const hasLocation = device.location ?? device.address ?? device.latitude !== null;
  if (!hasLocation) return null;

  return (
    <dl className="space-y-0.5 text-xs text-muted-foreground" data-test-id="settings-device-station-info">
      {device.location && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="font-medium">Location</dt>
          <dd>{device.location}</dd>
        </div>
      )}
      {device.address && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="font-medium">Address</dt>
          <dd>{device.address}</dd>
        </div>
      )}
      {device.latitude !== null && device.longitude !== null && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="font-medium">Coordinates</dt>
          <dd>{formatCoord(device.latitude, device.longitude)}</dd>
        </div>
      )}
      {device.elevationMeters !== null && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="font-medium">Elevation</dt>
          <dd>{formatElevation(device.elevationMeters)}</dd>
        </div>
      )}
    </dl>
  );
}


function PublicSourcesPanel() {
  const createMutation = useCreatePublicSource();
  const { getAccessToken } = useAuth();
  const [provider, setProvider] = useState<PublicWeatherSourceProvider>('WeatherGov');
  const [displayLabel, setDisplayLabel] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timezone, setTimezone] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [discoveryResults, setDiscoveryResults] = useState<readonly DiscoveredPublicSourceDto[] | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const resetForm = () => {
    setDisplayLabel('');
    setSourceId('');
    setLatitude('');
    setLongitude('');
    setTimezone('');
  };

  const providerId = useId();
  const labelId = useId();
  const sourceIdInputId = useId();
  const latitudeId = useId();
  const longitudeId = useId();
  const timezoneId = useId();

  const handleCreate = (event: React.SyntheticEvent) => {
    event.preventDefault();
    setMessage(null);
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setMessage('Coordinates must be valid numbers.');
      return;
    }
    void createMutation.mutateAsync({
      provider,
      displayLabel: displayLabel.trim(),
      sourceId: sourceId.trim(),
      latitude: lat,
      longitude: lon,
      timezone: timezone.trim() === '' ? null : timezone.trim(),
      isEnabled: true,
    }).then(() => {
      resetForm();
      setMessage('Saved.');
      setTimeout(() => { setMessage(null); }, 2500);
    }).catch(() => {
      setMessage('Could not save public source.');
    });
  };

  const handleDiscover = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setDiscoveryError(null);
    setDiscoveryResults(null);
    try {
      const token = await getAccessToken();
      const result = await discoverPublicSources(q, token);
      if (!result.ok) {
        setDiscoveryError('Could not search for public sources. Please try again.');
        return;
      }
      setDiscoveryResults(result.data);
    } catch {
      setDiscoveryError('Could not search for public sources. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddDiscovered = (discovered: DiscoveredPublicSourceDto) => {
    void createMutation.mutateAsync({
      provider: discovered.provider,
      displayLabel: discovered.displayLabel,
      sourceId: discovered.sourceId,
      latitude: discovered.latitude,
      longitude: discovered.longitude,
      timezone: discovered.timezone,
      isEnabled: true,
    }).then(() => {
      setDiscoveryResults((prev) => prev?.filter((d) => d.sourceId !== discovered.sourceId) ?? null);
    });
  };

  return (
    <section
      className="space-y-3"
      aria-label="Public source search and add"
      data-test-id="settings-public-sources-panel"
    >
      <form onSubmit={(e) => { void handleDiscover(e); }} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); }}
          placeholder="City, State or ZIP code"
          maxLength={128}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-test-id="settings-public-source-search-input"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!searchQuery.trim() || isSearching}
          data-test-id="settings-public-source-search-button"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {discoveryResults !== null && discoveryResults.length > 0 && (
        <div className="space-y-2" data-test-id="settings-public-source-search-results">
          {discoveryResults.map((result) => (
            <div key={result.sourceId} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>{result.displayLabel}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { handleAddDiscovered(result); }}
                data-test-id="settings-public-source-search-add"
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {discoveryResults !== null && discoveryResults.length === 0 && (
        <p className="text-sm text-muted-foreground" data-test-id="settings-public-source-search-empty">
          No public sources found for that location. Try a different city or ZIP code.
        </p>
      )}

      {discoveryError !== null && (
        <p className="text-sm text-destructive" role="alert" data-test-id="settings-public-source-search-error">
          {discoveryError}
        </p>
      )}

      <details className="text-sm" data-test-id="settings-public-source-manual-form">
        <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
          Add manually (advanced)
        </summary>
        <div className="mt-2">

      <form className="grid gap-2 md:grid-cols-6" onSubmit={handleCreate}>
        <label className="space-y-1 text-xs text-muted-foreground" htmlFor={providerId}>
          Provider
          <select
            id={providerId}
            value={provider}
            onChange={(event) => { setProvider(event.target.value as PublicWeatherSourceProvider); }}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            data-test-id="settings-public-source-provider"
          >
            <option value="WeatherGov">Weather.gov</option>
            <option value="OpenMeteo">Open-Meteo</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground md:col-span-2" htmlFor={labelId}>
          Label
          <Input
            id={labelId}
            value={displayLabel}
            onChange={(event) => { setDisplayLabel(event.target.value); }}
            required
            maxLength={128}
            data-test-id="settings-public-source-label"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground md:col-span-3" htmlFor={sourceIdInputId}>
          Source ID
          <Input
            id={sourceIdInputId}
            value={sourceId}
            onChange={(event) => { setSourceId(event.target.value); }}
            required
            maxLength={128}
            data-test-id="settings-public-source-id"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground" htmlFor={latitudeId}>
          Latitude
          <Input
            id={latitudeId}
            value={latitude}
            onChange={(event) => { setLatitude(event.target.value); }}
            required
            inputMode="decimal"
            data-test-id="settings-public-source-latitude"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground" htmlFor={longitudeId}>
          Longitude
          <Input
            id={longitudeId}
            value={longitude}
            onChange={(event) => { setLongitude(event.target.value); }}
            required
            inputMode="decimal"
            data-test-id="settings-public-source-longitude"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground md:col-span-2" htmlFor={timezoneId}>
          Timezone
          <Input
            id={timezoneId}
            value={timezone}
            onChange={(event) => { setTimezone(event.target.value); }}
            maxLength={64}
            data-test-id="settings-public-source-timezone"
          />
        </label>
        <div className="flex items-end md:col-span-2">
          <Button
            type="submit"
            size="sm"
            disabled={createMutation.isPending}
            data-test-id="settings-public-source-add"
          >
            {createMutation.isPending ? 'Saving…' : 'Add source'}
          </Button>
        </div>
      </form>

      {message && (
        <p className={message === 'Saved.' ? 'text-sm text-green-800 dark:text-green-300' : 'text-sm text-destructive'} role="status" data-test-id="settings-public-source-message">
          {message}
        </p>
      )}
        </div>
      </details>

    </section>
  );
}

function buildNeighborConfig(data: NeighborConfigDto | undefined): NeighborConfigDto {
  return {
    isEnabled: data?.isEnabled ?? false,
    enabledStationMacAddresses: data?.enabledStationMacAddresses ?? [],
    radiusMiles: data?.radiusMiles ?? 25,
    comparisonRadiusMiles: data?.comparisonRadiusMiles ?? 25,
    maxAgeMinutes: data?.maxAgeMinutes ?? 30,
    minStations: data?.minStations ?? 3,
    enabledProviders: data?.enabledProviders ?? ['WeatherGov', 'OpenMeteo'],
    refreshIntervalMinutes: data?.refreshIntervalMinutes ?? 15,
    discoveryLocationQuery: data?.discoveryLocationQuery ?? null,
    municipality: data?.municipality ?? null,
    isAmbientOpenAvailable: data?.isAmbientOpenAvailable,
    ambientOpenMaxRadiusMiles: data?.ambientOpenMaxRadiusMiles,
    pinnedStations: data?.pinnedStations ?? [],
  };
}

const DEVICE_ROW_OPEN_STORAGE_KEY = 'ambient-weather.settings.deviceRowOpenByMac';

async function hashDeviceRowPreferenceKey(macAddress: string): Promise<string> {
  const bytes = new TextEncoder().encode(macAddress);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function readDeviceRowOpenPreferencesForDevices(
  devices: readonly SettingsDeviceDto[],
): Promise<Record<string, boolean>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DEVICE_ROW_OPEN_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const stored = Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );

    const mappedEntries = await Promise.all(
      devices.map(async (device) => [device.macAddress, stored[await hashDeviceRowPreferenceKey(device.macAddress)] ?? false] as const),
    );
    return Object.fromEntries(mappedEntries);
  } catch {
    return {};
  }
}

async function writeDeviceRowOpenPreferences(value: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    const entries = await Promise.all(
      Object.entries(value).map(async ([macAddress, isOpen]) => [await hashDeviceRowPreferenceKey(macAddress), isOpen] as const),
    );
    window.localStorage.setItem(DEVICE_ROW_OPEN_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore storage failures; row expansion still works for the current render.
  }
}

function WeatherAlertsLocationSetting({
  config,
  isLoading,
  isDisabled,
  onSave,
}: {
  readonly config: NeighborConfigDto | undefined;
  readonly isLoading: boolean;
  readonly isDisabled: boolean;
  readonly onSave: (config: NeighborConfigDto) => Promise<NeighborConfigDto>;
}) {
  const [value, setValue] = useState(config?.municipality ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleBlur = () => {
    const nextValue = value.trim();
    const currentValue = config?.municipality?.trim() ?? '';
    if (nextValue === currentValue) return;

    setStatus('saving');
    void onSave({
      ...buildNeighborConfig(config),
      municipality: nextValue === '' ? null : nextValue,
    }).then(() => {
      setStatus('saved');
      setTimeout(() => { setStatus('idle'); }, 2500);
    }).catch(() => {
      setStatus('error');
    });
  };

  return (
    <section
      className="space-y-3 rounded-md border border-border p-4"
      aria-labelledby="settings-weather-alerts-heading"
      data-test-id="settings-weather-alerts-section"
    >
      <div className="space-y-1">
        <h3 id="settings-weather-alerts-heading" className="text-sm font-semibold text-foreground">
          Weather Alerts
        </h3>
        <p className="text-xs text-muted-foreground">
          Choose the area used for public weather alert lookups.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="settings-weather-alerts-location">Location for weather alerts (optional)</Label>
        <Input
          id="settings-weather-alerts-location"
          placeholder="City, ST"
          maxLength={128}
          value={value}
          disabled={isLoading || isDisabled}
          onChange={(event) => {
            setStatus('idle');
            setValue(event.target.value);
          }}
          onBlur={handleBlur}
          data-test-id="settings-weather-alerts-location-input"
        />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Leave blank to use your station&apos;s coordinates.
          </p>
          {status !== 'idle' && (
            <span
              className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
              role={status === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              data-test-id="settings-weather-alerts-save-status"
            >
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved.' : 'Could not save.'}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Full ordering/selection UI for a public or pinned station's metrics.
 * Mirrors DeviceRow's metric section: category up/down arrows, per-metric
 * up/down arrows, and an explicit Save button so ordering changes are
 * batched into a single API call.
 */
function SourceMetricSelector({
  supportedKeys,
  selectedMetricKeys,
  onChange,
  isBusy,
  rowId,
  testIdPrefix = 'settings-pinned',
  ariaLabel = 'Station metrics',
}: {
  readonly supportedKeys: readonly MetricKey[];
  readonly selectedMetricKeys: readonly string[] | null | undefined;
  readonly onChange: (keys: readonly MetricKey[]) => void;
  readonly isBusy: boolean;
  readonly rowId: string;
  readonly testIdPrefix?: string;
  readonly ariaLabel?: string;
}) {
  const supported = new Set<string>(supportedKeys);
  const normalizedSelected = normalizeSupportedMetricKeys(selectedMetricKeys, supportedKeys);
  const normalizedSelectedFiltered = normalizedSelected.filter((k) => supported.has(k));
  const savedSelectedKeys = normalizedSelectedFiltered.length > 0 ? normalizedSelectedFiltered : null;

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(normalizedSelectedFiltered));
  const [categoryOrder, setCategoryOrder] = useState<readonly string[]>(
    buildCategoryOrder(PINNED_METRIC_GROUPS, savedSelectedKeys),
  );
  const [metricOrder, setMetricOrder] = useState<MetricOrderByGroup>(
    buildMetricOrder(PINNED_METRIC_GROUPS, savedSelectedKeys, supportedKeys),
  );
  const [savedMessage, setSavedMessage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSavedMessage(false);
    try {
      onChange(getOrderedMetricKeys(selectedKeys, categoryOrder, metricOrder));
      setSavedMessage(true);
      setTimeout(() => { setSavedMessage(false); }, 3000);
    } catch {
      setSaveError('Could not save. Please try again.');
    }
  };

  const handleReset = () => {
    setSaveError(null);
    setSavedMessage(false);
    setSelectedKeys(new Set(normalizedSelectedFiltered));
    setCategoryOrder(buildCategoryOrder(PINNED_METRIC_GROUPS, savedSelectedKeys));
    setMetricOrder(buildMetricOrder(PINNED_METRIC_GROUPS, savedSelectedKeys, supportedKeys));
  };

  const toggleKey = (key: MetricKey) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const moveCategory = (groupId: string, direction: 'up' | 'down') => {
    setCategoryOrder((currentOrder) => {
      const index = currentOrder.indexOf(groupId);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) return currentOrder;
      const nextOrder = [...currentOrder];
      [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
      return nextOrder;
    });
  };

  const movePinnedMetric = (groupId: string, key: MetricKey, direction: 'up' | 'down') => {
    setMetricOrder((currentOrder) => {
      const groupKeys = currentOrder[groupId];
      const index = groupKeys.indexOf(key);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= groupKeys.length) return currentOrder;
      const nextGroupKeys = [...groupKeys];
      [nextGroupKeys[index], nextGroupKeys[nextIndex]] = [nextGroupKeys[nextIndex], nextGroupKeys[index]];
      return { ...currentOrder, [groupId]: nextGroupKeys };
    });
  };

  return (
    <form
      onSubmit={handleSave}
      className="space-y-3 border-t border-border pt-3"
      aria-label={ariaLabel}
      data-test-id={`${testIdPrefix}-metric-form-${rowId}`}
    >
      <p className="text-xs text-muted-foreground">Metrics to display</p>
      <MetricCategoryGrid
        groups={PINNED_METRIC_GROUPS}
        categoryOrder={categoryOrder}
        metricOrder={metricOrder}
        selectedKeys={selectedKeys}
        rowId={rowId}
        testIdPrefix={testIdPrefix}
        onToggleKey={toggleKey}
        onMoveCategory={moveCategory}
        onMoveMetric={movePinnedMetric}
        hideEmptyGroups
      />
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="submit"
          size="sm"
          disabled={isBusy}
          data-test-id={`${testIdPrefix}-metric-save-button-${rowId}`}
        >
          {isBusy ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={handleReset}
          data-test-id={`${testIdPrefix}-metric-reset-button-${rowId}`}
        >
          Reset
        </Button>
        {savedMessage && (
          <span className="text-sm text-green-800 dark:text-green-300" role="status" aria-live="polite">
            Saved.
          </span>
        )}
        {saveError && (
          <span className="text-sm text-destructive" role="alert" aria-live="assertive">
            {saveError}
          </span>
        )}
      </div>
    </form>
  );
}

function ExternalSourceRow({
  source,
  onUpdate,
  onDelete,
  isBusy,
}: {
  readonly source: PublicWeatherSourceDto;
  readonly onUpdate: (body: { readonly displayLabel?: string | null; readonly isEnabled?: boolean; readonly selectedMetricKeys?: readonly string[] | null }) => void;
  readonly onDelete: () => void;
  readonly isBusy: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const macId = `public-${source.id}`;
  const providerLabel = weatherProviderLabel(source.provider);

  return (
    <article
      className="space-y-3 rounded-md border border-border bg-surface-layer-3 p-4 text-card-foreground"
      data-test-id={`settings-external-source-row-${macId}`}
      aria-label={`Public source: ${publicSourceDisplayName(source)}`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span
                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                data-test-id="settings-external-source-provider-badge"
              >
                {providerLabel}
              </span>
            </div>
            <Input
              defaultValue={source.displayLabel}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                if (value !== source.displayLabel && value.length > 0) {
                  onUpdate({ displayLabel: value });
                }
              }}
              className="mt-1 h-7 w-48 text-sm"
              aria-label="Public source label"
              data-test-id={`settings-external-source-label-edit-${macId}`}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-card-foreground">
              <input
                type="checkbox"
                checked={source.isEnabled}
                onChange={(event) => { onUpdate({ isEnabled: event.target.checked }); }}
                className="h-4 w-4 accent-primary"
                aria-label={`Show ${publicSourceDisplayName(source)} on dashboard`}
                data-test-id={`settings-external-source-visibility-toggle-${macId}`}
              />
              Dashboard
            </label>
            <button
              type="button"
              onClick={() => { setIsOpen((v) => !v); }}
              aria-expanded={isOpen}
              aria-controls={contentId}
              aria-label={isOpen ? `Collapse ${publicSourceDisplayName(source)}` : `Expand ${publicSourceDisplayName(source)}`}
              className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              data-test-id={`settings-external-source-toggle-${macId}`}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                aria-hidden="true"
              />
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isBusy}
              onClick={onDelete}
            aria-label={`Unpin ${publicSourceDisplayName(source)}`}
            data-test-id={`settings-external-source-delete-${macId}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground" data-test-id={`settings-external-source-details-${macId}`}>
          {source.sourceId} · {formatCoord(source.latitude, source.longitude)}
        </p>
      </div>
      {isOpen && (
        <div id={contentId}>
          <SourceMetricSelector
            supportedKeys={getProviderSupportedMetricKeys('public', source.provider) ?? []}
            selectedMetricKeys={source.selectedMetricKeys}
            onChange={(keys) => { onUpdate({ selectedMetricKeys: keys }); }}
            isBusy={isBusy}
            rowId={macId}
            testIdPrefix="settings-external-source"
            ariaLabel="Public source metrics"
          />
        </div>
      )}
    </article>
  );
}

function PinnedSourceRow({
  pin,
  onUnpin,
  onLabelChange,
  onVisibilityChange,
  onMetricsChange,
  isBusy,
}: {
  readonly pin: PinnedNeighborStationDto;
  readonly onUnpin: () => void;
  readonly onLabelChange: (label: string) => void;
  readonly onVisibilityChange: (checked: boolean) => void;
  readonly onMetricsChange: (keys: readonly MetricKey[]) => void;
  readonly isBusy: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const label = pin.displayLabel ?? pin.sourceId;
  const rowId = `pinned-${pin.provider}-${pin.sourceId}`;
  const providerLabel = weatherProviderLabel(pin.provider);

  return (
    <article
      className="space-y-3 rounded-md border border-border bg-surface-layer-3 p-4 text-card-foreground"
      data-test-id={`settings-pinned-source-row-${rowId}`}
      aria-label={`Pinned station: ${label}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              data-test-id="settings-pinned-source-badge"
            >
              Pinned
            </span>
            <span
              className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
              data-test-id="settings-pinned-source-provider"
            >
              {providerLabel}
            </span>
          </div>
          <Input
            defaultValue={label}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value !== label && value.length > 0) {
                onLabelChange(value);
              }
            }}
            className="mt-1 h-7 w-48 text-sm"
            aria-label="Pinned station label"
            data-test-id={`settings-pinned-source-label-edit-${rowId}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-card-foreground">
            <input
              type="checkbox"
              checked={pin.isEnabled ?? true}
              onChange={(event) => { onVisibilityChange(event.target.checked); }}
              className="h-4 w-4 accent-primary"
              aria-label={`Show ${label} on dashboard`}
              data-test-id={`settings-pinned-source-visibility-toggle-${rowId}`}
            />
            Dashboard
          </label>
          <button
            type="button"
            onClick={() => { setIsOpen((v) => !v); }}
            aria-expanded={isOpen}
            aria-controls={contentId}
            aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
            className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-test-id={`settings-pinned-source-toggle-${rowId}`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
              aria-hidden="true"
            />
          </button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={isBusy}
            onClick={onUnpin}
            aria-label={`Unpin ${label}`}
            data-test-id={`settings-pinned-source-unpin-${rowId}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-test-id={`settings-pinned-source-details-${rowId}`}>
        {pin.sourceId}
      </p>
      {isOpen && (
        <div id={contentId}>
          <SourceMetricSelector
            supportedKeys={getProviderSupportedMetricKeys('pinned', pin.provider) ?? []}
            selectedMetricKeys={pin.selectedMetricKeys}
            onChange={onMetricsChange}
            isBusy={isBusy}
            rowId={rowId}
          />
        </div>
      )}
    </article>
  );
}

const METRIC_GROUPS = [
  {
    id: 'temperature',
    label: 'Temperature',
    keys: [
      'outdoor_temp', 'feels_like', 'dew_point', 'daily_high_temp', 'daily_low_temp',
      'indoor_temp', 'indoor_feels_like', 'indoor_dew_point', 'daily_high_temp_in', 'daily_low_temp_in',
    ],
  },
  { id: 'atmosphere', label: 'Atmosphere', keys: ['outdoor_humidity', 'indoor_humidity', 'pressure'] },
  { id: 'wind', label: 'Wind', keys: ['wind_dir', 'wind_speed', 'wind_gust', 'max_daily_gust'] },
  { id: 'sun-uv', label: 'Sun & UV', keys: ['solar_radiation', 'uv_index'] },
  {
    id: 'rainfall',
    label: 'Rainfall',
    keys: ['rainfall_event', 'rainfall_day', 'rainfall_week', 'rainfall_month', 'rainfall_year'],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly keys: readonly MetricKey[];
}[];

interface SettingsMetricGroup {
  readonly id: string;
  readonly label: string;
  readonly keys: readonly MetricKey[];
}

type MetricOrderByGroup = Record<string, readonly MetricKey[]>;

// Pinned/public groups extend the owned-device groups with provider-only keys
// (NWS text products and Open-Meteo extended metrics). buildGroupKeys intersects
// these templates with the provider-supported list, so unsupported keys stay hidden.
const PINNED_METRIC_GROUPS = [
  METRIC_GROUPS[0],
  {
    id: 'atmosphere',
    label: 'Atmosphere',
    keys: [
      'outdoor_humidity', 'indoor_humidity', 'pressure',
      'om_cloud_cover', 'om_precip_probability',
    ],
  },
  {
    id: 'wind',
    label: 'Wind',
    keys: [
      'wind_dir', 'wind_speed', 'wind_gust', 'max_daily_gust',
      'om_wind_speed_max', 'om_wind_gust_max', 'om_wind_dir_dominant',
    ],
  },
  { id: 'sun-uv', label: 'Sun & UV', keys: ['solar_radiation', 'uv_index', 'om_uv_index_max'] },
  METRIC_GROUPS[4],
  {
    id: 'conditions',
    label: 'Conditions',
    keys: [
      'nws_sky_conditions', 'nws_present_weather',
      'nws_text_description', 'nws_raw_metar',
      'om_weather_description', 'om_sunrise', 'om_sunset', 'om_precip_sum',
    ],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly keys: readonly MetricKey[];
}[];

function isMetricKeyForGroup(
  group: SettingsMetricGroup,
  key: string,
): key is MetricKey {
  return (group.keys as readonly string[]).includes(key);
}

function buildCategoryOrder(
  groups: readonly SettingsMetricGroup[],
  selectedMetricKeys: readonly string[] | null,
): readonly string[] {
  const orderedIds: string[] = [];

  for (const key of selectedMetricKeys ?? []) {
    const group = groups.find((candidate) => isMetricKeyForGroup(candidate, key));
    if (group && !orderedIds.includes(group.id)) {
      orderedIds.push(group.id);
    }
  }

  for (const group of groups) {
    if (!orderedIds.includes(group.id)) {
      orderedIds.push(group.id);
    }
  }

  return orderedIds;
}

function buildMetricOrder(
  groups: readonly SettingsMetricGroup[],
  selectedMetricKeys: readonly string[] | null,
  supportedKeys?: readonly MetricKey[],
): MetricOrderByGroup {
  const selectedKeys = selectedMetricKeys ?? [];
  const supported = supportedKeys ? new Set<string>(supportedKeys) : null;
  const buildGroupKeys = (group: SettingsMetricGroup): readonly MetricKey[] => {
    const groupKeys = supported ? group.keys.filter((key) => supported.has(key)) : group.keys;
    const savedKeys = selectedKeys.filter(
      (key): key is MetricKey => groupKeys.some((groupKey) => groupKey === key),
    );
    const remainingKeys = groupKeys.filter((key) => !savedKeys.includes(key));
    return [...savedKeys, ...remainingKeys];
  };

  return Object.fromEntries(groups.map((group) => [group.id, buildGroupKeys(group)]));
}

function getOrderedMetricKeys(
  selectedKeys: ReadonlySet<string>,
  categoryOrder: readonly string[],
  metricOrder: MetricOrderByGroup,
): readonly MetricKey[] {
  return categoryOrder.flatMap((groupId) => {
    return (metricOrder[groupId] ?? []).filter((key) => selectedKeys.has(key));
  });
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function MetricCategoryGrid({
  groups,
  categoryOrder,
  metricOrder,
  selectedKeys,
  rowId,
  testIdPrefix,
  onToggleKey,
  onMoveCategory,
  onMoveMetric,
  hideEmptyGroups = false,
}: {
  readonly groups: readonly SettingsMetricGroup[];
  readonly categoryOrder: readonly string[];
  readonly metricOrder: MetricOrderByGroup;
  readonly selectedKeys: ReadonlySet<string>;
  readonly rowId: string;
  readonly testIdPrefix: string;
  readonly onToggleKey: (key: MetricKey) => void;
  readonly onMoveCategory: (groupId: string, direction: 'up' | 'down') => void;
  readonly onMoveMetric: (groupId: string, key: MetricKey, direction: 'up' | 'down') => void;
  readonly hideEmptyGroups?: boolean;
}) {
  const orderedGroups = categoryOrder
    .map((groupId) => groups.find((group) => group.id === groupId))
    .filter((group): group is SettingsMetricGroup => group !== undefined)
    .filter((group) => !hideEmptyGroups || metricOrder[group.id].length > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {orderedGroups.map((group, groupIndex) => {
        const groupKeys = metricOrder[group.id] ?? [];
        const canMoveCategoryUp = groupIndex > 0;
        const canMoveCategoryDown = groupIndex < orderedGroups.length - 1;

        return (
          <fieldset
            key={group.id}
            className="space-y-3 rounded-md border border-border p-3"
            data-test-id={`${testIdPrefix}-metric-category-${rowId}-${group.id}`}
          >
            <legend className="w-full">
              <div className="mb-1 flex items-center justify-between gap-2 rounded-sm border-b border-border bg-muted/40 px-2 py-1.5">
                <span className="text-sm font-semibold text-card-foreground">{group.label}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                    onClick={() => { onMoveCategory(group.id, 'up'); }}
                    disabled={!canMoveCategoryUp}
                    aria-label={canMoveCategoryUp ? `Move ${group.label} category up` : `${group.label} category is already first`}
                    title={canMoveCategoryUp ? `Move ${group.label} category up` : `${group.label} category is already first`}
                    data-test-id={`${testIdPrefix}-metric-category-move-up-${rowId}-${group.id}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                    onClick={() => { onMoveCategory(group.id, 'down'); }}
                    disabled={!canMoveCategoryDown}
                    aria-label={canMoveCategoryDown ? `Move ${group.label} category down` : `${group.label} category is already last`}
                    title={canMoveCategoryDown ? `Move ${group.label} category down` : `${group.label} category is already last`}
                    data-test-id={`${testIdPrefix}-metric-category-move-down-${rowId}-${group.id}`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </legend>
            <div className="space-y-1 text-sm">
              {groupKeys.map((key, keyIndex) => {
                const metricLabel = METRIC_KEY_LABELS[key];
                const canMoveMetricUp = keyIndex > 0;
                const canMoveMetricDown = keyIndex < groupKeys.length - 1;

                return (
                  <div
                    key={key}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-foreground"
                    data-test-id={`${testIdPrefix}-metric-row-${rowId}-${key}`}
                  >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => { onToggleKey(key); }}
                      className="h-4 w-4 accent-primary"
                      aria-label={metricLabel}
                      data-test-id={`${testIdPrefix}-metric-${rowId}-${key}`}
                    />
                    <span className="truncate">{metricLabel}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                      onClick={() => { onMoveMetric(group.id, key, 'up'); }}
                      disabled={!canMoveMetricUp}
                      aria-label={canMoveMetricUp ? `Move ${metricLabel} field up` : `${metricLabel} field is already first in ${group.label}`}
                      title={canMoveMetricUp ? `Move ${metricLabel} field up` : `${metricLabel} field is already first in ${group.label}`}
                      data-test-id={`${testIdPrefix}-metric-move-up-${rowId}-${key}`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                      onClick={() => { onMoveMetric(group.id, key, 'down'); }}
                      disabled={!canMoveMetricDown}
                      aria-label={canMoveMetricDown ? `Move ${metricLabel} field down` : `${metricLabel} field is already last in ${group.label}`}
                      title={canMoveMetricDown ? `Move ${metricLabel} field down` : `${metricLabel} field is already last in ${group.label}`}
                      data-test-id={`${testIdPrefix}-metric-move-down-${rowId}-${key}`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function DeviceRow({
  device,
  isOnlyDevice,
  isNeighborComparisonEnabled,
  isNeighborComparisonSaving,
  onNeighborComparisonChange,
  isRowOpen,
  onRowOpenChange,
}: {
  readonly device: SettingsDeviceDto;
  readonly isOnlyDevice: boolean;
  readonly isNeighborComparisonEnabled: boolean;
  readonly isNeighborComparisonSaving: boolean;
  readonly onNeighborComparisonChange: (checked: boolean) => void;
  readonly isRowOpen: boolean;
  readonly onRowOpenChange: (isOpen: boolean) => void;
}) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const rowContentId = useId();
  const [nickname, setNickname] = useState(device.nickname ?? '');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(device.selectedMetricKeys ?? []),
  );
  const [categoryOrder, setCategoryOrder] = useState<readonly string[]>(
    buildCategoryOrder(METRIC_GROUPS, device.selectedMetricKeys),
  );
  const [metricOrder, setMetricOrder] = useState<MetricOrderByGroup>(
    buildMetricOrder(METRIC_GROUPS, device.selectedMetricKeys),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [autoSavedMessage, setAutoSavedMessage] = useState(false);
  const [isAutoSavePending, setIsAutoSavePending] = useState(false);

  const macId = normalizeMac(device.macAddress).toLowerCase();

  const showSavedMessage = () => {
    setSavedMessage(true);
    setTimeout(() => { setSavedMessage(false); }, 3000);
  };

  const showAutoSavedMessage = () => {
    setAutoSavedMessage(true);
    setTimeout(() => { setAutoSavedMessage(false); }, 3000);
  };

  const applyLocalDevicePatch = (patch: Parameters<typeof updateDevice>[1]) => {
    queryClient.setQueryData<readonly SettingsDeviceDto[] | undefined>(
      queryKeys.settings.devices(),
      (current) => updateRuntimeSettingsDevice(current, device.macAddress, patch),
    );
  };

  const updateMutation = useMutation({
    mutationFn: async (patch: Parameters<typeof updateDevice>[1]) => {
      const token = await getAccessToken();
      return updateDevice(device.macAddress, patch, token);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.devices() });
      const previousDevices = queryClient.getQueryData<readonly SettingsDeviceDto[]>(
        queryKeys.settings.devices(),
      );
      applyLocalDevicePatch(patch);
      return { previousDevices };
    },
    onSuccess: (result, patch, context) => {
      if (!result.ok) {
        if (context.previousDevices) {
          queryClient.setQueryData(queryKeys.settings.devices(), context.previousDevices);
        }
        setSaveError('Could not save. Please try again.');
        return;
      }
      setSaveError(null);
      if (patch.isPrimary === true) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.current() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.rainfall() });
      }
    },
    onError: (_error, _patch, context) => {
      if (context?.previousDevices) {
        queryClient.setQueryData(queryKeys.settings.devices(), context.previousDevices);
      }
      setSaveError('An unexpected error occurred.');
    },
  });

  const saveDeviceEdits = async (): Promise<boolean> => {
    setSaveError(null);
    setSavedMessage(false);
    if (device.isMock === true) {
      applyLocalDevicePatch({
        nickname: nickname || null,
        selectedMetricKeys: getOrderedMetricKeys(selectedKeys, categoryOrder, metricOrder),
      });
      showSavedMessage();
      return true;
    }

    const result = await updateMutation.mutateAsync({
      nickname: nickname || null,
      selectedMetricKeys: getOrderedMetricKeys(selectedKeys, categoryOrder, metricOrder),
    });
    if (result.ok) {
      showSavedMessage();
      return true;
    }
    return false;
  };

  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault();
    void saveDeviceEdits();
  };

  const handleReset = () => {
    setSaveError(null);
    setSavedMessage(false);
    setNickname(device.nickname ?? '');
    setSelectedKeys(new Set(device.selectedMetricKeys ?? []));
    setCategoryOrder(buildCategoryOrder(METRIC_GROUPS, device.selectedMetricKeys));
    setMetricOrder(buildMetricOrder(METRIC_GROUPS, device.selectedMetricKeys));
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const handleVisibilityChange = (checked: boolean) => {
    setSaveError(null);
    setAutoSavedMessage(false);
    setIsAutoSavePending(false);
    if (!checked) {
      onNeighborComparisonChange(false);
    }
    // A hidden station cannot be the primary station.
    const patch = checked
      ? { displayOnDashboard: true }
      : { displayOnDashboard: false, ...(device.isPrimary ? { isPrimary: false } : {}) };
    if (device.isMock === true) {
      applyLocalDevicePatch(patch);
      showAutoSavedMessage();
      return;
    }

    setIsAutoSavePending(true);
    updateMutation.mutate(
      patch,
      {
        onSuccess: (result) => { if (result.ok) showAutoSavedMessage(); },
        onSettled: () => { setIsAutoSavePending(false); },
      },
    );
  };

  const handlePrimaryChange = () => {
    setSaveError(null);
    setAutoSavedMessage(false);
    setIsAutoSavePending(false);
    if (device.isMock === true) {
      applyLocalDevicePatch({ isPrimary: true });
      showAutoSavedMessage();
      return;
    }

    if (!device.isPrimary) {
      setIsAutoSavePending(true);
      updateMutation.mutate(
        { isPrimary: true },
        {
          onSuccess: (result) => { if (result.ok) showAutoSavedMessage(); },
          onSettled: () => { setIsAutoSavePending(false); },
        },
      );
    }
  };

  const moveCategory = (groupId: string, direction: 'up' | 'down') => {
    setCategoryOrder((currentOrder) => {
      const index = currentOrder.indexOf(groupId);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) {
        return currentOrder;
      }

      const nextOrder = [...currentOrder];
      [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
      return nextOrder;
    });
  };

  const moveMetric = (groupId: string, key: MetricKey, direction: 'up' | 'down') => {
    setMetricOrder((currentOrder) => {
      const groupKeys = currentOrder[groupId];
      const index = groupKeys.indexOf(key);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= groupKeys.length) {
        return currentOrder;
      }

      const nextGroupKeys = [...groupKeys];
      [nextGroupKeys[index], nextGroupKeys[nextIndex]] = [nextGroupKeys[nextIndex], nextGroupKeys[index]];
      return {
        ...currentOrder,
        [groupId]: nextGroupKeys,
      };
    });
  };

  const orderedMetricKeys = getOrderedMetricKeys(selectedKeys, categoryOrder, metricOrder);
  const savedMetricKeys = device.selectedMetricKeys ?? [];
  const hasUnsavedDeviceEdits =
    nickname !== (device.nickname ?? '') ||
    !arraysEqual(orderedMetricKeys, savedMetricKeys);
  const hasDataRouter = useHasDataRouter();

  return (
    <article
      className="space-y-3 rounded-md border border-border bg-surface-layer-3 p-4 text-card-foreground"
      data-test-id={`settings-device-row-${macId}`}
      aria-label={`Station: ${device.nickname ?? device.name ?? device.macAddress}`}
    >
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p
              className="text-sm font-medium text-card-foreground"
              data-test-id={`settings-device-title-${macId}`}
            >
              {device.nickname ?? device.name ?? device.macAddress}
            </p>
            <p className="text-xs text-muted-foreground">{device.macAddress}</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-card-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={device.displayOnDashboard && isNeighborComparisonEnabled}
                onChange={(e) => { onNeighborComparisonChange(e.target.checked); }}
                disabled={isNeighborComparisonSaving || !device.displayOnDashboard}
                className="h-4 w-4 accent-primary disabled:opacity-40"
                aria-label={`Enable neighbor comparison for ${device.name ?? device.macAddress}`}
                data-test-id={`settings-device-neighbor-comparison-toggle-${macId}`}
              />
              Neighbor comparison
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={device.displayOnDashboard}
                onChange={(e) => { handleVisibilityChange(e.target.checked); }}
                className="h-4 w-4 accent-primary"
                aria-label={`Show ${device.name ?? device.macAddress} on dashboard`}
                data-test-id={`settings-device-visibility-toggle-${macId}`}
              />
              Dashboard
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="primary-station"
                checked={device.isPrimary}
                onChange={handlePrimaryChange}
                disabled={isOnlyDevice || !device.displayOnDashboard}
                className="h-4 w-4 accent-primary"
                aria-label={`Set ${device.name ?? device.macAddress} as primary station`}
                data-test-id={`settings-device-primary-radio-${macId}`}
              />
              Primary
            </label>
            <button
              type="button"
              onClick={() => { onRowOpenChange(!isRowOpen); }}
              aria-expanded={isRowOpen}
              aria-controls={rowContentId}
              aria-label={isRowOpen ? `Collapse ${device.name ?? device.macAddress}` : `Expand ${device.name ?? device.macAddress}`}
              className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              data-test-id={`settings-device-row-toggle-${macId}`}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isRowOpen ? '' : '-rotate-90'}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        {/* Always rendered so it reserves its height; invisible keeps the space when no message.
            aria-hidden when inactive removes the element from the AOM so the aria-live region
            cannot announce the content-change back to whitespace after 'Saved.' disappears. */}
        <p
          className={`text-xs text-muted-foreground text-right ${(!isAutoSavePending && !autoSavedMessage) ? 'invisible' : ''}`}
          role="status"
          aria-live="polite"
          aria-hidden={(!isAutoSavePending && !autoSavedMessage) || undefined}
          data-test-id={`settings-device-autosave-status-${macId}`}
        >
          {(isAutoSavePending || autoSavedMessage) ? (isAutoSavePending ? 'Saving…' : 'Saved.') : ' '}
        </p>
      </div>

      {hasDataRouter && (
        <UnsavedRouteGuard
          when={hasUnsavedDeviceEdits}
          title="Save layout changes?"
          description="This station has unsaved metric layout changes."
          testId={`settings-device-unsaved-prompt-${macId}`}
          isSaving={updateMutation.isPending}
          onSave={saveDeviceEdits}
          onDiscard={handleReset}
        />
      )}

      {isRowOpen && (
      <div id={rowContentId}>
      {device.isMock === true && (
        <p className="text-xs text-muted-foreground" data-test-id={`settings-device-runtime-mock-note-${macId}`}>
          Runtime mock station for dashboard preview. It is not saved to Ambient Weather.
        </p>
      )}
      <StationInfoBlock device={device} />

      <form onSubmit={handleSave} className="space-y-3 mt-3" aria-label={`Edit ${device.macAddress}`}>
        <div className="space-y-1">
          <Label htmlFor={`nickname-${macId}`}>Nickname</Label>
          <Input
            id={`nickname-${macId}`}
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); }}
            maxLength={128}
            placeholder={device.name ?? ''}
            data-test-id={`settings-device-nickname-input-${macId}`}
          />
        </div>

        <div className="space-y-2" role="group" aria-labelledby={`metrics-heading-${macId}`}>
          <h3 id={`metrics-heading-${macId}`} className="text-sm font-medium">Metrics to display</h3>
          <MetricCategoryGrid
            groups={METRIC_GROUPS}
            categoryOrder={categoryOrder}
            metricOrder={metricOrder}
            selectedKeys={selectedKeys}
            rowId={macId}
            testIdPrefix="settings-device"
            onToggleKey={toggleKey}
            onMoveCategory={moveCategory}
            onMoveMetric={moveMetric}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            type="submit"
            size="sm"
            disabled={updateMutation.isPending}
            data-test-id={`settings-device-save-button-${macId}`}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={updateMutation.isPending}
            onClick={handleReset}
            data-test-id={`settings-device-reset-button-${macId}`}
          >
            Reset
          </Button>
          {savedMessage && (
            <span className="text-sm text-green-800 dark:text-green-300" role="status" aria-live="polite">
              Saved.
            </span>
          )}
          {saveError && (
            <span className="text-sm text-destructive" role="alert" aria-live="assertive">
              {saveError}
            </span>
          )}
        </div>
      </form>
      </div>
      )}
    </article>
  );
}

export function DevicesCard({
  hasCredentials,
  isCredentialStatusLoading = false,
  isOpen: isOpenProp,
  onToggle,
}: {
  readonly hasCredentials: boolean;
  readonly isCredentialStatusLoading?: boolean;
  readonly isOpen?: boolean;
  readonly onToggle?: () => void;
}) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: devices,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.settings.devices(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getDevices(token);
      if (!result.ok) throw new Error(result.error);
      return withRuntimeMockStations(result.data);
    },
    enabled: hasCredentials,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
  });
  const [isOpenInternal, setIsOpenInternal] = useState(true);
  const isOpen = isOpenProp ?? isOpenInternal;
  const handleToggle = onToggle ?? (() => { setIsOpenInternal((v) => !v); });
  const layout = useDashboardLayout(isOpen);
  const saveLayout = useSaveDashboardLayout();
  const publicSources = usePublicSources(isOpen);
  const neighborsConfig = useNeighborsConfig(isOpen);
  const saveNeighborsConfig = useSaveNeighborsConfig();
  const updatePublicSource = useUpdatePublicSource();
  const deletePublicSource = useDeletePublicSource();

  const handleUnpin = (pin: PinnedNeighborStationDto) => {
    if (!neighborsConfig.data) return;
    void saveNeighborsConfig.mutateAsync({
      ...neighborsConfig.data,
      pinnedStations: (neighborsConfig.data.pinnedStations ?? []).filter(
        (p) => !(p.provider === pin.provider && p.sourceId === pin.sourceId),
      ),
    });
  };

  const handlePinnedMetricsChange = (pin: PinnedNeighborStationDto, keys: readonly MetricKey[]) => {
    if (!neighborsConfig.data) return;
    void saveNeighborsConfig.mutateAsync({
      ...neighborsConfig.data,
      pinnedStations: (neighborsConfig.data.pinnedStations ?? []).map((p) => (
        p.provider === pin.provider && p.sourceId === pin.sourceId
          ? { ...p, selectedMetricKeys: keys }
          : p
      )),
    });
  };

  const handlePinnedVisibilityChange = (pin: PinnedNeighborStationDto, checked: boolean) => {
    if (!neighborsConfig.data) return;
    void saveNeighborsConfig.mutateAsync({
      ...neighborsConfig.data,
      pinnedStations: (neighborsConfig.data.pinnedStations ?? []).map((p) => (
        p.provider === pin.provider && p.sourceId === pin.sourceId
          ? { ...p, isEnabled: checked }
          : p
      )),
    });
  };

  const handlePinnedLabelChange = (pin: PinnedNeighborStationDto, displayLabel: string) => {
    if (!neighborsConfig.data) return;
    void saveNeighborsConfig.mutateAsync({
      ...neighborsConfig.data,
      pinnedStations: (neighborsConfig.data.pinnedStations ?? []).map((p) => (
        p.provider === pin.provider && p.sourceId === pin.sourceId
          ? { ...p, displayLabel }
          : p
      )),
    });
  };

  const handleNeighborComparisonChange = (macAddress: string, checked: boolean) => {
    const base = buildNeighborConfig(neighborsConfig.data);
    const current = new Set(base.enabledStationMacAddresses ?? []);
    if (checked) {
      current.add(macAddress);
    } else {
      current.delete(macAddress);
    }
    const enabledStationMacAddresses = [...current];
    void saveNeighborsConfig.mutateAsync({
      ...base,
      enabledStationMacAddresses,
      isEnabled: enabledStationMacAddresses.length > 0,
    });
  };

  const contentId = useId();
  const sourcesContentId = useId();
  const publicNearbyContentId = useId();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
  const [layoutSaveMessage, setLayoutSaveMessage] = useState<string | null>(null);
  const [isSourcesOpen, setIsSourcesOpen] = useState(true);
  const [isPublicNearbyOpen, setIsPublicNearbyOpen] = useState(false);
  const [deviceRowOpenByMac, setDeviceRowOpenByMac] = useState<Record<string, boolean>>({});
  const hasInitializedRowPrefs = useRef(false);
  useEffect(() => {
    if (!devices || hasInitializedRowPrefs.current) return;
    hasInitializedRowPrefs.current = true;
    void readDeviceRowOpenPreferencesForDevices(devices).then(setDeviceRowOpenByMac);
  }, [devices]);
  const sourceDevices = (publicSources.data ?? [])
    .filter((source) => source.isEnabled)
    .map(sourceToDevice);
  const pinnedDevices = (neighborsConfig.data?.pinnedStations ?? []).map((pin) => {
    const device = pinnedToDevice(pin);
    return { ...device, name: `(Pinned) ${device.name ?? device.macAddress}` };
  });
  const customLayoutSources = [...(devices ?? []), ...sourceDevices, ...pinnedDevices];
  const isCustomLayoutSourceInventoryLoading = [
    publicSources.isLoading,
    neighborsConfig.isPending,
    hasCredentials && isLoading,
  ].some(Boolean);
  const hasDashboardSources =
    (devices?.length ?? 0) > 0 ||
    (publicSources.data?.length ?? 0) > 0 ||
    (neighborsConfig.data?.pinnedStations?.length ?? 0) > 0;

  // Tracks the builder's live items so switchLayoutMode can preserve unsaved edits.
  const currentBuilderItemsRef = useRef<readonly CustomLayoutItem[]>([]);

  const switchLayoutMode = (mode: LayoutMode) => {
    if (mode === layoutMode) return;
    setLayoutMode(mode);
    setLayoutSaveMessage(null);
    void saveLayout.mutateAsync({
      layoutMode: mode,
      tiles: [],
      customItems: currentBuilderItemsRef.current,
    }).then(() => {
      setLayoutSaveMessage('Saved.');
      setTimeout(() => { setLayoutSaveMessage(null); }, 2000);
    }).catch(() => {
      setLayoutSaveMessage('Could not save.');
      setTimeout(() => { setLayoutSaveMessage(null); }, 3000);
    });
  };

  // Initialize the layout mode tab from server data exactly once; subsequent switches
  // are driven by switchLayoutMode so that a window-focus refetch cannot overwrite the
  // user's selection while a save is in flight.
  const layoutModeInitialized = useRef(false);
  useEffect(() => {
    if (!layoutModeInitialized.current && layout.data?.layoutMode !== undefined) {
      setLayoutMode(layout.data.layoutMode);
      currentBuilderItemsRef.current = layout.data.customItems;
      layoutModeInitialized.current = true;
    }
  }, [layout.data?.layoutMode, layout.data?.customItems]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return syncDevices(token);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setSyncError('Could not sync devices. Check your credentials and try again.');
        return;
      }
      setSyncError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.devices() });
    },
    onError: () => {
      setSyncError('An unexpected error occurred while syncing. Please try again.');
    },
  });

  const layoutModeControls = (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="inline-flex rounded-md border border-border bg-background p-1"
        role="group"
        aria-label="Dashboard layout mode"
        data-test-id="settings-layout-mode-tabs"
      >
        <button
          type="button"
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            layoutMode === 'default'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          aria-pressed={layoutMode === 'default'}
          onClick={() => { switchLayoutMode('default'); }}
          data-test-id="settings-layout-mode-default"
        >
          Default
        </button>
        <button
          type="button"
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            layoutMode === 'custom'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          aria-pressed={layoutMode === 'custom'}
          onClick={() => { switchLayoutMode('custom'); }}
          data-test-id="settings-layout-mode-custom"
        >
          Custom
        </button>
      </div>
      {saveLayout.isPending && (
        <span className="text-xs text-muted-foreground" role="status" aria-live="polite" data-test-id="settings-layout-mode-saving">
          Saving…
        </span>
      )}
      {!saveLayout.isPending && layoutSaveMessage && (
        <span
          className={`text-xs ${layoutSaveMessage === 'Saved.' ? 'text-green-800 dark:text-green-300' : 'text-destructive'}`}
          role="status"
          aria-live="polite"
          data-test-id="settings-layout-mode-save-message"
        >
          {layoutSaveMessage}
        </span>
      )}
    </div>
  );

  const customLayoutBuilder = (
    <CustomLayoutBuilder
      key={`${layout.data?.id ?? 'loading'}-${layout.data?.layoutMode ?? 'default'}`}
      devices={customLayoutSources}
      hasAmbientCredentials={hasCredentials}
      isSourceInventoryLoading={isCustomLayoutSourceInventoryLoading}
      initialItems={layout.data?.customItems ?? []}
      onSave={async (items) => {
        await saveLayout.mutateAsync({
          layoutMode: 'custom',
          tiles: [],
          customItems: items,
        });
      }}
      isSaving={saveLayout.isPending}
      onItemsChange={(items) => { currentBuilderItemsRef.current = items; }}
    />
  );

  const pinnedSourcesList = (
    <div className="space-y-3" data-test-id="settings-pinned-sources-list">
      <p className="text-xs font-medium text-muted-foreground">Pinned Public Stations</p>
      {publicSources.isLoading && (
        <p className="text-sm text-muted-foreground" data-test-id="settings-public-sources-loading">Loading pinned stations…</p>
      )}
      {publicSources.isError && (
        <p className="text-sm text-destructive" role="alert" data-test-id="settings-public-sources-error">Could not load pinned stations.</p>
      )}
      {!publicSources.isLoading &&
        !publicSources.isError &&
        (publicSources.data?.length ?? 0) === 0 &&
        (neighborsConfig.data?.pinnedStations?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground" data-test-id="settings-public-sources-empty">No pinned stations saved yet.</p>
      )}
      {(publicSources.data ?? []).length > 0 && (
        <div className="space-y-3" data-test-id="settings-external-sources-list">
          {(publicSources.data ?? []).map((source) => (
            <ExternalSourceRow
              key={`public:${source.id}`}
              source={source}
              onUpdate={(body) => { updatePublicSource.mutate({ id: source.id, body }); }}
              onDelete={() => { deletePublicSource.mutate(source.id); }}
              isBusy={updatePublicSource.isPending || deletePublicSource.isPending}
            />
          ))}
        </div>
      )}
      {(neighborsConfig.data?.pinnedStations ?? []).map((pin) => (
        <PinnedSourceRow
          key={`neighbor:${pin.provider}:${pin.sourceId}`}
          pin={pin}
          onUnpin={() => { handleUnpin(pin); }}
          onLabelChange={(label) => { handlePinnedLabelChange(pin, label); }}
          onVisibilityChange={(checked) => { handlePinnedVisibilityChange(pin, checked); }}
          onMetricsChange={(keys) => { handlePinnedMetricsChange(pin, keys); }}
          isBusy={saveNeighborsConfig.isPending}
        />
      ))}
    </div>
  );

  const sourcesSection = (
    <section
      className="rounded-md border border-border"
      aria-labelledby="settings-sources-heading"
      data-test-id="settings-sources-section"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-t-md bg-surface-layer-2 p-4 text-left"
        aria-expanded={isSourcesOpen}
        aria-controls={sourcesContentId}
        onClick={() => { setIsSourcesOpen((open) => !open); }}
        data-test-id="settings-sources-toggle"
      >
        <span>
          <span id="settings-sources-heading" className="block text-sm font-semibold text-foreground">
            Sources
          </span>
          <span className="block text-sm text-muted-foreground">
            Manage owned stations, public sources, and pinned nearby stations.
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isSourcesOpen ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>

      {isSourcesOpen && (
        <div id={sourcesContentId} className="space-y-4 border-t border-border bg-surface-layer-2 p-4">
          <WeatherAlertsLocationSetting
            key={neighborsConfig.data?.municipality ?? 'weather-alerts-location-empty'}
            config={neighborsConfig.data}
            isLoading={neighborsConfig.isPending}
            isDisabled={neighborsConfig.isError}
            onSave={saveNeighborsConfig.mutateAsync}
          />

          {hasCredentials && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { syncMutation.mutate(); }}
                disabled={syncMutation.isPending}
                data-test-id="settings-devices-sync-button"
              >
                {syncMutation.isPending ? 'Syncing…' : 'Refresh station list'}
              </Button>

              {syncError && (
                <p className="text-sm text-destructive" role="alert" data-test-id="settings-devices-sync-error">
                  {syncError}
                </p>
              )}

              {isLoading && (
                <div className="space-y-2" aria-busy="true" aria-label="Loading stations">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}

              {isError && (
                <p className="text-sm text-destructive" role="alert" data-test-id="settings-devices-error">
                  Could not load stations. Try refreshing.
                </p>
              )}

              {!isLoading && !isError && devices?.length === 0 && (
                <p className="text-sm text-muted-foreground" data-test-id="settings-devices-empty">
                  No stations synced yet. Click &ldquo;Refresh station list&rdquo; to import your devices.
                </p>
              )}

              {!isLoading && !isError && (devices?.length ?? 0) > 0 && (
                <fieldset
                  className="m-0 min-w-0 space-y-3 border-0 p-0"
                  data-test-id="settings-devices-list"
                >
                  <legend className="sr-only">Primary station selection</legend>
                  {(devices ?? []).map((device) => (
                    <DeviceRow
                      key={device.macAddress}
                      device={device}
                      isOnlyDevice={(devices ?? []).length === 1}
                      isNeighborComparisonEnabled={
                        (neighborsConfig.data?.enabledStationMacAddresses ?? []).includes(device.macAddress)
                      }
                      isNeighborComparisonSaving={saveNeighborsConfig.isPending}
                      onNeighborComparisonChange={(checked) => { handleNeighborComparisonChange(device.macAddress, checked); }}
                      isRowOpen={deviceRowOpenByMac[device.macAddress] ?? device.isPrimary}
                      onRowOpenChange={(nextIsOpen) => {
                        setDeviceRowOpenByMac((current) => {
                          const next = { ...current, [device.macAddress]: nextIsOpen };
                          void writeDeviceRowOpenPreferences(next);
                          return next;
                        });
                      }}
                    />
                  ))}
                </fieldset>
              )}
            </>
          )}

          {pinnedSourcesList}

          <section
            className="mt-4 rounded-md border border-border bg-surface-layer-3"
            aria-labelledby="settings-public-nearby-heading"
            data-test-id="settings-public-nearby-section"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-t-md bg-surface-layer-3 p-4 text-left"
              aria-expanded={isPublicNearbyOpen}
              aria-controls={publicNearbyContentId}
              onClick={() => { setIsPublicNearbyOpen((open) => !open); }}
              data-test-id="settings-public-nearby-toggle"
            >
              <span>
                <span id="settings-public-nearby-heading" className="block text-sm font-semibold text-foreground">
                  Public and Nearby Stations
                </span>
                <span className="block text-xs text-muted-foreground">
                  Add Weather.gov or Open-Meteo sources, discover nearby stations, and manage pinned stations.
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isPublicNearbyOpen ? '' : '-rotate-90'}`}
                aria-hidden="true"
              />
            </button>

            {isPublicNearbyOpen && (
              <div id={publicNearbyContentId} className="space-y-4 border-t border-border p-4">
                <PublicSourcesPanel />
                <NeighborsConfigPanel embedded hasAmbientCredentials={hasCredentials} />
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );

  const dashboardLayoutSection = hasDashboardSources ? (
    <section
      className="space-y-3 rounded-md border border-border bg-surface-layer-2 p-4"
      aria-labelledby="settings-dashboard-layout-heading"
      data-test-id="settings-dashboard-layout-section"
    >
      <div className="space-y-1">
        <h3 id="settings-dashboard-layout-heading" className="text-sm font-semibold text-foreground">
          Dashboard Layout
        </h3>
      </div>
      {layoutModeControls}
      {layoutMode === 'custom' && customLayoutBuilder}
    </section>
  ) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle as="h2">My Stations</CardTitle>
            <CardDescription>Ambient Weather devices linked to your account.</CardDescription>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls={contentId}
            aria-label={isOpen ? 'Collapse My Stations' : 'Expand My Stations'}
            className="mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent"
            data-test-id="settings-devices-toggle"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </CardHeader>
      {isOpen && <CardContent id={contentId} className="space-y-4">
        {isCredentialStatusLoading && (
          <div
            className="space-y-2"
            aria-busy="true"
            aria-label="Loading credential status"
            data-test-id="settings-devices-credential-status-loading"
          >
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!isCredentialStatusLoading && !hasCredentials && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground" data-test-id="settings-devices-no-credentials">
              Save your Ambient Weather credentials above to sync your stations.
            </p>
            {sourcesSection}
            {dashboardLayoutSection}
          </div>
        )}

        {!isCredentialStatusLoading && hasCredentials && (
          <div className="space-y-3">
            {sourcesSection}
            {dashboardLayoutSection}
          </div>
        )}
      </CardContent>}
    </Card>
  );
}
