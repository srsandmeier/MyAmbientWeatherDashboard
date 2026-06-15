import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockAuthProvider } from '../../lib/auth';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { PreferencesCard } from './PreferencesCard';
import * as settingsApi from '../../api/settings';
import { dispatchThemePreferenceChanged } from '../../lib/themePreferenceEvents';

vi.mock('../../api/settings');

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <MockAuthProvider>
        <QueryClientProvider client={queryClient}>
          <PreferencesCard />
        </QueryClientProvider>
      </MockAuthProvider>
    </ThemeProvider>,
  );
}

const defaultPrefs = {
  temperatureUnit: 'F' as const,
  speedUnit: 'mph' as const,
  pressureUnit: 'inhg' as const,
  rainfallUnit: 'in' as const,
  distanceUnit: 'mi' as const,
  theme: 'system' as const,
  dateFormat: 'mdy' as const,
  temperatureDecimals: 1 as const,
  dailyExtremaTimezone: 'utc' as const,
};

describe('PreferencesCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all preference selects', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({ ok: true, data: defaultPrefs });

    renderCard();

    expect(await screen.findByTestId('settings-preferences-temperature-select')).toBeInTheDocument();
    expect(screen.getByTestId('settings-preferences-speed-select')).toBeInTheDocument();
    expect(screen.getByTestId('settings-preferences-pressure-select')).toBeInTheDocument();
    expect(screen.getByTestId('settings-preferences-rainfall-select')).toBeInTheDocument();
    expect(screen.getByTestId('settings-preferences-theme-select')).toBeInTheDocument();
    expect(screen.getByTestId('settings-preferences-date-format-select')).toBeInTheDocument();
  });

  it('reserves form space while preferences load', () => {
    vi.mocked(settingsApi.getPreferences).mockReturnValue(new Promise(() => undefined));

    renderCard();

    expect(screen.getByTestId('settings-preferences-loading')).toBeInTheDocument();
    expect(screen.getByText('Date format')).toBeInTheDocument();
  });

  it('shows defaults and the API error when preferences fail to load', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({
      ok: false,
      status: 500,
      error: JSON.stringify({ Message: 'Database migration is missing.' }),
    });

    renderCard();

    expect(await screen.findByTestId('settings-preferences-load-error')).toHaveTextContent(
      'Database migration is missing.',
    );
    const themeSelect = screen.getByTestId<HTMLSelectElement>('settings-preferences-theme-select');
    expect(themeSelect.value).toBe('system');
    expect(screen.getByTestId('settings-preferences-save-button')).toBeDisabled();
  });

  it('populates selects with values from the API', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({
      ok: true,
      data: { ...defaultPrefs, temperatureUnit: 'C', theme: 'dark', dateFormat: 'iso' },
    });

    renderCard();

    const tempSelect = await screen.findByTestId<HTMLSelectElement>('settings-preferences-temperature-select');
    const themeSelect = screen.getByTestId<HTMLSelectElement>('settings-preferences-theme-select');
    const dateFormatSelect = screen.getByTestId<HTMLSelectElement>('settings-preferences-date-format-select');
    expect(tempSelect.value).toBe('C');
    expect(themeSelect.value).toBe('dark');
    expect(dateFormatSelect.value).toBe('iso');
  });

  it('updates the theme select when the header quick buttons change theme', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({ ok: true, data: defaultPrefs });

    renderCard();

    const themeSelect = await screen.findByTestId<HTMLSelectElement>('settings-preferences-theme-select');
    act(() => {
      dispatchThemePreferenceChanged('dark');
    });

    await waitFor(() => {
      expect(themeSelect.value).toBe('dark');
    });
  });

  it('calls updatePreferences with changed values on save', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({ ok: true, data: defaultPrefs });
    vi.mocked(settingsApi.updatePreferences).mockResolvedValue({ ok: true, data: defaultPrefs });

    renderCard();

    await screen.findByTestId('settings-preferences-temperature-select');

    fireEvent.change(screen.getByTestId('settings-preferences-temperature-select'), {
      target: { value: 'C' },
    });
    fireEvent.change(screen.getByTestId('settings-preferences-date-format-select'), {
      target: { value: 'dmy' },
    });
    fireEvent.click(screen.getByTestId('settings-preferences-save-button'));

    await waitFor(() => {
      expect(settingsApi.updatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ temperatureUnit: 'C', dateFormat: 'dmy' }),
        'mock-token',
      );
    });
  });

  it('shows the API error when saving preferences fails', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({ ok: true, data: defaultPrefs });
    vi.mocked(settingsApi.updatePreferences).mockResolvedValue({
      ok: false,
      status: 400,
      error: JSON.stringify({ message: 'DateFormat must be valid.' }),
    });

    renderCard();

    await screen.findByTestId('settings-preferences-save-button');
    fireEvent.click(screen.getByTestId('settings-preferences-save-button'));

    expect(await screen.findByTestId('settings-preferences-save-error')).toHaveTextContent(
      'DateFormat must be valid.',
    );
  });

  it('has no accessibility violations', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({ ok: true, data: defaultPrefs });

    const { container } = renderCard();
    await screen.findByTestId('settings-preferences-save-button');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
