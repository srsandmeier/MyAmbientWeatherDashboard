import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockAuthProvider } from '../lib/auth';
import { ProtectedRoute } from './ProtectedRoute';

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('renders children when authenticated', () => {
    render(
      <MockAuthProvider authenticated={true}>
        <ProtectedRoute>
          <p>Protected content</p>
        </ProtectedRoute>
      </MockAuthProvider>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders loading skeleton when auth is loading', () => {
    render(
      <MockAuthProvider authenticated={false} loading={true}>
        <ProtectedRoute>
          <p>Protected content</p>
        </ProtectedRoute>
      </MockAuthProvider>,
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders nothing and triggers login when not authenticated and not loading', () => {
    const login = vi.fn();

    render(
      <MockAuthProvider authenticated={false} loading={false} onLogin={login}>
        <ProtectedRoute>
          <p>Protected content</p>
        </ProtectedRoute>
      </MockAuthProvider>,
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('/');
  });

  it('strips the GitHub Pages base path from the Auth0 returnTo value', () => {
    vi.stubEnv('BASE_URL', '/MyAmbientWeatherDashboard/');
    window.history.replaceState(null, '', '/MyAmbientWeatherDashboard/settings?tab=stations');
    const login = vi.fn();

    render(
      <MockAuthProvider authenticated={false} loading={false} onLogin={login}>
        <ProtectedRoute>
          <p>Protected content</p>
        </ProtectedRoute>
      </MockAuthProvider>,
    );

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('/settings?tab=stations');
  });
});
