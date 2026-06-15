import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { MetricHistoryControls } from '../components/charts/MetricHistoryControls';
import { MetricHistoryChart } from '../components/charts/MetricHistoryChart';
import { MetricHistoryTable } from '../components/charts/MetricHistoryTable';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useMetricHistory } from '../hooks/useMetricHistory';
import { useSettingsDevices } from '../hooks/useSettingsDevices';
import { useSettingsPreferences } from '../hooks/useSettingsPreferences';
import { isHistoryMetricKey } from '../lib/historyMetrics';
import { sanitizeErrorForDisplay } from '../lib/apiErrors';
import { buildRecentDayOptions, formatDateInputValue } from '../lib/recentDays';
import { isRuntimeMockMac } from '../lib/runtimeMockStations';
import {
  METRIC_REGISTRY,
  type MetricHistoryGranularity,
  type MetricHistoryParams,
  type MetricHistoryRange,
} from '../types/metrics';

/** Metric history work surface. ECharts lands in Phase 12.2. */
export function MetricDetailPage() {
  const { metricKey } = useParams<{ metricKey: string }>();
  const [searchParams] = useSearchParams();
  const definition = metricKey ? METRIC_REGISTRY[metricKey] : undefined;
  // Gate on the canonical history-chartable set so current-only metrics
  // (om_* extended fields) get the clear unsupported state instead of a
  // doomed history fetch — same gate MetricHistoryValueLink uses for tiles.
  const isMetricSupported =
    metricKey !== undefined && definition !== undefined && isHistoryMetricKey(metricKey);

  const recentDayOptions = useMemo(() => buildRecentDayOptions(), []);
  const [range, setRange] = useState<MetricHistoryRange>('24h');
  const [viewMode, setViewMode] = useState<'rolling' | 'day'>('rolling');
  const [dayChoice, setDayChoice] = useState(() => recentDayOptions[0]?.value ?? 'custom');
  const [granularity, setGranularity] = useState<MetricHistoryGranularity>('auto');
  const [date, setDate] = useState(() => recentDayOptions[0]?.value ?? formatDateInputValue(new Date()));
  const [deviceId, setDeviceId] = useState(() => searchParams.get('deviceId') ?? '');
  const [comparisonDeviceId, setComparisonDeviceId] = useState('');
  const [timezone, setTimezone] = useState<'utc' | 'local'>('local');
  const hasSyncedTimezonePreference = useRef(false);

  const devices = useSettingsDevices();
  const preferences = useSettingsPreferences();
  const ownedDevices = useMemo(
    () => (devices.data ?? []).filter((device) => (device.sourceKind ?? 'ambient') === 'ambient'),
    [devices.data],
  );
  const stationOptions = useMemo(
    () => ownedDevices.map((device) => ({
      value: device.macAddress,
      label: device.nickname ?? device.name ?? device.macAddress,
    })),
    [ownedDevices],
  );
  const selectedComparisonBaseDeviceId = useMemo(() => {
    if (deviceId) return deviceId;
    const primaryDevice = ownedDevices.find((device) => device.isPrimary);
    if (primaryDevice) return primaryDevice.macAddress;
    return stationOptions.length > 0 ? stationOptions[0].value : '';
  }, [deviceId, ownedDevices, stationOptions]);
  const comparisonStationOptions = useMemo(
    () => ownedDevices
      .filter((device) => device.macAddress !== selectedComparisonBaseDeviceId)
      .filter((device) => device.isMock !== true && !isRuntimeMockMac(device.macAddress))
      .map((device) => ({
        value: device.macAddress,
        label: device.nickname ?? device.name ?? device.macAddress,
      })),
    [ownedDevices, selectedComparisonBaseDeviceId],
  );
  const effectiveComparisonDeviceId = comparisonStationOptions.some((station) => station.value === comparisonDeviceId)
    ? comparisonDeviceId
    : '';

  const historyParams = useMemo<MetricHistoryParams>(() => {
    const effectiveRange: MetricHistoryRange = viewMode === 'day' ? 'date' : range;

    return {
      range: effectiveRange,
      granularity,
      source: 'my',
      ...(effectiveRange === 'date' ? { date } : {}),
      ...(deviceId ? { deviceId } : {}),
    };
  }, [date, deviceId, granularity, range, viewMode]);

  const history = useMetricHistory(metricKey, historyParams, { enabled: isMetricSupported });
  const historyData = history.data;
  const comparisonParams = useMemo<MetricHistoryParams>(() => ({
    ...historyParams,
    deviceId: effectiveComparisonDeviceId,
  }), [effectiveComparisonDeviceId, historyParams]);
  const comparisonHistory = useMetricHistory(
    metricKey,
    comparisonParams,
    { enabled: isMetricSupported && effectiveComparisonDeviceId.length > 0 },
  );
  const comparisonSeries = useMemo(() => {
    if (!comparisonHistory.data || comparisonHistory.data.points.length === 0) return [];
    return [{
      name: comparisonHistory.data.deviceName ?? selectedDeviceLabel(effectiveComparisonDeviceId, ownedDevices) ?? 'Comparison station',
      points: comparisonHistory.data.points,
    }];
  }, [effectiveComparisonDeviceId, comparisonHistory.data, ownedDevices]);
  const comparisonStatus = useMemo(() => {
    if (!effectiveComparisonDeviceId) {
      return '';
    }
    if (comparisonHistory.isPending) {
      return 'Loading comparison history...';
    }
    if (comparisonHistory.isError) {
      return sanitizeErrorForDisplay(comparisonHistory.error?.message);
    }
    if ((comparisonHistory.data?.points.length ?? 0) === 0) {
      return 'The selected comparison station has no history points for this metric and range.';
    }
    return `Comparing against ${comparisonHistory.data?.deviceName ?? selectedDeviceLabel(effectiveComparisonDeviceId, ownedDevices) ?? 'selected station'}.`;
  }, [
    effectiveComparisonDeviceId,
    comparisonHistory.data,
    comparisonHistory.error,
    comparisonHistory.isError,
    comparisonHistory.isPending,
    ownedDevices,
  ]);

  useEffect(() => {
    if (hasSyncedTimezonePreference.current || !preferences.data) return;
    setTimezone(preferences.data.dailyExtremaTimezone);
    hasSyncedTimezonePreference.current = true;
  }, [preferences.data]);

  if (!metricKey || definition === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6" data-test-id="metric-detail-page">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline" data-test-id="metric-detail-back-link">
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Back to dashboard
        </Link>
        <Alert variant="destructive" data-test-id="metric-detail-invalid">
          <AlertTitle>Metric is not available</AlertTitle>
          <AlertDescription>The requested metric key is not supported by this dashboard.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isMetricSupported) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6" data-test-id="metric-detail-page">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline" data-test-id="metric-detail-back-link">
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Back to dashboard
        </Link>
        <Alert data-test-id="metric-detail-unsupported">
          <AlertTitle>{definition.label}</AlertTitle>
          <AlertDescription>
            This metric does not have chartable history yet. Text and daily aggregate metrics stay on the dashboard for now.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6" data-test-id="metric-detail-page">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline" data-test-id="metric-detail-back-link">
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        Back to dashboard
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-normal" data-test-id="metric-detail-title">
          {definition.label}
        </h1>
        <p className="text-sm text-muted-foreground" data-test-id="metric-detail-subtitle">
          {history.data?.deviceName ?? selectedDeviceLabel(deviceId, ownedDevices) ?? 'Own station history'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">History controls</CardTitle>
          <CardDescription>Choose the history window and station for the chart.</CardDescription>
        </CardHeader>
        <CardContent>
          <MetricHistoryControls
            viewMode={viewMode}
            range={range}
            dayChoice={dayChoice}
            date={date}
            granularity={granularity}
            deviceId={deviceId}
            recentDayOptions={recentDayOptions}
            stationOptions={stationOptions}
            comparisonDeviceId={effectiveComparisonDeviceId}
            comparisonStationOptions={comparisonStationOptions}
            comparisonStatus={comparisonStatus}
            showComparison={comparisonStationOptions.length > 0}
            onViewModeChange={setViewMode}
            onRangeChange={(value) => {
              setRange(value);
              setViewMode('rolling');
            }}
            onDayChoiceChange={(value) => {
              setDayChoice(value);
              setViewMode('day');
              if (value !== 'custom') {
                setDate(value);
              }
            }}
            onDateChange={setDate}
            onGranularityChange={setGranularity}
            onDeviceChange={(value) => {
              setDeviceId(value);
              if (value === comparisonDeviceId) {
                setComparisonDeviceId('');
              }
            }}
            onComparisonDeviceChange={setComparisonDeviceId}
          />
        </CardContent>
      </Card>

      <Card data-test-id="metric-detail-history-panel">
        <CardHeader>
          <CardTitle as="h2" className="text-base">History preview</CardTitle>
          <CardDescription data-test-id="metric-detail-history-context">
            {historyData
              ? `${historyData.range} from ${formatTimestamp(historyData.fromUtc, timezone)} to ${formatTimestamp(historyData.toUtc, timezone)}`
              : 'History data will appear here.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.isPending && <p className="text-sm text-muted-foreground" data-test-id="metric-detail-loading">Loading history...</p>}

          {history.isError && (
            <Alert variant="destructive" data-test-id="metric-detail-error">
              <AlertTitle>History is unavailable</AlertTitle>
              <AlertDescription>{sanitizeErrorForDisplay(history.error?.message)}</AlertDescription>
              <Button className="mt-3" variant="outline" size="sm" onClick={history.refetch} data-test-id="metric-detail-retry">
                Retry
              </Button>
            </Alert>
          )}

          {(historyData?.warnings.length ?? 0) > 0 && historyData && (
            <Alert role="status" aria-live="polite" aria-atomic="true" data-test-id="metric-detail-warnings">
              <AlertTitle>{historyData.warnings.length.toString()} warning{historyData.warnings.length === 1 ? '' : 's'}</AlertTitle>
              <AlertDescription>{historyData.warnings.join(' ')}</AlertDescription>
            </Alert>
          )}

          {historyData?.points.length === 0 && (
            <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground" data-test-id="metric-detail-empty">
              <p className="font-medium text-foreground" data-test-id="metric-detail-empty-title">
                No chartable {definition.label.toLowerCase()} history found.
              </p>
              <p className="mt-1" data-test-id="metric-detail-empty-description">
                {buildMissingSensorMessage(definition.label)}
              </p>
            </div>
          )}

          {historyData && historyData.points.length > 0 && (
            <>
              <MetricHistoryChart
                metricLabel={definition.label}
                unit={historyData.unit}
                category={definition.category}
                points={historyData.points}
                comparisonSeries={comparisonSeries}
                timezone={timezone}
              />
              <MetricHistoryTable
                metricLabel={definition.label}
                unit={historyData.unit}
                points={historyData.points}
                timezone={timezone}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function selectedDeviceLabel(deviceId: string, devices: readonly { readonly macAddress: string; readonly nickname: string | null; readonly name: string | null }[]) {
  if (!deviceId) return null;
  const device = devices.find((candidate) => candidate.macAddress === deviceId);
  return device?.nickname ?? device?.name ?? deviceId;
}

function buildMissingSensorMessage(metricLabel: string): string {
  return `This can happen when the selected station does not report ${metricLabel.toLowerCase()}, the sensor is missing or offline, or the selected range has no cached readings.`;
}

function formatTimestamp(isoString: string, tz: 'utc' | 'local' = 'utc'): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  if (tz === 'local') {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  const yyyy = date.getUTCFullYear().toString();
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const min = date.getUTCMinutes().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

export default MetricDetailPage;
