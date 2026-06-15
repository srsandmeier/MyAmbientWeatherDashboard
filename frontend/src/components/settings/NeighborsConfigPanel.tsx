import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { NeighborsStationDrawer } from '../neighbors/NeighborsStationDrawer';
import { useNeighborsConfig } from '../../hooks/useNeighborsConfig';
import { useSaveNeighborsConfig } from '../../hooks/useSaveNeighborsConfig';
import { useNeighborsRefresh } from '../../hooks/useNeighborsRefresh';
import { useSettingsDevices } from '../../hooks/useSettingsDevices';
import { NEIGHBOR_PROVIDERS, NEIGHBOR_PROVIDER_LABELS } from '../../types/neighbors';
import type { NeighborConfigDto } from '../../types/neighbors';
import { getApiErrorMessage } from '../../lib/apiErrors';

const INPUT_CLASS = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function NeighborsLoadingSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading neighbor configuration"
      data-test-id="settings-neighbors-loading"
    >
      {['Enable', 'Radius', 'Max age', 'Min stations', 'Providers'].map((label) => (
        <div key={label} className="space-y-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-36" />
    </div>
  );
}


export function NeighborsConfigPanel({
  embedded = false,
  hasAmbientCredentials = true,
  isOpen: isOpenProp,
  onToggle,
}: {
  readonly embedded?: boolean;
  readonly hasAmbientCredentials?: boolean;
  readonly isOpen?: boolean;
  readonly onToggle?: () => void;
} = {}) {
  const config = useNeighborsConfig();
  const save = useSaveNeighborsConfig();
  const refresh = useNeighborsRefresh();
  const devices = useSettingsDevices();

  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = embedded ? true : (isOpenProp ?? isOpenInternal);
  const handleToggle = onToggle ?? (() => { setIsOpenInternal((v) => !v); });
  const contentId = useId();

  // Local edits as delta on top of fetched config
  const [changes, setChanges] = useState<Partial<NeighborConfigDto>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const base = config.data ?? {
    isEnabled: false,
    radiusMiles: 25,
    comparisonRadiusMiles: 25,
    maxAgeMinutes: 30,
    minStations: 3,
    enabledProviders: ['WeatherGov', 'OpenMeteo'],
    refreshIntervalMinutes: 15,
    discoveryLocationQuery: null,
  };

  const form: NeighborConfigDto = { ...base, ...changes };

  const hasStationCoords = hasAmbientCredentials && (devices.data ?? []).some((d) => d.latitude != null);
  const hasLocationSource = !!(form.discoveryLocationQuery?.trim()) || hasStationCoords;

  const setField = <K extends keyof NeighborConfigDto>(key: K, value: NeighborConfigDto[K]) => {
    setSaveError(null);
    setChanges((prev) => ({ ...prev, [key]: value }));
  };

  const handleProviderToggle = (provider: string) => {
    const current = form.enabledProviders;
    const next = current.includes(provider)
      ? current.filter((p) => p !== provider)
      : [...current, provider];
    setField('enabledProviders', next);
  };

  const handleSearch = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await save.mutateAsync(form);
      setChanges({});
      await refresh.mutateAsync();
      setDrawerOpen(true);
    } catch (err) {
      setSaveError(err instanceof Error ? getApiErrorMessage(err.message) : 'An unexpected error occurred.');
    }
  };

  const panelBody = config.isPending ? (
    <NeighborsLoadingSkeleton />
  ) : (
    <>
      {config.isError && (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="status" data-test-id="settings-neighbors-load-error">
            Could not load neighbor configuration. Using defaults.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={config.refetch}>
            Try again
          </Button>
        </div>
      )}

      <form onSubmit={(e) => { void handleSearch(e); }} className="space-y-4" aria-label="Nearby station discovery">
        <fieldset className="space-y-4 border-0 p-0">
          <legend className="sr-only">Nearby station search settings</legend>

          {/* Enable toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="neighbors-is-enabled"
              checked={form.isEnabled}
              onChange={(e) => { setField('isEnabled', e.target.checked); }}
              className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-test-id="settings-neighbors-enable-toggle"
            />
            <Label htmlFor="neighbors-is-enabled">Enable nearby station comparison</Label>
          </div>

          {/* Discovery location */}
          <div className="space-y-1">
            <Label htmlFor="neighbors-discovery-location">Discovery location (optional)</Label>
            <input
              type="text"
              id="neighbors-discovery-location"
              placeholder="City, State; ZIP; County, State; airport code"
              maxLength={128}
              value={form.discoveryLocationQuery ?? ''}
              onChange={(e) => { setField('discoveryLocationQuery', e.target.value || null); }}
              className={INPUT_CLASS}
              data-test-id="settings-neighbors-discovery-location-input"
            />
            <p className="text-xs text-muted-foreground">
              Used as the center of this public station search. Examples: Chicago, IL; 60601; Cook County, IL; ORD or KORD.
            </p>
          </div>

          {/* Providers */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground" id="neighbors-providers-label">
              Data providers
            </span>
            <div className="space-y-1.5" role="group" aria-labelledby="neighbors-providers-label">
              {NEIGHBOR_PROVIDERS.map((provider) => {
                const isAmbientOpen = provider === 'AmbientOpen';
                const ambientOpenUnavailable = isAmbientOpen && !config.data?.isAmbientOpenAvailable;
                const ambientOpenMaxRadius = config.data?.ambientOpenMaxRadiusMiles;
                const overMax = isAmbientOpen && ambientOpenMaxRadius !== undefined
                  && form.radiusMiles > ambientOpenMaxRadius
                  && form.enabledProviders.includes('AmbientOpen');
                return (
                  <div key={provider} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`neighbors-provider-${provider}`}
                        checked={form.enabledProviders.includes(provider)}
                        onChange={() => { if (!ambientOpenUnavailable) handleProviderToggle(provider); }}
                        disabled={ambientOpenUnavailable}
                        className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                        data-test-id={`settings-neighbors-provider-${provider}`}
                        aria-label={`${NEIGHBOR_PROVIDER_LABELS[provider]}${ambientOpenUnavailable ? ' (not available on this server)' : ''}`}
                      />
                      <Label
                        htmlFor={`neighbors-provider-${provider}`}
                        className={ambientOpenUnavailable ? 'text-muted-foreground' : undefined}
                      >
                        {NEIGHBOR_PROVIDER_LABELS[provider]}
                        {ambientOpenUnavailable && <span className="ml-1 text-xs">(not enabled)</span>}
                      </Label>
                    </div>
                    {overMax && (
                      <p className="ml-6 text-xs text-muted-foreground" data-test-id="settings-neighbors-ambient-radius-note">
                        Ambient Open coverage is limited to {String(ambientOpenMaxRadius)} mi - stations beyond that distance come from other providers.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="neighbors-radius">Search radius</Label>
              <span className="text-sm font-medium tabular-nums">{Math.round(form.radiusMiles)} mi</span>
            </div>
            <input
              type="range"
              id="neighbors-radius"
              min={5}
              max={50}
              step={1}
              value={form.radiusMiles}
              onChange={(e) => { setField('radiusMiles', Number(e.target.value)); }}
              className="w-full accent-primary"
              data-test-id="settings-neighbors-radius-input"
              aria-valuemin={5}
              aria-valuemax={50}
              aria-valuenow={Math.round(form.radiusMiles)}
              aria-valuetext={`${String(Math.round(form.radiusMiles))} miles`}
            />
            <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
              <span>5 mi</span>
              <span>50 mi</span>
            </div>
          </div>

          {/* Max age */}
          <div className="space-y-1">
            <Label htmlFor="neighbors-maxage">Max observation age (minutes, 5-120)</Label>
            <input
              type="number"
              id="neighbors-maxage"
              min={5}
              max={120}
              step={1}
              value={form.maxAgeMinutes}
              onChange={(e) => { setField('maxAgeMinutes', Number(e.target.value)); }}
              className={INPUT_CLASS}
              data-test-id="settings-neighbors-maxage-input"
            />
          </div>

          {/* Min stations */}
          <div className="space-y-1">
            <Label htmlFor="neighbors-minstations">Minimum reliable station count (1-50)</Label>
            <input
              type="number"
              id="neighbors-minstations"
              min={1}
              max={50}
              step={1}
              value={form.minStations}
              onChange={(e) => { setField('minStations', Number(e.target.value)); }}
              className={INPUT_CLASS}
              data-test-id="settings-neighbors-minstations-input"
            />
          </div>

          {/* Refresh interval */}
          <div className="space-y-1">
            <Label htmlFor="neighbors-refresh-interval">Cache refresh interval (minutes, 5-60)</Label>
            <input
              type="number"
              id="neighbors-refresh-interval"
              min={5}
              max={60}
              step={1}
              value={form.refreshIntervalMinutes}
              onChange={(e) => { setField('refreshIntervalMinutes', Number(e.target.value)); }}
              className={INPUT_CLASS}
              data-test-id="settings-neighbors-refresh-interval-input"
            />
          </div>

        </fieldset>

        {/* Actions */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={save.isPending || refresh.isPending || config.isError || !hasLocationSource}
              data-test-id="settings-neighbors-search-button"
            >
              {(save.isPending || refresh.isPending) ? 'Searching...' : 'Search'}
            </Button>
            {saveError && (
              <span className="text-sm text-destructive" role="alert" aria-live="assertive" data-test-id="settings-neighbors-save-error">
                Search failed: {saveError}
              </span>
            )}
            {refresh.isSuccess && refresh.data && refresh.data.length > 0 && (
              <button
                type="button"
                className="text-sm text-primary underline underline-offset-2 hover:no-underline"
                onClick={() => { setDrawerOpen(true); }}
                data-test-id="settings-neighbors-view-stations-button"
              >
                View {refresh.data.length} station{refresh.data.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          {!hasLocationSource && (
            <p className="text-sm text-muted-foreground" data-test-id="settings-neighbors-needs-location">
              Enter a City, State; ZIP code; County, State; or airport code in the Discovery location field above to find nearby stations.
            </p>
          )}
        </div>
      </form>
    </>
  );

  const drawer = (
    <NeighborsStationDrawer
      open={drawerOpen}
      onClose={() => { setDrawerOpen(false); }}
      stations={refresh.data ?? []}
      pinnedStations={config.data?.pinnedStations ?? []}
      onPinToggle={(station) => {
        const current = config.data?.pinnedStations ?? [];
        const already = current.some(
          (p) => p.provider === station.provider && p.sourceId === station.sourceId,
        );
        const next = already
          ? current.filter((p) => !(p.provider === station.provider && p.sourceId === station.sourceId))
          : [...current, { provider: station.provider, sourceId: station.sourceId, displayLabel: station.name ?? null }];
        void save.mutateAsync({ ...form, pinnedStations: next });
      }}
    />
  );

  if (embedded) {
    return (
      <>
        <section
          className="space-y-4 rounded-md border border-border bg-surface-layer-2 p-4"
          aria-labelledby="settings-neighbors-embedded-title"
          data-test-id="settings-neighbors-embedded"
        >
          <div className="space-y-1">
            <h3 id="settings-neighbors-embedded-title" className="text-sm font-semibold text-foreground">
              Nearby station discovery
            </h3>
            <p className="text-sm text-muted-foreground">
              Discover nearby observation stations and pin them as public dashboard sources.
            </p>
          </div>
          {panelBody}
        </section>
        {drawer}
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle as="h2">Nearby Stations</CardTitle>
              <CardDescription>
                Compare your readings against an average of nearby public weather stations.
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={isOpen}
              aria-controls={contentId}
              aria-label={isOpen ? 'Collapse Nearby Stations' : 'Expand Nearby Stations'}
              className="mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent"
              data-test-id="settings-neighbors-toggle-panel"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </CardHeader>

        {isOpen && (
          <CardContent id={contentId} className="space-y-4">
            {panelBody}
          </CardContent>
        )}
      </Card>

      {drawer}
    </>
  );
}
