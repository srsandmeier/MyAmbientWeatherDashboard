import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../lib/auth';
import { queryKeys } from '../../lib/queryKeys';
import { subscribeToThemePreferenceChanges } from '../../lib/themePreferenceEvents';
import { getPreferences, updatePreferences } from '../../api/settings';
import { DEFAULT_USER_PREFERENCES } from '../../lib/defaultPreferences';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useTheme } from '../../providers/ThemeProvider';
import type { UserPreferencesDto } from '../../types/settings';

const TEMPERATURE_OPTIONS = [
  { value: 'F', label: '°F (Fahrenheit)' },
  { value: 'C', label: '°C (Celsius)' },
] as const;

const SPEED_OPTIONS = [
  { value: 'mph', label: 'mph' },
  { value: 'kmh', label: 'km/h' },
  { value: 'ms', label: 'm/s' },
] as const;

const PRESSURE_OPTIONS = [
  { value: 'inhg', label: 'inHg' },
  { value: 'hpa', label: 'hPa' },
  { value: 'mbar', label: 'mbar' },
] as const;

const RAINFALL_OPTIONS = [
  { value: 'in', label: 'inches' },
  { value: 'mm', label: 'mm' },
] as const;

const DISTANCE_OPTIONS = [
  { value: 'mi', label: 'Miles' },
  { value: 'km', label: 'Kilometers' },
] as const;

const THEME_OPTIONS = [
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const DATE_FORMAT_OPTIONS = [
  { value: 'mdy', label: 'MM/DD/YYYY' },
  { value: 'dmy', label: 'DD/MM/YYYY' },
  { value: 'iso', label: 'YYYY-MM-DD' },
] as const;

const TEMPERATURE_DECIMALS_OPTIONS = [
  { value: '0', label: 'Rounded (e.g. 72°)' },
  { value: '1', label: '1 decimal (e.g. 72.1°)' },
  { value: '2', label: '2 decimals (e.g. 72.14°)' },
] as const;


const TIMEZONE_OPTIONS = [
  { value: 'local', label: 'Station local time' },
  { value: 'utc', label: 'UTC' },
] as const;

const PREFERENCE_SKELETON_LABELS = [
  'Temperature',
  'Temperature decimal places',
  'Wind speed',
  'Pressure',
  'Rainfall',
  'Distance',
  'Theme',
  'Date format',
  'Daily high/low calendar day',
] as const;

const SELECT_CLASS_NAME = 'flex h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pl-3 pr-10 text-sm shadow-sm';

interface PreferenceSelectProps {
  readonly id: string;
  readonly testId: string;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function PreferenceSelect({ id, testId, value, options, onChange }: PreferenceSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        className={SELECT_CLASS_NAME}
        value={value}
        onChange={onChange}
        data-test-id={testId}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

function PreferencesLoadingSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading display preferences"
      data-test-id="settings-preferences-loading"
    >
      {PREFERENCE_SKELETON_LABELS.map((label) => (
        <div key={label} className="space-y-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-36" />
    </div>
  );
}


export function PreferencesCard({
  isOpen: isOpenProp,
  onToggle,
}: {
  readonly isOpen?: boolean;
  readonly onToggle?: () => void;
} = {}) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();

  const {
    data: prefs,
    error: loadError,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.settings.preferences(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getPreferences(token);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Track only unsaved changes as a delta on top of the fetched prefs.
  const [isOpenInternal, setIsOpenInternal] = useState(true);
  const isOpen = isOpenProp ?? isOpenInternal;
  const handleToggle = onToggle ?? (() => { setIsOpenInternal((v) => !v); });
  const contentId = useId();
  const [changes, setChanges] = useState<Partial<UserPreferencesDto>>({});
  const [savedMessage, setSavedMessage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form: UserPreferencesDto = { ...(prefs ?? DEFAULT_USER_PREFERENCES), ...changes };

  useEffect(() => {
    return subscribeToThemePreferenceChanges((theme) => {
      setChanges((prev) => ({ ...prev, theme }));
    });
  }, []);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return updatePreferences(form, token);
    },
    onSuccess: (result) => {
      if (result.ok) {
        setChanges({});
        setSaveError(null);
        // Apply theme immediately to the live ThemeProvider so the UI updates without a reload.
        setTheme(form.theme);
        queryClient.setQueryData(queryKeys.settings.preferences(), result.data);
        setSavedMessage(true);
        setTimeout(() => { setSavedMessage(false); }, 3000);
      } else {
        setSaveError(getApiErrorMessage(result.error));
      }
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'An unexpected error occurred.');
    },
  });

  const set = (key: keyof UserPreferencesDto) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSaveError(null);
    setChanges((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const setDecimals = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSaveError(null);
    const parsed = parseInt(e.target.value, 10);
    if (parsed === 0 || parsed === 1 || parsed === 2) {
      setChanges((prev) => ({ ...prev, temperatureDecimals: parsed }));
    }
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle as="h2">Preferences</CardTitle>
            <CardDescription>Units and display theme.</CardDescription>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls={contentId}
            aria-label={isOpen ? 'Collapse Preferences' : 'Expand Preferences'}
            className="mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent"
            data-test-id="settings-preferences-toggle"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </CardHeader>
      {isOpen && <CardContent id={contentId} className="space-y-4">
        {isLoading ? (
          <PreferencesLoadingSkeleton />
        ) : (
          <>
            {isError && (
              <div className="space-y-2">
                <p
                  className="text-sm text-destructive"
                  role="status"
                  data-test-id="settings-preferences-load-error"
                >
                  Using default preferences because saved preferences could not load:
                  {' '}
                  {loadError instanceof Error
                    ? getApiErrorMessage(loadError.message)
                    : 'An unexpected error occurred.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                  data-test-id="settings-preferences-retry-button"
                >
                  Try again
                </Button>
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className="space-y-3"
              aria-label="Display preferences form"
            >
            <div className="space-y-1">
              <Label htmlFor="pref-temperature">Temperature</Label>
              <PreferenceSelect
                id="pref-temperature"
                value={form.temperatureUnit}
                onChange={set('temperatureUnit')}
                options={TEMPERATURE_OPTIONS}
                testId="settings-preferences-temperature-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-temperature-decimals">Temperature decimal places</Label>
              <PreferenceSelect
                id="pref-temperature-decimals"
                value={String(form.temperatureDecimals)}
                onChange={setDecimals}
                options={TEMPERATURE_DECIMALS_OPTIONS}
                testId="settings-preferences-temperature-decimals-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-speed">Wind speed</Label>
              <PreferenceSelect
                id="pref-speed"
                value={form.speedUnit}
                onChange={set('speedUnit')}
                options={SPEED_OPTIONS}
                testId="settings-preferences-speed-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-pressure">Pressure</Label>
              <PreferenceSelect
                id="pref-pressure"
                value={form.pressureUnit}
                onChange={set('pressureUnit')}
                options={PRESSURE_OPTIONS}
                testId="settings-preferences-pressure-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-rainfall">Rainfall</Label>
              <PreferenceSelect
                id="pref-rainfall"
                value={form.rainfallUnit}
                onChange={set('rainfallUnit')}
                options={RAINFALL_OPTIONS}
                testId="settings-preferences-rainfall-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-distance">Distance</Label>
              <PreferenceSelect
                id="pref-distance"
                value={form.distanceUnit}
                onChange={set('distanceUnit')}
                options={DISTANCE_OPTIONS}
                testId="settings-preferences-distance-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-theme">Theme</Label>
              <PreferenceSelect
                id="pref-theme"
                value={form.theme}
                onChange={set('theme')}
                options={THEME_OPTIONS}
                testId="settings-preferences-theme-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-date-format">Date format</Label>
              <PreferenceSelect
                id="pref-date-format"
                value={form.dateFormat}
                onChange={set('dateFormat')}
                options={DATE_FORMAT_OPTIONS}
                testId="settings-preferences-date-format-select"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pref-timezone">Daily high/low calendar day</Label>
              <PreferenceSelect
                id="pref-timezone"
                value={form.dailyExtremaTimezone}
                onChange={set('dailyExtremaTimezone')}
                options={TIMEZONE_OPTIONS}
                testId="settings-preferences-timezone-select"
              />
              <p className="text-xs text-muted-foreground">
                Controls when &ldquo;today&rdquo; resets for daily high/low.
                Station local uses each station&apos;s own timezone; falls back to UTC when unknown.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={updateMutation.isPending || isError}
                data-test-id="settings-preferences-save-button"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save preferences'}
              </Button>
              {savedMessage && (
                <span
                  className="text-sm text-green-800 dark:text-green-300"
                  role="status"
                  aria-live="polite"
                  data-test-id="settings-preferences-saved-message"
                >
                  Saved.
                </span>
              )}
              {saveError && (
                <span className="text-sm text-destructive" role="alert" aria-live="assertive" data-test-id="settings-preferences-save-error">
                  Failed to save preferences: {saveError}
                </span>
              )}
            </div>
          </form>
          </>
        )}
      </CardContent>}
    </Card>
  );
}
