import { useEffect, useRef } from 'react';
import { Pin, PinOff, X } from 'lucide-react';
import { convertDistance, distanceLabel } from '../../lib/units';
import type { NeighborStationDto, PinnedNeighborStationDto } from '../../types/neighbors';
import type { UserPreferencesDto } from '../../types/settings';

const PROVIDER_LABELS: Record<string, string> = {
  WeatherGov: 'NWS',
  OpenMeteo: 'Open-Meteo',
  AmbientOpen: 'Ambient',
};

const DISCOVERY_KIND_LABELS: Record<string, string> = {
  city: 'Place',
  county: 'County',
  airport: 'Airport',
  'station-location': 'Station area',
};

function ProviderBadge({ provider }: { readonly provider: string }) {
  const label = PROVIDER_LABELS[provider] ?? provider;
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {label}
    </span>
  );
}

function DiscoveryKindBadge({ kind }: { readonly kind: string | null | undefined }) {
  if (!kind) return null;
  const label = DISCOVERY_KIND_LABELS[kind] ?? kind;
  return (
    <span
      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      data-test-id="neighbors-station-kind-badge"
    >
      {label}
    </span>
  );
}

function FreshnessText({ minutes }: { readonly minutes: number | null }) {
  if (minutes === null) return null;
  if (minutes < 60) return <span className="text-xs text-muted-foreground">{minutes}m ago</span>;
  const hours = Math.round(minutes / 60);
  return <span className="text-xs text-muted-foreground">{hours}h ago</span>;
}

interface StationRowProps {
  readonly station: NeighborStationDto;
  readonly isPinned: boolean;
  readonly distanceUnit: UserPreferencesDto['distanceUnit'];
  readonly onPinToggle?: (station: NeighborStationDto) => void;
}

function StationRow({ station, isPinned, distanceUnit, onPinToggle }: StationRowProps) {
  const name = station.name ?? station.sourceId;
  const distance = convertDistance(station.distanceMiles, distanceUnit) ?? station.distanceMiles;
  const distLabel = distance < 0.1 ? '<0.1' : distance.toFixed(1);

  return (
    <div
      className="flex flex-col gap-1 border-b pb-3 last:border-b-0"
      data-test-id="neighbors-station-row"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">{name}</span>
        <DiscoveryKindBadge kind={station.discoveryKind} />
        <ProviderBadge provider={station.provider} />
        <span className="text-xs text-muted-foreground">{distLabel} {distanceLabel(distanceUnit)}</span>
        <FreshnessText minutes={station.freshnessMinutes} />
        {onPinToggle && (
          <button
            type="button"
            onClick={() => { onPinToggle(station); }}
            aria-label={isPinned ? `Unpin ${name}` : `Pin ${name} to dashboard`}
            aria-pressed={isPinned}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-test-id="neighbors-station-pin-button"
          >
            {isPinned
              ? <PinOff className="h-4 w-4 text-primary" aria-hidden="true" />
              : <Pin className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {station.tempF !== null && (
          <span>{station.tempF.toFixed(1)}°F</span>
        )}
        {station.humidity !== null && (
          <span>{station.humidity}% RH</span>
        )}
        {station.windSpeedMph !== null && (
          <span>{station.windSpeedMph.toFixed(1)} mph</span>
        )}
      </div>
    </div>
  );
}

interface NeighborsStationDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly stations: readonly NeighborStationDto[];
  readonly distanceUnit?: UserPreferencesDto['distanceUnit'];
  readonly pinnedStations?: readonly PinnedNeighborStationDto[];
  readonly onPinToggle?: (station: NeighborStationDto) => void;
}

export function NeighborsStationDrawer({
  open,
  onClose,
  stations,
  distanceUnit = 'mi',
  pinnedStations = [],
  onPinToggle,
}: NeighborsStationDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => { window.cancelAnimationFrame(frameId); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || drawerRef.current === null) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); };
  }, [open, onClose]);

  if (!open) return null;

  const isPinned = (s: NeighborStationDto) =>
    pinnedStations.some((p) => p.provider === s.provider && p.sourceId === s.sourceId);
  const discoveryKindCount = new Set(stations.map((station) => station.discoveryKind).filter(Boolean)).size;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nearby weather stations"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-background shadow-xl"
        data-test-id="neighbors-station-drawer"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">
            Nearby stations{stations.length > 0 ? ` (${String(stations.length)})` : ''}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close nearby stations"
            className="rounded-sm p-1 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-test-id="neighbors-station-drawer-close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {pinnedStations.length > 0 && (
          <p className="px-4 pt-2 text-xs text-muted-foreground">
            {pinnedStations.length} station{pinnedStations.length === 1 ? '' : 's'} pinned to dashboard
          </p>
        )}
        {discoveryKindCount > 1 && (
          <p className="px-4 pt-2 text-xs text-muted-foreground" data-test-id="neighbors-station-search-match-note">
            Multiple match types were included. Review the Place, County, and Airport badges before pinning sources.
          </p>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {stations.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-test-id="neighbors-station-drawer-empty">
              No nearby stations found. Try increasing the search radius or changing the discovery location.
            </p>
          ) : (
            stations.map((station) => (
              <StationRow
                key={`${station.provider}:${station.sourceId}`}
                station={station}
                isPinned={isPinned(station)}
                distanceUnit={distanceUnit}
                onPinToggle={onPinToggle}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
