import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MockAuthProvider, useAuth } from './auth';

function UserDisplay() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <p>Signed out</p>;
  return <p>Signed in as {user?.email}</p>;
}

describe('MockAuthProvider', () => {
  it('provides authenticated state by default', () => {
    render(
      <MockAuthProvider>
        <UserDisplay />
      </MockAuthProvider>,
    );
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
  });

  it('provides unauthenticated state when authenticated=false', () => {
    render(
      <MockAuthProvider authenticated={false}>
        <UserDisplay />
      </MockAuthProvider>,
    );
    expect(screen.getByText('Signed out')).toBeInTheDocument();
  });

  it('exposes the mock user email', () => {
    render(
      <MockAuthProvider user={{ sub: 'test|1', email: 'sky@example.com' }}>
        <UserDisplay />
      </MockAuthProvider>,
    );
    expect(screen.getByText('Signed in as sky@example.com')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MockAuthProvider>
        <UserDisplay />
      </MockAuthProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('useAuth', () => {
  it('throws when used outside a provider', () => {
    const consoleError = console.error;
    console.error = () => undefined;
    expect(() => render(<UserDisplay />)).toThrow('useAuth must be used within an auth provider');
    console.error = consoleError;
  });
});
