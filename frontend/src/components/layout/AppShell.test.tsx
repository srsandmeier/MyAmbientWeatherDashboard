import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MockAuthProvider } from '../../lib/auth';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { AppShell } from './AppShell';

function renderShell(authenticated = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider>
          <MockAuthProvider authenticated={authenticated}>
            <AppShell />
          </MockAuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  it('renders semantic landmarks', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the skip-nav link', () => {
    renderShell();
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('main element has id for skip-nav target', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('has no accessibility violations when authenticated', async () => {
    const { container } = renderShell(true);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when signed out', async () => {
    const { container } = renderShell(false);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
