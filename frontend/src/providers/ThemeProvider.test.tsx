import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <>
      <span data-test-id="theme-value">{theme}</span>
      <span data-test-id="resolved-theme-value">{resolvedTheme}</span>
    </>
  );
}

function renderThemeProbe() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
      },
    });
    document.documentElement.className = '';
  });

  it('falls back to system when local storage contains an invalid theme', () => {
    storage.set('theme', 'solarized');

    renderThemeProbe();

    expect(screen.getByTestId('theme-value')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved-theme-value')).toHaveTextContent('light');
  });

  it('uses a valid stored theme', () => {
    storage.set('theme', 'dark');

    renderThemeProbe();

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved-theme-value')).toHaveTextContent('dark');
  });
});
