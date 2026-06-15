import type { Theme } from '../providers/ThemeProvider';

const THEME_PREFERENCE_CHANGED_EVENT = 'ambient-theme-preference-changed';

export function dispatchThemePreferenceChanged(theme: Theme): void {
  window.dispatchEvent(new CustomEvent<Theme>(THEME_PREFERENCE_CHANGED_EVENT, { detail: theme }));
}

export function subscribeToThemePreferenceChanges(callback: (theme: Theme) => void): () => void {
  const handler = (event: Event) => {
    callback((event as CustomEvent<Theme>).detail);
  };

  window.addEventListener(THEME_PREFERENCE_CHANGED_EVENT, handler);
  return () => { window.removeEventListener(THEME_PREFERENCE_CHANGED_EVENT, handler); };
}
