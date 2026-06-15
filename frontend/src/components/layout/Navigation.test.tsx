import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAuthProvider } from '../../lib/auth';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { Navigation } from './Navigation';
import * as settingsApi from '../../api/settings';
import { addShowDashboardViewListener } from '../../lib/dashboardNavigationEvents';

vi.mock('../../api/settings');

function renderNav(authenticated = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <ThemeProvider>
        <MockAuthProvider authenticated={authenticated} user={{ sub: 'test|1', email: 'sky@example.com' }}>
          <QueryClientProvider client={queryClient}>
            <Navigation />
          </QueryClientProvider>
        </MockAuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('Navigation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows dashboard and settings links when authenticated', () => {
    renderNav(true);
    expect(screen.getByTestId('nav-dashboard-link')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings-link')).toBeInTheDocument();
  });

  it('requests the normal dashboard view when dashboard tab is clicked', () => {
    const listener = vi.fn();
    const removeListener = addShowDashboardViewListener(listener);

    renderNav(true);

    fireEvent.click(screen.getByTestId('nav-dashboard-link'));

    expect(listener).toHaveBeenCalledOnce();
    removeListener();
  });

  it('shows user menu button with email and logout in panel when authenticated', () => {
    renderNav(true);
    // Email appears on both the trigger button and inside the panel header.
    expect(screen.getAllByText('sky@example.com').length).toBeGreaterThan(0);
    // Logout button lives inside the flyout (hidden by default but always in DOM).
    expect(screen.getByTestId('nav-logout-button')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user-menu-button')).toBeInTheDocument();
  });

  it('opens a non-scrollable WCAG-safe account flyout', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });

    const { container } = renderNav(true);

    fireEvent.click(screen.getByTestId('nav-user-menu-button'));

    const panel = await screen.findByTestId('nav-user-menu-panel');
    expect(panel).not.toHaveClass('overflow-y-auto');
    expect(panel).not.toHaveClass('overflow-x-auto');
    expect(await screen.findByTestId('settings-credentials-update-button')).toHaveClass('w-full');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('hides nav links and logout when signed out', () => {
    renderNav(false);
    expect(screen.queryByTestId('nav-dashboard-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-logout-button')).not.toBeInTheDocument();
  });

  it('shows theme menu choices from a single current-mode button', async () => {
    renderNav(true);
    expect(screen.getByTestId('nav-theme-menu-button')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('nav-theme-menu-button'), {
      key: 'Enter',
      code: 'Enter',
    });

    expect(await screen.findByTestId('nav-theme-system-item')).toBeInTheDocument();
    expect(screen.getByTestId('nav-theme-light-item')).toBeInTheDocument();
    expect(screen.getByTestId('nav-theme-dark-item')).toBeInTheDocument();
  });

  it('persists theme changes through preferences when authenticated', async () => {
    vi.mocked(settingsApi.getPreferences).mockResolvedValue({
      ok: true,
      data: {
        temperatureUnit: 'F',
        speedUnit: 'mph',
        pressureUnit: 'inhg',
        rainfallUnit: 'in',
        distanceUnit: 'mi',
        theme: 'system',
        dateFormat: 'mdy',
        temperatureDecimals: 1,
        dailyExtremaTimezone: 'utc' as const,
      },
    });
    vi.mocked(settingsApi.updatePreferences).mockResolvedValue({
      ok: true,
      data: {
        temperatureUnit: 'F',
        speedUnit: 'mph',
        pressureUnit: 'inhg',
        rainfallUnit: 'in',
        distanceUnit: 'mi',
        theme: 'dark',
        dateFormat: 'mdy',
        temperatureDecimals: 1,
        dailyExtremaTimezone: 'utc' as const,
      },
    });

    renderNav(true);

    fireEvent.keyDown(screen.getByTestId('nav-theme-menu-button'), {
      key: 'Enter',
      code: 'Enter',
    });
    fireEvent.click(await screen.findByTestId('nav-theme-dark-item'));

    await waitFor(() => {
      expect(settingsApi.updatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark', dateFormat: 'mdy' }),
        'mock-token',
      );
    });
  });

  it('has no accessibility violations when authenticated', async () => {
    const { container } = renderNav(true);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when signed out', async () => {
    const { container } = renderNav(false);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
