import { useSyncExternalStore } from 'react';

/**
 * The theme applied to the document right now: `dark` when `<html>` has the `dark` class.
 *
 * Use it where colours are read from the document, such as canvas charts. `useTheme().resolvedTheme`
 * can lag: ThemeProvider sets the class in an effect that runs after its children render, and a
 * "system" theme follows the OS without re-rendering the provider.
 */
function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => { observer.disconnect(); };
}

function getSnapshot(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useAppliedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}
