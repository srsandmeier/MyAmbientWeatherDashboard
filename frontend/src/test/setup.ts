import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';

// Override the default data-testid to data-test-id — the project convention (see CLAUDE.md
// "Every interactive element … must carry a data-test-id attribute").
// This makes screen.getByTestId() look for data-test-id rather than data-testid.
configure({ testIdAttribute: 'data-test-id' });

expect.extend(toHaveNoViolations);

// Node exposes an experimental global localStorage accessor in recent versions.
// Tests should use jsdom's browser storage instead, and this avoids warning noise
// when code reads globalThis.localStorage indirectly.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: window.localStorage,
});

// jsdom does not implement window.matchMedia — stub it for all tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
