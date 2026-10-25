import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useResolvedTheme, useTheme } from './ThemeProvider';

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

  it('applies the dark class before children render, on the first render and after setTheme', () => {
    storage.set('theme', 'dark');
    const classSeenInRender: string[] = [];
    function ClassProbe() {
      const { resolvedTheme, setTheme } = useTheme();
      classSeenInRender.push(`${resolvedTheme}:${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}`);
      return <button type="button" data-test-id="theme-light" onClick={() => { setTheme('light'); }}>light</button>;
    }
    render(<ThemeProvider><ClassProbe /></ThemeProvider>);
    expect(classSeenInRender.at(-1)).toBe('dark:dark');

    fireEvent.click(screen.getByTestId('theme-light'));

    expect(classSeenInRender.at(-1)).toBe('light:light');
    expect(classSeenInRender.every((seen) => seen === 'dark:dark' || seen === 'light:light')).toBe(true);
  });

  it('follows an OS theme change under the system theme, updating resolvedTheme and the class together', () => {
    let prefersDark = false;
    const listeners = new Set<() => void>();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() { return query === '(prefers-color-scheme: dark)' && prefersDark; },
        media: query,
        addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
        removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); },
      })),
    });

    renderThemeProbe();
    expect(screen.getByTestId('resolved-theme-value')).toHaveTextContent('light');

    act(() => {
      prefersDark = true;
      for (const listener of listeners) listener();
    });

    expect(screen.getByTestId('resolved-theme-value')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});

describe('useResolvedTheme', () => {
  function ResolvedProbe() {
    return <span data-test-id="resolved">{useResolvedTheme()}</span>;
  }

  beforeEach(() => {
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('follows the document class when there is no ThemeProvider', async () => {
    render(<ResolvedProbe />);
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');

    act(() => { document.documentElement.classList.add('dark'); });

    await waitFor(() => { expect(screen.getByTestId('resolved')).toHaveTextContent('dark'); });
  });
});
