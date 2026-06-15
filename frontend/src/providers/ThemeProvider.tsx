/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  readonly theme: Theme;
  /** The actual applied theme — never 'system'. */
  readonly resolvedTheme: 'light' | 'dark';
  readonly setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Storage helper ───────────────────────────────────────────────────────────

/** Safe localStorage wrapper — falls back gracefully when storage is unavailable. */
const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage not available — continue without persistence.
    }
  },
};

// ─── Theme helpers ────────────────────────────────────────────────────────────

function getSystemTheme(): 'light' | 'dark' {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolve(theme) === 'dark');
}

function readStoredTheme(): Theme {
  const stored = safeStorage.get('theme');
  return isTheme(stored) ? stored : 'system';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    safeStorage.set('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;

    // Capture cleanup outside try/catch so it is always returned regardless of
    // which branch executes — avoids leaking a registered listener on exception.
    let cleanup: (() => void) | undefined;
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => { applyTheme('system'); };
      mq.addEventListener('change', handler);
      cleanup = () => { mq.removeEventListener('change', handler); };
    } catch {
      // matchMedia unavailable in this environment.
    }
    return cleanup;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => { setThemeState(next); }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: resolve(theme), setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
