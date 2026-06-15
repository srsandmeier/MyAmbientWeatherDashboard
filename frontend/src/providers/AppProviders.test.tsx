import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/app', () => ({
  getAuthConfig: () => ({ domain: 'test.example.auth0.test', clientId: 'test-client-id', audience: 'https://test.example.api' }),
  appConfig: { apiBaseUrl: '' },
}));

vi.mock('../router', () => ({
  router: {
    navigate: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    state: { location: { pathname: '/', search: '', hash: '', state: null, key: 'default' }, matches: [], initialized: true, loaderData: {}, errors: null, historyAction: 'POP' },
    getBlocker: vi.fn(),
  },
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth0: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: undefined,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn(),
  }),
}));

vi.mock('react-router', () => ({
  RouterProvider: () => <div data-test-id="router-outlet">Router rendered</div>,
}));

import { AppProviders } from './AppProviders';

describe('AppProviders', () => {
  it('renders without crashing', () => {
    render(<AppProviders />);
    expect(screen.getByTestId('router-outlet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AppProviders />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
