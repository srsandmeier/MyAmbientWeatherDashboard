import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TemperatureTile } from './TemperatureTile';
import { HumidityTile } from './HumidityTile';
import { WindTile } from './WindTile';
import { SolarTile } from './SolarTile';
import { RainfallSummaryTile } from './RainfallSummaryTile';
import { ConditionsTile } from './ConditionsTile';
import { usePinnedStationCurrent } from '../../hooks/usePinnedStationCurrent';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import { getProviderSupportedMetricKeys, normalizeSupportedMetricKeys } from '../../lib/providerMetricSupport';
import { weatherProviderLabel } from '../../lib/weatherProviderLabels';
import {
  CONDITIONS_METRICS, HUMIDITY_METRICS,
  RAINFALL_METRICS, SOLAR_METRICS, TEMPERATURE_METRICS, WIND_METRICS,
} from '../../lib/metricGroups';
import type { CurrentReadingDto, DailyExtremaDto, DashboardRainfallDto } from '../../types/dashboard';
import type { PinnedNeighborStationDto } from '../../types/neighbors';

interface PinnedStationTileGroupProps {
  readonly pin: PinnedNeighborStationDto;
  readonly preferences?: typeof DEFAULT_USER_PREFERENCES;
}

/**
 * Renders a tile group for a single pinned neighbor station, using the same tile
 * components as owned stations. Only outdoor metrics are shown (indoor sensors are
 * not available from neighbor providers).
 */
export function PinnedStationTileGroup({
  pin,
  preferences = DEFAULT_USER_PREFERENCES,
}: PinnedStationTileGroupProps) {
  const current = usePinnedStationCurrent(pin.provider, pin.sourceId);
  const [isExpanded, setIsExpanded] = useState(true);
  const stationLabel = pin.displayLabel ?? current.data?.deviceName ?? pin.sourceId;
  const providerLabel = weatherProviderLabel(pin.provider);
  const supportedMetricKeys = getProviderSupportedMetricKeys('pinned', pin.provider) ?? [];
  const selectedMetricKeys = normalizeSupportedMetricKeys(pin.selectedMetricKeys, supportedMetricKeys);
  const selectedTemperatureKeys = selectedMetricKeys.filter((k) => TEMPERATURE_METRICS.includes(k as typeof TEMPERATURE_METRICS[number]));
  const selectedHumidityKeys = selectedMetricKeys.filter((k) => HUMIDITY_METRICS.includes(k as typeof HUMIDITY_METRICS[number]));
  const selectedWindKeys = selectedMetricKeys.filter((k) => WIND_METRICS.includes(k as typeof WIND_METRICS[number]));
  const selectedSolarKeys = selectedMetricKeys.filter((k) => SOLAR_METRICS.includes(k as typeof SOLAR_METRICS[number]));
  const selectedRainfallKeys = selectedMetricKeys.filter((k) => RAINFALL_METRICS.includes(k as typeof RAINFALL_METRICS[number]));
  const selectedConditionKeys = selectedMetricKeys.filter((k) => CONDITIONS_METRICS.includes(k as typeof CONDITIONS_METRICS[number]));
  const rainfall = current.data
    ? toRainfallDto(stationLabel, current.data)
    : undefined;

  const extrema: DailyExtremaDto | undefined = (
    current.data != null &&
    (current.data.dailyHighTempF != null || current.data.dailyLowTempF != null)
  ) ? {
    deviceId: current.data.deviceId,
    deviceName: stationLabel,
    dateUtc: current.data.timestampUtc,
    dailyHighTempF: current.data.dailyHighTempF,
    dailyLowTempF: current.data.dailyLowTempF,
    dailyHighTempInF: null,
    dailyLowTempInF: null,
  } : undefined;

  if (selectedMetricKeys.length === 0) {
    return null;
  }

  return (
    <details
      className="group space-y-3 rounded-lg border border-border bg-surface-layer-3 p-4"
      aria-labelledby={`dashboard-pinned-heading-${pin.provider}-${pin.sourceId}`}
      data-test-id="dashboard-pinned-station-group"
      open={isExpanded}
      onToggle={(event) => { setIsExpanded(event.currentTarget.open); }}
    >
      <summary
        className="flex cursor-pointer list-none flex-wrap items-baseline gap-2 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
        aria-expanded={isExpanded}
        aria-controls={`dashboard-pinned-content-${pin.provider}-${pin.sourceId}`}
        data-test-id="dashboard-source-summary"
      >
        <ChevronDown
          className="h-4 w-4 -rotate-90 text-muted-foreground transition-transform duration-200 group-open:rotate-0"
          aria-hidden="true"
        />
        <h3
          id={`dashboard-pinned-heading-${pin.provider}-${pin.sourceId}`}
          className="text-base font-semibold text-foreground"
          data-test-id="dashboard-source-heading"
        >
          {stationLabel}
        </h3>
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {providerLabel}
        </span>
        {current.isNotCached && (
          <span className="text-xs text-muted-foreground italic">
            Not in cache — refresh stations in Settings
          </span>
        )}
      </summary>
      <div
        id={`dashboard-pinned-content-${pin.provider}-${pin.sourceId}`}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        data-test-id="dashboard-tile-grid"
      >
        {selectedTemperatureKeys.length > 0 && (
          <TemperatureTile
            reading={current.data}
            extrema={extrema}
            preferences={preferences}
            selectedKeys={selectedTemperatureKeys}
            stationLabel={stationLabel}
            canOpenHistory={false}
            isLoading={current.isPending}
            isError={current.isError}
          />
        )}
        {selectedHumidityKeys.length > 0 && (
          <HumidityTile
            reading={current.data}
            preferences={preferences}
            selectedKeys={selectedHumidityKeys}
            stationLabel={stationLabel}
            canOpenHistory={false}
            isLoading={current.isPending}
            isError={current.isError}
          />
        )}
        {selectedWindKeys.length > 0 && (
          <WindTile
            reading={current.data}
            preferences={preferences}
            selectedKeys={selectedWindKeys}
            stationLabel={stationLabel}
            canOpenHistory={false}
            isLoading={current.isPending}
            isError={current.isError}
          />
        )}
        {selectedSolarKeys.length > 0 && (
          <SolarTile
            reading={current.data}
            preferences={preferences}
            selectedKeys={selectedSolarKeys}
            stationLabel={stationLabel}
            canOpenHistory={false}
            isLoading={current.isPending}
            isError={current.isError}
          />
        )}
        {selectedRainfallKeys.length > 0 && (
          <RainfallSummaryTile
            rainfall={rainfall}
            preferences={preferences}
            selectedKeys={selectedRainfallKeys}
            canOpenHistory={false}
            isLoading={current.isPending}
            isError={current.isError}
          />
        )}
        {selectedConditionKeys.length > 0 && (
          <ConditionsTile
            reading={current.data}
            preferences={preferences}
            selectedKeys={selectedConditionKeys}
            stationLabel={stationLabel}
            isLoading={current.isPending}
            isError={current.isError}
          />
        )}
      </div>
    </details>
  );
}

function toRainfallDto(deviceName: string, reading: CurrentReadingDto): DashboardRainfallDto {
  return {
    deviceId: reading.deviceId,
    deviceName,
    timestampUtc: reading.timestampUtc,
    receivedAtUtc: reading.receivedAtUtc,
    eventRainIn: reading.hourlyRainIn ?? null,
    dailyRainIn: reading.dailyRainIn ?? null,
    weeklyRainIn: reading.weeklyRainIn ?? null,
    monthlyRainIn: reading.monthlyRainIn ?? null,
    yearlyRainIn: reading.yearlyRainIn ?? null,
    lastRain: null,
  };
}
