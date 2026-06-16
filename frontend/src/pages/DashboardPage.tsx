import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Card, CardContent } from '../components/ui/card';
import { CustomDashboardRenderer } from '../components/dashboard/CustomDashboardRenderer';
import { AlertsBanner } from '../components/dashboard/AlertsBanner';
import { ConditionsTile } from '../components/dashboard/ConditionsTile';
import { PinnedStationTileGroup } from '../components/dashboard/PinnedStationTileGroup';
import { NeighborsStationDrawer } from '../components/neighbors/NeighborsStationDrawer';
import { HumidityTile } from '../components/dashboard/HumidityTile';
import { MetricTile } from '../components/dashboard/MetricTile';
import { RainfallSummaryTile } from '../components/dashboard/RainfallSummaryTile';
import { SolarTile } from '../components/dashboard/SolarTile';
import { TemperatureTile } from '../components/dashboard/TemperatureTile';
import { WindTile } from '../components/dashboard/WindTile';
import { getActiveAlerts } from '../api/alerts';
import { getNeighborComparisonStations } from '../api/neighbors';
import { useCredentialStatus } from '../hooks/useCredentialStatus';
import { useSettingsPreferences } from '../hooks/useSettingsPreferences';
import { useDashboardCurrent } from '../hooks/useDashboardCurrent';
import { useDashboardExtrema } from '../hooks/useDashboardExtrema';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useDashboardRainfall } from '../hooks/useDashboardRainfall';
import { useActiveAlerts } from '../hooks/useActiveAlerts';
import { useNeighborsConfig } from '../hooks/useNeighborsConfig';
import { useSaveNeighborsConfig } from '../hooks/useSaveNeighborsConfig';
import { usePublicSources } from '../hooks/usePublicSources';
import { usePublicSourceCurrentReadings } from '../hooks/usePublicSourceCurrentReadings';
import { usePinnedStationsCurrentReadings } from '../hooks/usePinnedStationsCurrentReadings';
import { useSettingsDevices } from '../hooks/useSettingsDevices';
import { useWeatherHub } from '../hooks/useWeatherHub';
import { useAuth } from '../lib/auth';
import { DEFAULT_USER_PREFERENCES } from '../lib/defaultPreferences';
import { isRuntimeMockMac, normalizeRuntimeMac } from '../lib/runtimeMockStations';
import {
  CONDITIONS_METRICS, HUMIDITY_METRICS, INDIVIDUAL_METRICS, NEIGHBOR_EXCLUDED_KEYS, RAINFALL_METRICS,
  SOLAR_METRICS, TEMPERATURE_METRICS, WIND_METRICS,
} from '../lib/metricGroups';
import { getDeviceSupportedMetricKeys, normalizeSupportedMetricKeys } from '../lib/providerMetricSupport';
import { queryKeys } from '../lib/queryKeys';
import { convertDistance, distanceLabel, distanceToMiles } from '../lib/units';
import type { WeatherAlertDto } from '../types/alerts';
import type { DashboardRainfallDto, DashboardTileDto } from '../types/dashboard';
import type { SettingsDeviceDto } from '../types/settings';
import { sourceToDevice } from '../types/publicSources';
import { pinnedToDevice } from '../types/neighbors';
import type { NeighborStationDto } from '../types/neighbors';

const GROUP_DEFS = [
  { type: 'temperature' as const, metrics: TEMPERATURE_METRICS },
  { type: 'humidity'    as const, metrics: HUMIDITY_METRICS },
  { type: 'wind'        as const, metrics: WIND_METRICS },
  { type: 'solar'       as const, metrics: SOLAR_METRICS },
  { type: 'conditions'  as const, metrics: CONDITIONS_METRICS },
] as const;

const NEIGHBOR_RAINFALL_KEYS = new Set(['rainfall_day', 'rainfall_week', 'rainfall_month', 'rainfall_year']);

type DashboardCategoryType = typeof GROUP_DEFS[number]['type'] | 'rainfall';

const UNIFORM_TILE_WIDTH = 4;
const UNIFORM_TILE_HEIGHT = 4;

// ── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { getAccessToken } = useAuth();
  const [dataSource, setDataSource] = useState<'own' | 'neighbors'>('own');
  const [alertsAreaMode, setAlertsAreaMode] = useState<'station' | 'manual'>(
    () => (localStorage.getItem('dashboard.alertsAreaMode') as 'station' | 'manual' | null) ?? 'station',
  );
  const [manualAlertsArea, setManualAlertsArea] = useState(
    () => localStorage.getItem('dashboard.manualAlertsArea') ?? '',
  );
  const [neighborRadiusDraft, setNeighborRadiusDraft] = useState<string | null>(null);
  const [neighborRadiusStatus, setNeighborRadiusStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [neighborDrawerStations, setNeighborDrawerStations] = useState<readonly NeighborStationDto[]>([]);
  const [neighborDrawerOpen, setNeighborDrawerOpen] = useState(false);
  const [expandedSourceGroups, setExpandedSourceGroups] = useState<Record<string, boolean>>({});
  const layout = useDashboardLayout();
  const supportsNeighborsView = layout.data?.layoutMode !== 'custom';
  const selectedAlertsArea = alertsAreaMode === 'manual' ? manualAlertsArea.trim().toUpperCase() : null;
  const rainfall = useDashboardRainfall();
  const extrema = useDashboardExtrema();
  const { hubState } = useWeatherHub();
  const devices = useSettingsDevices();
  const neighborsConfig = useNeighborsConfig();
  const saveNeighborsConfig = useSaveNeighborsConfig();
  const alerts = useActiveAlerts(selectedAlertsArea);

  // Collect unique non-null alertsZone values from custom ticker items so each ticker
  // can fetch its own NWS zone rather than relying on the dashboard-level area selector.
  const tickerAlertZones = useMemo<readonly string[]>(() => {
    if (layout.data?.layoutMode !== 'custom') return [];
    const zones = new Set<string>();
    for (const item of layout.data.customItems) {
      if (
        (item.type === 'header-ticker' || item.type === 'footer-ticker') &&
        item.alertsZone
      ) {
        zones.add(item.alertsZone);
      }
    }
    return [...zones];
  }, [layout.data]);

  const tickerZoneAlertQueries = useQueries({
    queries: tickerAlertZones.map((zone) => ({
      queryKey: queryKeys.alerts.active(zone),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const token = await getAccessToken();
        const result = await getActiveAlerts(token, zone, signal);
        if (!result.ok) return [] as WeatherAlertDto[];
        return result.data;
      },
      staleTime: 2 * 60_000,
      refetchInterval: 2 * 60_000,
    })),
  });

  const tickerAlertsMap = useMemo<ReadonlyMap<string, readonly WeatherAlertDto[]>>(() => {
    const map = new Map<string, readonly WeatherAlertDto[]>();
    tickerAlertZones.forEach((zone, i) => {
      map.set(zone, tickerZoneAlertQueries[i]?.data ?? []);
    });
    return map;
  }, [tickerAlertZones, tickerZoneAlertQueries]);

  const publicSources = usePublicSources();
  const credentialStatus = useCredentialStatus();
  const hasAmbientCredentials = credentialStatus.data?.hasCredentials ?? true;
  const ownedDevices = useMemo(
    () => (hasAmbientCredentials ? devices.data : []),
    [hasAmbientCredentials, devices.data],
  );
  const ownedDevicesLoading = credentialStatus.isPending || (hasAmbientCredentials && devices.isPending);
  const ownedDevicesError = credentialStatus.isError || (hasAmbientCredentials && devices.isError);
  const { readings: publicSourceReadings, isLoading: isPublicSourceReadingsLoading } =
    usePublicSourceCurrentReadings(publicSources.data);
  const { readings: pinnedStationReadings, isLoading: isPinnedReadingsLoading } =
    usePinnedStationsCurrentReadings(neighborsConfig.data?.pinnedStations);
  const defaultDashboardPinnedStations = useMemo(
    () => (neighborsConfig.data?.pinnedStations ?? []).filter((pin) => pin.isEnabled ?? true),
    [neighborsConfig.data?.pinnedStations],
  );
  const pinnedDevices = useMemo(
    () => (neighborsConfig.data?.pinnedStations ?? []).map(pinnedToDevice),
    [neighborsConfig.data?.pinnedStations],
  );
  const allLayoutSources = useMemo(
    () => [
      ...(ownedDevices ?? []),
      ...((publicSources.data ?? []).filter((source) => source.isEnabled).map(sourceToDevice)),
    ],
    [ownedDevices, publicSources.data],
  );
  const customLayoutDevices = useMemo(
    () => [...allLayoutSources, ...pinnedDevices],
    [allLayoutSources, pinnedDevices],
  );

  const preferences = useSettingsPreferences();

  const userPreferences = preferences.data ?? DEFAULT_USER_PREFERENCES;
  const distanceUnit = userPreferences.distanceUnit;
  const comparisonRadiusMiles = neighborsConfig.data?.comparisonRadiusMiles ?? 25;
  const comparisonRadiusDisplayValue = convertDistance(comparisonRadiusMiles, distanceUnit) ?? 25;
  const neighborRadiusInputValue = neighborRadiusDraft ?? comparisonRadiusDisplayValue.toFixed(1).replace(/\.0$/, '');
  const minComparisonRadiusDisplayValue = convertDistance(0.5, distanceUnit) ?? 0.5;
  const maxComparisonRadiusDisplayValue = convertDistance(34, distanceUnit) ?? 34;
  const neighborRadiusStep = distanceUnit === 'km' ? 1 : 0.5;

  const saveNeighborRadius = () => {
    const config = neighborsConfig.data;
    if (!config) return;

    const parsed = Number(neighborRadiusInputValue);
    if (!Number.isFinite(parsed)) {
      setNeighborRadiusDraft(null);
      return;
    }

    const parsedMiles = distanceToMiles(parsed, distanceUnit);
    const next = Math.min(34, Math.max(0.5, Math.round(parsedMiles * 10) / 10));
    setNeighborRadiusDraft(null);
    if (next === config.comparisonRadiusMiles) return;

    setNeighborRadiusStatus('saving');
    void saveNeighborsConfig.mutateAsync({
      ...config,
      comparisonRadiusMiles: next,
    }).then(() => {
      setNeighborRadiusStatus('saved');
      current.refetch();
      setTimeout(() => { setNeighborRadiusStatus('idle'); }, 2500);
    }).catch(() => {
      setNeighborRadiusStatus('error');
    });
  };
  const connectionStatusText = useMemo(
    () => formatRealtimeConnection(
      hubState, ownedDevices, ownedDevicesLoading, ownedDevicesError,
      userPreferences.dailyExtremaTimezone,
    ),
    [
      hubState,
      ownedDevices,
      ownedDevicesLoading,
      ownedDevicesError,
      userPreferences.dailyExtremaTimezone,
    ],
  );
  // Rainfall rows for the primary visible device's selected rainfall metrics.
  const selectedRainfallKeys = useMemo<readonly string[] | undefined>(() => {
    if (!ownedDevices) return undefined;
    const visible = ownedDevices.filter((d) => d.displayOnDashboard);
    const primary = visible.find((d) => d.isPrimary) ?? visible.at(0);
    if (!primary?.selectedMetricKeys) return undefined;
    return primary.selectedMetricKeys.filter((k) => RAINFALL_METRICS.includes(k as typeof RAINFALL_METRICS[number]));
  }, [ownedDevices]);

  // Build the tile list from device settings. Tile sequence follows the saved
  // selectedMetricKeys category order so settings control dashboard order.
  const tiles = useMemo(() => {
    const rawTiles = layout.data?.tiles ?? fallbackTiles;
    // Default false while devices are still loading so rainfall never flashes before data arrives.
    const hasVisibleDevice = ownedDevices?.some((d) => d.displayOnDashboard) ?? false;

    // Rainfall tile is shown only when the primary visible device has at least one rainfall metric
    // selected. Restrict to displayOnDashboard=true so a hidden station at index 0 cannot suppress
    // rainfall for visible stations. null selectedMetricKeys = "not yet configured" → show by default.
    const visibleForPrimary = ownedDevices?.filter((d) => d.displayOnDashboard) ?? [];
    const primary = visibleForPrimary.find((d) => d.isPrimary) ?? visibleForPrimary.at(0);
    const primarySelectedKeys = primary?.selectedMetricKeys;
    const primaryHasRainfall = primarySelectedKeys == null
      ? true
      : primarySelectedKeys.some((k) => RAINFALL_METRICS.includes(k as typeof RAINFALL_METRICS[number]));

    const fallbackRainfallTiles = rawTiles.filter(
      (t) => t.type === 'rainfall' && hasVisibleDevice && primaryHasRainfall,
    );

    if (!allLayoutSources.length) {
      return fallbackRainfallTiles;
    }

    const savedById = new Map(rawTiles.map((t) => [t.i, t] as const));
    const primaryMac = primary ? primary.macAddress.toUpperCase().replace(/:/g, '') : null;
    const orderedTiles: DashboardTileDto[] = [];

    for (const device of allLayoutSources) {
      if (!device.displayOnDashboard) continue;
      const mac = device.macAddress.toUpperCase().replace(/:/g, '');
      const selected = new Set(getDefaultLayoutMetricKeys(device) ?? []);

      for (const category of orderDashboardCategoryTypes(device.selectedMetricKeys)) {
        if (category === 'rainfall') {
          if (device.sourceKind === 'public' || mac !== primaryMac || !primaryHasRainfall) continue;

          orderedTiles.push(savedById.get('rainfall') ?? createUniformTile({ i: 'rainfall', type: 'rainfall' }));
          continue;
        }

        const g = GROUP_DEFS.find((group) => group.type === category);
        if (!g?.metrics.some((m) => selected.has(m))) continue;

        const id = `${g.type}-${mac}`;
        orderedTiles.push(savedById.get(id) ?? createUniformTile({ i: id, type: g.type, deviceId: mac }));
      }

      // Individual metric tiles not represented by a group card.
      for (const key of INDIVIDUAL_METRICS) {
        if (!selected.has(key)) continue;
        const id = `${key}-${mac}`;
        orderedTiles.push(savedById.get(id) ?? createUniformTile({ i: id, type: 'metric', metricKey: key, deviceId: mac }));
      }
    }

    return orderedTiles;
  }, [layout.data?.tiles, allLayoutSources, ownedDevices]);

  const tileGroups = useMemo(
    () => buildTileGroups(tiles, allLayoutSources),
    [tiles, allLayoutSources],
  );
  const comparisonEligibleGroups = useMemo(
    () => tileGroups.filter(isAmbientComparisonEligibleGroup),
    [tileGroups],
  );
  const canUseNeighborsView = supportsNeighborsView && comparisonEligibleGroups.length > 0;
  const effectiveDataSource = canUseNeighborsView ? dataSource : 'own';
  const current = useDashboardCurrent(effectiveDataSource);
  const visibleTileGroups = useMemo(
    () => (effectiveDataSource === 'neighbors' ? comparisonEligibleGroups : tileGroups),
    [comparisonEligibleGroups, effectiveDataSource, tileGroups],
  );
  const setupPrompt = useMemo(
    () => getDashboardSetupPrompt(
      current.error,
      rainfall.error,
      layout.error,
      customLayoutDevices,
      ownedDevicesLoading,
      hasAmbientCredentials,
    ),
    [
      current.error,
      rainfall.error,
      layout.error,
      customLayoutDevices,
      ownedDevicesLoading,
      hasAmbientCredentials,
    ],
  );

  useEffect(() => {
    if (effectiveDataSource === 'neighbors') {
      current.refetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDataSource]);
  const comparisonQueryIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    comparisonEligibleGroups.forEach((group, index) => {
      map.set(group.key, index);
    });
    return map;
  }, [comparisonEligibleGroups]);

  const comparisonStationQueries = useQueries({
    queries: comparisonEligibleGroups.map((group) => ({
      queryKey: [...queryKeys.neighbors.stations(), 'comparison', group.macAddress, comparisonRadiusMiles],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const token = await getAccessToken();
        const result = await getNeighborComparisonStations(token, group.macAddress, signal);
        if (!result.ok) return [] as readonly NeighborStationDto[];
        return result.data;
      },
      enabled: effectiveDataSource === 'neighbors',
      staleTime: 0,
    })),
  });
  const comparisonStationsByMac = useMemo(() => {
    const map = new Map<string, readonly NeighborStationDto[]>();
    comparisonEligibleGroups.forEach((group, index) => {
      map.set(group.macAddress, comparisonStationQueries[index]?.data ?? []);
    });
    return map;
  }, [comparisonEligibleGroups, comparisonStationQueries]);

  // When viewing neighbor aggregate data, synthesize a rainfall DTO from the current reading.
  // Only dailyRainIn is available from the aggregate; event/weekly/monthly/yearly are own-station only.
  const effectiveRainfall = useMemo(() => {
    const neighborReading = current.data?.source === 'neighbors' ? current.data : null;
    if (!neighborReading) return rainfall;
    const neighborRainfallData: DashboardRainfallDto = {
      deviceId: neighborReading.deviceId,
      deviceName: neighborReading.deviceName,
      timestampUtc: neighborReading.timestampUtc,
      receivedAtUtc: neighborReading.receivedAtUtc,
      eventRainIn: null,
      dailyRainIn: neighborReading.dailyRainIn ?? null,
      weeklyRainIn: neighborReading.weeklyRainIn ?? null,
      monthlyRainIn: neighborReading.monthlyRainIn ?? null,
      yearlyRainIn: neighborReading.yearlyRainIn ?? null,
      lastRain: null,
    };
    return { ...rainfall, data: neighborRainfallData };
  }, [current.data, rainfall]);

  // When viewing neighbors, hourly/event rain are not available from the aggregate.
  // Weekly/monthly/yearly are now available from AmbientOpen stations.
  const effectiveRainfallKeys = useMemo(() => {
    if (current.data?.source !== 'neighbors') return selectedRainfallKeys;
    return selectedRainfallKeys?.filter((k) => NEIGHBOR_RAINFALL_KEYS.has(k)) ?? ['rainfall_day'];
  }, [current.data, selectedRainfallKeys]);

  return (
    <div className="space-y-6 p-6" data-test-id="dashboard-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-test-id="dashboard-weather-hub-state">
            {connectionStatusText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canUseNeighborsView && (
            <div
              className="flex items-center rounded-md border border-input p-0.5"
              role="group"
              aria-label="Data source"
              data-test-id="dashboard-source-toggle"
            >
              <button
                type="button"
                onClick={() => { setDataSource('own'); }}
                aria-pressed={effectiveDataSource === 'own'}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  effectiveDataSource === 'own'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                data-test-id="dashboard-source-own-button"
              >
                Own Station
              </button>
              <button
                type="button"
                onClick={() => { setDataSource('neighbors'); }}
                aria-pressed={effectiveDataSource === 'neighbors'}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  effectiveDataSource === 'neighbors'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                data-test-id="dashboard-source-neighbors-button"
              >
                Neighbors
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm" data-test-id="dashboard-alerts-area-selector">
            <label className="text-muted-foreground" htmlFor="dashboard-alerts-area-mode">Alerts</label>
            <select
              id="dashboard-alerts-area-mode"
              value={alertsAreaMode}
              onChange={(event) => {
                const mode = event.target.value as 'station' | 'manual';
                setAlertsAreaMode(mode);
                localStorage.setItem('dashboard.alertsAreaMode', mode);
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-foreground"
              aria-label="Weather alerts area"
              data-test-id="dashboard-alerts-area-mode"
            >
              <option value="station">Station area</option>
              <option value="manual">NWS area</option>
            </select>
            {alertsAreaMode === 'manual' && (
              <input
                value={manualAlertsArea}
                onChange={(event) => {
                  setManualAlertsArea(event.target.value);
                  localStorage.setItem('dashboard.manualAlertsArea', event.target.value);
                }}
                placeholder="STATE/ZONE"
                maxLength={12}
                className="h-9 w-28 rounded-md border border-input bg-background px-2 uppercase text-foreground"
                aria-label="NWS area code"
                data-test-id="dashboard-alerts-area-code"
              />
            )}
          </div>
        </div>
      </div>
      {effectiveDataSource === 'neighbors' && (
        <section
          className="flex flex-wrap items-center gap-2 text-sm"
          aria-label="Neighbor comparison radius"
          data-test-id="dashboard-neighbors-radius-control"
        >
          <label className="font-medium text-foreground" htmlFor="dashboard-neighbors-radius">
            Neighbor radius
          </label>
          <input
            id="dashboard-neighbors-radius"
            type="number"
            min={minComparisonRadiusDisplayValue}
            max={maxComparisonRadiusDisplayValue}
            step={neighborRadiusStep}
            value={neighborRadiusInputValue}
            onChange={(event) => {
              setNeighborRadiusStatus('idle');
              setNeighborRadiusDraft(event.target.value);
            }}
            onBlur={saveNeighborRadius}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            disabled={neighborsConfig.isPending || saveNeighborsConfig.isPending}
            className="h-9 w-24 rounded-md border border-input bg-background px-2 text-foreground"
            aria-describedby="dashboard-neighbors-radius-help dashboard-neighbors-radius-status"
            data-test-id="dashboard-neighbors-radius-input"
          />
          <span className="text-muted-foreground">{distanceLabel(distanceUnit)}</span>
          <span id="dashboard-neighbors-radius-help" className="text-xs text-muted-foreground">
            Ambient Weather stations only, {minComparisonRadiusDisplayValue.toFixed(1).replace(/\.0$/, '')}-{maxComparisonRadiusDisplayValue.toFixed(0)} {distanceLabel(distanceUnit)}.
          </span>
          <span
            id="dashboard-neighbors-radius-status"
            className={`text-xs ${neighborRadiusStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
            role={neighborRadiusStatus === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            data-test-id="dashboard-neighbors-radius-status"
          >
            {neighborRadiusStatus === 'saving'
              ? 'Saving...'
              : neighborRadiusStatus === 'saved'
                ? 'Saved.'
                : neighborRadiusStatus === 'error'
                  ? 'Could not save.'
                  : ''}
          </span>
        </section>
      )}
      {effectiveDataSource === 'neighbors' && current.isNeighborsUnavailable && (
        <Alert data-test-id="dashboard-neighbors-unavailable">
          <AlertDescription>
            Neighbor comparison is not configured or enabled.{' '}
            <a href="/settings" className="underline underline-offset-2 hover:no-underline">
              Enable Dashboard and Neighbor comparison for this station in Settings → My Stations → Sources.
            </a>
          </AlertDescription>
        </Alert>
      )}

      <AlertsBanner alerts={alerts.data ?? []} />
      {alerts.isError && (
        <Alert data-test-id="dashboard-alerts-error">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Weather alerts could not load. Dashboard readings are still available.</span>
            <button
              type="button"
              className="shrink-0 rounded-sm border border-border px-3 py-1 text-sm font-medium hover:bg-accent"
              onClick={() => { void alerts.refetch(); }}
              data-test-id="dashboard-alerts-retry"
            >
              Retry alerts
            </button>
          </AlertDescription>
        </Alert>
      )}

      {setupPrompt && (
        <Alert data-test-id="dashboard-setup-prompt">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{setupPrompt}</span>
            <a href="/settings" className="shrink-0 underline underline-offset-2 hover:no-underline" data-test-id="dashboard-setup-link">
              Open Settings
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Only show the generic error banner for own-station errors or non-current data errors. */}
      {!setupPrompt && ((effectiveDataSource === 'own' ? current.isError : false) || rainfall.isError || layout.isError || preferences.isError) && (
        <Alert variant="destructive" data-test-id="dashboard-alert">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Some dashboard data could not load. Saved preferences and cached readings will be used when available.</span>
            <button
              type="button"
              className="shrink-0 rounded-sm border border-destructive-foreground/40 px-3 py-1 text-sm font-medium hover:bg-destructive-foreground/10"
              onClick={() => {
                if (current.isError) current.refetch();
                if (rainfall.isError) rainfall.refetch();
                if (layout.isError) layout.refetch();
                if (preferences.isError) preferences.refetch();
                if (devices.isError) devices.refetch();
              }}
              data-test-id="dashboard-alert-retry"
            >
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      <h2 className="sr-only">Dashboard tiles</h2>
      {!layout.isPending && layout.data?.layoutMode === 'custom' ? (
        <CustomDashboardRenderer
          items={layout.data.customItems}
          current={current}
          preferences={userPreferences}
          devices={customLayoutDevices}
          alerts={alerts.data ?? []}
          publicSourceReadings={publicSourceReadings}
          pinnedStationReadings={pinnedStationReadings}
          isExternalLoading={isPublicSourceReadingsLoading || isPinnedReadingsLoading}
          tickerAlertsMap={tickerAlertsMap}
        />
      ) : layout.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-test-id="dashboard-tile-grid">
          <DashboardLoadingTiles />
        </div>
      ) : visibleTileGroups.length > 0 ? (
        // ── View mode: grouped by source station ──────────────────────────────────
        <div className="space-y-8" data-test-id="dashboard-source-groups">
          {visibleTileGroups.map((group) => {
            const isGroupExpanded = expandedSourceGroups[group.key] ?? true;
            const comparisonQueryIndex = comparisonQueryIndexByKey.get(group.key);
            const isComparisonEligible = comparisonQueryIndex !== undefined;

            return (
              <details
                key={group.key}
                className="group space-y-3 rounded-lg border border-border bg-surface-layer-3 p-4"
                aria-labelledby={`dashboard-source-heading-${group.key}`}
                data-test-id="dashboard-source-group"
                open={isGroupExpanded}
                onToggle={(event) => {
                  const nextExpanded = event.currentTarget.open;
                  setExpandedSourceGroups((currentGroups) => {
                    if ((currentGroups[group.key] ?? true) === nextExpanded) {
                      return currentGroups;
                    }

                    return { ...currentGroups, [group.key]: nextExpanded };
                  });
                }}
              >
                <summary
                  className="flex cursor-pointer list-none flex-wrap items-baseline gap-2 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
                  aria-expanded={isGroupExpanded}
                  aria-controls={`dashboard-source-content-${group.key}`}
                  data-test-id="dashboard-source-summary"
                >
                  <ChevronDown
                    className="h-4 w-4 -rotate-90 text-muted-foreground transition-transform duration-200 group-open:rotate-0"
                    aria-hidden="true"
                  />
                  <h3
                    id={`dashboard-source-heading-${group.key}`}
                    className="text-base font-semibold text-foreground"
                    data-test-id="dashboard-source-heading"
                  >
                    {group.label}
                  </h3>
                  {group.isPrimary && (
                    <span className="text-xs font-medium text-muted-foreground" data-test-id="dashboard-source-primary-label">
                      Primary
                    </span>
                  )}
                </summary>
                {effectiveDataSource === 'neighbors' && isComparisonEligible && !current.isNeighborsUnavailable && (
                  <NeighborCountButton
                    stationLabel={group.label}
                    stations={comparisonStationsByMac.get(group.macAddress) ?? []}
                    isLoading={comparisonStationQueries[comparisonQueryIndex]?.isPending ?? false}
                    onOpen={(stations) => {
                      setNeighborDrawerStations(stations);
                      setNeighborDrawerOpen(true);
                    }}
                  />
                )}
                <div
                  id={`dashboard-source-content-${group.key}`}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                  data-test-id="dashboard-tile-grid"
                >
                  {group.tiles.map((tile) => (
                    <div
                      key={tile.i}
                      className={getDashboardTileClassName()}
                      data-test-id="dashboard-layout-tile-wrapper"
                    >
                      <DashboardTile
                        tile={tile}
                        current={current}
                        rainfall={effectiveRainfall}
                        extrema={extrema}
                        preferences={userPreferences}
                        selectedRainfallKeys={effectiveRainfallKeys}
                        devices={allLayoutSources}
                        publicSourceReadings={publicSourceReadings}
                        isPublicSourceReadingsLoading={isPublicSourceReadingsLoading}
                      />
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
          {effectiveDataSource === 'own' && defaultDashboardPinnedStations.map((pin) => (
            <PinnedStationTileGroup
              key={`${pin.provider}:${pin.sourceId}`}
              pin={pin}
              preferences={userPreferences}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-test-id="dashboard-tile-grid">
            {tiles.map((tile) => (
              <div
                key={tile.i}
                className={getDashboardTileClassName()}
                data-test-id="dashboard-layout-tile-wrapper"
              >
                <DashboardTile
                  tile={tile}
                  current={current}
                  rainfall={effectiveRainfall}
                  extrema={extrema}
                  preferences={userPreferences}
                  selectedRainfallKeys={effectiveRainfallKeys}
                  devices={allLayoutSources}
                  publicSourceReadings={publicSourceReadings}
                  isPublicSourceReadingsLoading={isPublicSourceReadingsLoading}
                />
              </div>
            ))}
          </div>
          {effectiveDataSource === 'own' && defaultDashboardPinnedStations.length > 0 && (
            <div className="space-y-8" data-test-id="dashboard-pinned-stations">
              {defaultDashboardPinnedStations.map((pin) => (
                <PinnedStationTileGroup
                  key={`${pin.provider}:${pin.sourceId}`}
                  pin={pin}
                  preferences={userPreferences}
                />
              ))}
            </div>
          )}
        </>
      )}
      <NeighborsStationDrawer
        open={neighborDrawerOpen}
        onClose={() => { setNeighborDrawerOpen(false); }}
        stations={neighborDrawerStations}
        distanceUnit={distanceUnit}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function NeighborCountButton({
  stationLabel,
  stations,
  isLoading,
  onOpen,
}: {
  readonly stationLabel: string;
  readonly stations: readonly NeighborStationDto[];
  readonly isLoading: boolean;
  readonly onOpen: (stations: readonly NeighborStationDto[]) => void;
}) {
  const count = stations.length;
  const stationText = count === 1 ? 'station' : 'stations';

  return (
    <div className="mt-2 space-y-1 text-sm text-muted-foreground" data-test-id="dashboard-neighbors-provenance">
      <p className="font-medium text-foreground" data-test-id="dashboard-neighbors-label">
        Neighbors of {stationLabel}
      </p>
      {isLoading ? (
        <p>Finding closest Ambient Weather stations for {stationLabel}...</p>
      ) : (
        <p>
          Showing average of{' '}
          <button
            type="button"
            className="font-semibold text-foreground underline underline-offset-2 hover:no-underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            disabled={count === 0}
            onClick={() => { onOpen(stations); }}
            data-test-id="dashboard-neighbors-count-button"
            aria-label={`Show ${count.toString()} Ambient Weather neighbor ${stationText} for ${stationLabel}`}
          >
            {count.toString()} nearby {stationText}
          </button>
          .
        </p>
      )}
    </div>
  );
}

function normalizeMac(mac: string) {
  return normalizeRuntimeMac(mac);
}

function getDefaultLayoutMetricKeys(device: SettingsDeviceDto): readonly string[] | null {
  const supportedKeys = getDeviceSupportedMetricKeys(device);
  if (device.selectedMetricKeys) return normalizeSupportedMetricKeys(device.selectedMetricKeys, supportedKeys);
  if (device.sourceKind === 'public' || device.sourceKind === 'pinned') return supportedKeys;
  return null;
}

function getDashboardTileClassName(): string {
  return 'h-96';
}

function getDashboardSetupPrompt(
  currentError: Error | null,
  rainfallError: Error | null,
  layoutError: Error | null,
  devices: readonly SettingsDeviceDto[] | undefined,
  devicesLoading: boolean,
  hasAmbientCredentials: boolean,
): string | null {
  const visibleDevices = devices?.filter((device) => device.displayOnDashboard) ?? [];
  const hasVisibleExternalSource = visibleDevices.some((device) => (device.sourceKind ?? 'ambient') !== 'ambient');

  if (!hasAmbientCredentials && !hasVisibleExternalSource) {
    return 'Save your Ambient Weather credentials in Settings to load your dashboard.';
  }

  const errors = [currentError, rainfallError, layoutError]
    .map((error) => error?.message.toLowerCase() ?? '')
    .filter((message) => message.length > 0);

  if (errors.some((message) => message.includes('ambient-credentials-required'))) {
    return 'Save your Ambient Weather credentials in Settings to load your dashboard.';
  }

  if (errors.some((message) => message.includes('ambient-stations-required'))) {
    return 'Refresh your station list in Settings before the dashboard can show weather data.';
  }

  if (!devicesLoading && visibleDevices.length === 0) {
    return 'No dashboard stations are enabled. Open Settings to sync stations or choose which sources appear here.';
  }

  return null;
}

function createUniformTile(
  tile: Omit<DashboardTileDto, 'x' | 'y' | 'w' | 'h'>,
): DashboardTileDto {
  return {
    ...tile,
    x: 0,
    y: 0,
    w: UNIFORM_TILE_WIDTH,
    h: UNIFORM_TILE_HEIGHT,
  };
}

function orderDashboardCategoryTypes(
  selectedMetricKeys: readonly string[] | null,
): readonly DashboardCategoryType[] {
  const orderedTypes: DashboardCategoryType[] = [];

  for (const key of selectedMetricKeys ?? []) {
    const group = GROUP_DEFS.find((candidate) => candidate.metrics.some((metric) => metric === key));
    const type = group?.type ?? (RAINFALL_METRICS.some((metric) => metric === key) ? 'rainfall' : undefined);
    if (type && !orderedTypes.includes(type)) {
      orderedTypes.push(type);
    }
  }

  for (const group of GROUP_DEFS) {
    if (!orderedTypes.includes(group.type)) {
      orderedTypes.push(group.type);
    }
  }

  if (!orderedTypes.includes('rainfall')) {
    orderedTypes.push('rainfall');
  }

  return orderedTypes;
}

function formatRealtimeConnection(
  hubState: string,
  devices: readonly SettingsDeviceDto[] | undefined,
  devicesLoading: boolean,
  devicesError: boolean,
  tzPreference: string,
): string {
  const state = hubState === 'connected' ? 'Connected' : hubState.charAt(0).toUpperCase() + hubState.slice(1);
  const prefix = tzPreference === 'utc' ? `${state} (UTC)` : state;

  if (devicesLoading) return `${prefix}: Loading stations…`;
  if (devicesError) return `${prefix}: Stations unavailable`;

  const visibleDevices = orderDevicesPrimaryFirst(
    devices?.filter((device) => device.displayOnDashboard) ?? [],
  );

  if (visibleDevices.length === 0) return `${prefix}: No stations configured`;

  const stationNames = visibleDevices.map((device) => device.nickname ?? device.name ?? device.macAddress);
  return `${prefix}: ${stationNames.join(', ')}`;
}

interface DashboardTileGroup {
  readonly key: string;
  readonly macAddress: string;
  readonly sourceKind: SettingsDeviceDto['sourceKind'];
  readonly isMock: boolean;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly tiles: readonly DashboardTileDto[];
}

function buildTileGroups(
  tiles: readonly DashboardTileDto[],
  devices: readonly SettingsDeviceDto[] | undefined,
): readonly DashboardTileGroup[] {
  const visibleDevices = orderDevicesPrimaryFirst(
    devices?.filter((device) => device.displayOnDashboard) ?? [],
  );

  if (visibleDevices.length === 0) {
    return [];
  }

  const primaryDevice = visibleDevices.find(isOwnedPrimaryDevice) ?? visibleDevices.find(isOwnedAmbientDevice);
  const primaryMac = primaryDevice ? normalizeMac(primaryDevice.macAddress) : null;

  return visibleDevices
    .map((device) => {
      const mac = normalizeMac(device.macAddress);
      const groupTiles = tiles.filter((tile) => {
        if (tile.type === 'rainfall') {
          return primaryMac !== null && mac === primaryMac;
        }

        return tile.deviceId ? normalizeMac(tile.deviceId) === mac : false;
      });

      return {
        key: mac,
        macAddress: device.macAddress,
        sourceKind: device.sourceKind,
        isMock: device.isMock === true,
        label: device.nickname ?? device.name ?? device.macAddress,
        isPrimary: primaryMac !== null && mac === primaryMac,
        tiles: groupTiles,
      };
    })
    .filter((group) => group.tiles.length > 0);
}

function isAmbientComparisonEligibleGroup(group: DashboardTileGroup): boolean {
  const sourceKind = group.sourceKind ?? 'ambient';
  return sourceKind === 'ambient'
    && !group.isMock
    && !isRuntimeMockMac(group.macAddress);
}

function isOwnedPrimaryDevice(device: SettingsDeviceDto): boolean {
  return isOwnedAmbientDevice(device) && device.isPrimary;
}

function isOwnedAmbientDevice(device: SettingsDeviceDto): boolean {
  const sourceKind = device.sourceKind ?? 'ambient';
  return sourceKind === 'ambient';
}

function orderDevicesPrimaryFirst(
  devices: readonly SettingsDeviceDto[],
): readonly SettingsDeviceDto[] {
  return [...devices].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    return 0;
  });
}

/** Returns nickname → provider name → undefined for the device identified by the tile. */
function getStationLabel(
  tileType: string,
  deviceId: string | null | undefined,
  devices: readonly SettingsDeviceDto[],
): string | undefined {
  if (tileType === 'status' || tileType === 'rainfall') {
    const primary = devices.find((d) => d.isPrimary) ?? devices.at(0);
    return primary?.nickname ?? primary?.name ?? undefined;
  }
  if (!deviceId) return undefined;
  const mac = normalizeMac(deviceId);
  const device = devices.find((d) => normalizeMac(d.macAddress) === mac);
  return device?.nickname ?? device?.name ?? undefined;
}

// ── Tile dispatcher ───────────────────────────────────────────────────────────

interface DashboardTileProps {
  readonly tile: DashboardTileDto;
  readonly current: ReturnType<typeof useDashboardCurrent>;
  readonly rainfall: ReturnType<typeof useDashboardRainfall>;
  readonly extrema: ReturnType<typeof useDashboardExtrema>;
  readonly preferences: typeof DEFAULT_USER_PREFERENCES;
  readonly selectedRainfallKeys: readonly string[] | undefined;
  readonly devices: readonly SettingsDeviceDto[] | undefined;
  readonly publicSourceReadings: ReadonlyMap<string, DashboardTileReading>;
  readonly isPublicSourceReadingsLoading: boolean;
}

type DashboardTileReading = NonNullable<ReturnType<typeof useDashboardCurrent>['data']>;

function DashboardTile({
  tile, current, rainfall, extrema, preferences, selectedRainfallKeys, devices, publicSourceReadings,
  isPublicSourceReadingsLoading,
}: DashboardTileProps) {
  const stationLabel = devices ? getStationLabel(tile.type, tile.deviceId, devices) : undefined;
  const tileClassName = 'h-full';
  const tileDevice = tile.deviceId && devices
    ? devices.find((device) => normalizeMac(device.macAddress) === normalizeMac(tile.deviceId ?? ''))
    : undefined;
  const tileReading = tileDevice?.sourceKind === 'public'
    ? publicSourceReadings.get(tileDevice.macAddress)
    : current.data;
  const canOpenHistory = (tileDevice?.sourceKind ?? 'ambient') === 'ambient' && tileReading?.source !== 'neighbors';
  const historyDeviceId = canOpenHistory ? tileDevice?.macAddress : null;
  const isTileLoading = tileDevice?.sourceKind === 'public' ? isPublicSourceReadingsLoading : current.isPending;
  const isTileError = tileDevice?.sourceKind === 'public'
    ? !isPublicSourceReadingsLoading && tileReading === undefined
    : current.isError;

  // When showing neighbor aggregate data, indoor-only metrics are unavailable — exclude them.
  const isNeighborsSource = tileReading?.source === 'neighbors';

  // Compute which keys from this tile's device are in the given group,
  // filtering out indoor keys when viewing neighbor aggregate data.
  const groupKeys = (groupMetrics: readonly string[]): readonly string[] => {
    const base: readonly string[] = (() => {
      if (!tile.deviceId || !devices) return [...groupMetrics];
      const mac = normalizeMac(tile.deviceId);
      const device = devices.find((d) => normalizeMac(d.macAddress) === mac);
      const keys = device ? getDefaultLayoutMetricKeys(device) : null;
      if (!keys) return [...groupMetrics];
      return keys.filter((key) => groupMetrics.includes(key));
    })();
    return isNeighborsSource ? base.filter((key) => !NEIGHBOR_EXCLUDED_KEYS.has(key)) : base;
  };

  switch (tile.type) {
    case 'status':
      return null;
    case 'rainfall':
      return (
        <RainfallSummaryTile
          className={tileClassName}
          rainfall={rainfall.data}
          preferences={preferences}
          isLoading={rainfall.isPending}
          isError={rainfall.isError}
          selectedKeys={selectedRainfallKeys}
          stationLabel={stationLabel}
          historyDeviceId={historyDeviceId}
          canOpenHistory={canOpenHistory}
        />
      );
    case 'temperature': {
      const tempKeys = groupKeys(TEMPERATURE_METRICS);
      if (tempKeys.length === 0) return null;
      return (
        <TemperatureTile
          className={tileClassName}
          reading={tileReading}
          extrema={extrema.data}
          preferences={preferences}
          selectedKeys={tempKeys}
          stationLabel={stationLabel}
          historyDeviceId={historyDeviceId}
          canOpenHistory={canOpenHistory}
          isLoading={isTileLoading}
          isError={isTileError}
        />
      );
    }
    case 'humidity': {
      const humidityKeys = groupKeys(HUMIDITY_METRICS);
      if (humidityKeys.length === 0) return null;
      return (
        <HumidityTile
          className={tileClassName}
          reading={tileReading}
          preferences={preferences}
          selectedKeys={humidityKeys}
          stationLabel={stationLabel}
          historyDeviceId={historyDeviceId}
          canOpenHistory={canOpenHistory}
          isLoading={isTileLoading}
          isError={isTileError}
        />
      );
    }
    case 'wind': {
      const windKeys = groupKeys(WIND_METRICS);
      if (windKeys.length === 0) return null;
      return (
        <WindTile
          className={tileClassName}
          reading={tileReading}
          preferences={preferences}
          selectedKeys={windKeys}
          stationLabel={stationLabel}
          historyDeviceId={historyDeviceId}
          canOpenHistory={canOpenHistory}
          isLoading={isTileLoading}
          isError={isTileError}
        />
      );
    }
    case 'solar': {
      const solarKeys = groupKeys(SOLAR_METRICS);
      if (solarKeys.length === 0) return null;
      return (
        <SolarTile
          className={tileClassName}
          reading={tileReading}
          preferences={preferences}
          selectedKeys={solarKeys}
          stationLabel={stationLabel}
          historyDeviceId={historyDeviceId}
          canOpenHistory={canOpenHistory}
          isLoading={isTileLoading}
          isError={isTileError}
        />
      );
    }
    case 'conditions': {
      const conditionKeys = groupKeys(CONDITIONS_METRICS);
      if (conditionKeys.length === 0) return null;
      return (
        <ConditionsTile
          className={tileClassName}
          reading={tileReading}
          preferences={preferences}
          selectedKeys={conditionKeys}
          stationLabel={stationLabel}
          isLoading={isTileLoading}
          isError={isTileError}
        />
      );
    }
    case 'metric':
      return (
        <MetricTile
          className={tileClassName}
          metricKey={tile.metricKey ?? ''}
          reading={tileReading}
          preferences={preferences}
          isLoading={isTileLoading}
          isError={isTileError}
          stationLabel={stationLabel}
        />
      );
  }
}

function DashboardLoadingTiles() {
  return Array.from({ length: 6 }).map((_, i) => (
    <Card key={i} data-test-id="dashboard-tile-loading">
      <CardContent className="flex h-40 items-end p-6">
        <span className="text-sm text-muted-foreground">Loading</span>
      </CardContent>
    </Card>
  ));
}

const fallbackTiles: readonly DashboardTileDto[] = [
  createUniformTile({ i: 'rainfall', type: 'rainfall' }),
];

export default DashboardPage;
