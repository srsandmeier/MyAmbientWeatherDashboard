/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

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

/** The stored theme, with its class already on the document before the first render. */
// The `dark` class is applied wherever the theme changes (the first read, setTheme, an OS change) before
// React re-renders, so a child that reads theme colours from the document during render (canvas charts)
// always sees the class that matches `resolvedTheme`. An effect would run after the children rendered.
let currentTheme: Theme = 'system';

function readAndApplyStoredTheme(): Theme {
  currentTheme = readStoredTheme();
  applyTheme(currentTheme);
  return currentTheme;
}

function subscribeToSystemTheme(callback: () => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (currentTheme === 'system') applyTheme('system');
      callback();
    };
    mq.addEventListener('change', handler);
    return () => { mq.removeEventListener('change', handler); };
  } catch {
    // matchMedia unavailable in this environment.
    return () => undefined;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readAndApplyStoredTheme);
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light' as const);
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    currentTheme = theme;
    safeStorage.set('theme', theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    currentTheme = next;
    applyTheme(next);
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
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

function subscribeToDocumentClass(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => { observer.disconnect(); };
}

function getDocumentTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * The applied theme: `resolvedTheme` inside ThemeProvider. A component rendered on its own (an isolated
 * test) has no provider, so it follows the `dark` class on the document instead.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const ctx = useContext(ThemeContext);
  const documentTheme = useSyncExternalStore(
    ctx === null ? subscribeToDocumentClass : subscribeToNothing,
    getDocumentTheme,
    () => 'light' as const,
  );
  return ctx === null ? documentTheme : ctx.resolvedTheme;
}

function subscribeToNothing(): () => void {
  return () => undefined;
}
