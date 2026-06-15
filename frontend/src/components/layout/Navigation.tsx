import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { NavLink } from 'react-router';
import { getPreferences, updatePreferences } from '../../api/settings';
import { useAuth } from '../../lib/auth';
import type { UserPreferencesDto } from '../../types/settings';
import { queryKeys } from '../../lib/queryKeys';
import { dispatchThemePreferenceChanged } from '../../lib/themePreferenceEvents';
import { dispatchShowDashboardView } from '../../lib/dashboardNavigationEvents';
import { useTheme, type Theme } from '../../providers/ThemeProvider';
import { Button } from '../ui/button';
import { CredentialsCard } from '../settings/CredentialsCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const THEME_OPTIONS: readonly {
  readonly value: Theme;
  readonly label: string;
  readonly Icon: typeof Monitor;
}[] = [
  { value: 'system', label: 'System default', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

const isTheme = (value: string): value is Theme =>
  THEME_OPTIONS.some((option) => option.value === value);

/** Primary navigation bar rendered inside every page via AppShell. */
export function Navigation() {
  const { isAuthenticated, isLoading, user, login, logout, getAccessToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  const openMenu = () => {
    setHasOpenedMenu(true);
    setIsMenuOpen(true);
  };

  const toggleMenu = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    } else {
      openMenu();
    }
  };

  const themeMutation = useMutation({
    mutationFn: async (nextTheme: Theme) => {
      if (!isAuthenticated) {
        return undefined;
      }

      const token = await getAccessToken();

      const current = await queryClient.fetchQuery<UserPreferencesDto>({
        queryKey: queryKeys.settings.preferences(),
        queryFn: async () => {
          const result = await getPreferences(token);
          if (!result.ok) throw new Error(result.error);
          return result.data;
        },
        staleTime: 30_000,
      });

      const updated = await updatePreferences({ ...current, theme: nextTheme }, token);
      return updated.ok ? updated.data : undefined;
    },
    onSuccess: (updatedPreferences) => {
      if (updatedPreferences !== undefined) {
        queryClient.setQueryData(queryKeys.settings.preferences(), updatedPreferences);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.preferences() });
    },
  });

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    dispatchThemePreferenceChanged(nextTheme);
    themeMutation.mutate(nextTheme);
  };

  const CurrentThemeIcon = THEME_OPTIONS.find((option) => option.value === theme)?.Icon ?? Monitor;

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-14 items-center gap-2 border-b border-border bg-background px-4 md:px-6"
    >
      <div className="mr-4 font-semibold tracking-tight text-foreground">
        Ambient Weather
      </div>

      {isAuthenticated && (
        <>
          <NavLink
            to="/"
            end
            onClick={dispatchShowDashboardView}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`
            }
            data-test-id="nav-dashboard-link"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`
            }
            data-test-id="nav-settings-link"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </NavLink>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Theme: ${THEME_LABELS[theme]}`}
              className="h-9 w-9 text-foreground"
              data-test-id="nav-theme-menu-button"
            >
              <CurrentThemeIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-test-id="nav-theme-menu">
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (isTheme(value)) changeTheme(value);
              }}
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  data-test-id={`nav-theme-${value}-item`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {!isAuthenticated && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { login(); }}
            className="gap-1.5"
            data-test-id="nav-login-button"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Login
          </Button>
        )}

        {isAuthenticated && (
          <div ref={menuRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleMenu}
              aria-expanded={isMenuOpen}
              aria-haspopup="dialog"
              aria-label={`Account menu for ${user?.email ?? 'current user'}`}
              className="gap-1.5 text-muted-foreground"
              data-test-id="nav-user-menu-button"
            >
              <span className="hidden sm:inline" aria-hidden="true">{user?.email ?? 'Account'}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </Button>

            {/* Panel is always in the DOM (hidden) so data-test-id targets remain findable. */}
            <div
              className={`absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background shadow-lg ${isMenuOpen ? '' : 'hidden'}`}
              role="dialog"
              aria-label="Account settings"
              aria-modal="false"
              data-test-id="nav-user-menu-panel"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="break-words text-sm font-medium" data-test-id="nav-user-menu-email">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </div>

              <div className="px-4 py-3">
                {hasOpenedMenu && <CredentialsCard bare />}
              </div>

              <div className="border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="w-full justify-start gap-1.5 text-muted-foreground"
                  data-test-id="nav-logout-button"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
