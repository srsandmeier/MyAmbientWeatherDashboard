import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockAuthProvider } from '../../lib/auth';
import { CredentialsCard } from './CredentialsCard';
import * as settingsApi from '../../api/settings';
import { queryKeys } from '../../lib/queryKeys';

vi.mock('../../api/settings');

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <MockAuthProvider>
      <QueryClientProvider client={queryClient}>
        <CredentialsCard />
      </QueryClientProvider>
    </MockAuthProvider>,
  );
  return { queryClient, ...view };
}

function renderBareCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MockAuthProvider>
      <QueryClientProvider client={queryClient}>
        <CredentialsCard bare />
      </QueryClientProvider>
    </MockAuthProvider>,
  );
}

describe('CredentialsCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows "Not configured" when no credentials are stored', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: false },
    });

    renderCard();

    const status = await screen.findByTestId('settings-credentials-status');
    expect(status).toHaveTextContent('Not configured');
  });

  it('shows "Saved" when credentials are stored', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });

    renderCard();

    const status = await screen.findByTestId('settings-credentials-status');
    expect(status).toHaveTextContent('Saved');
  });

  it('renders form inputs when not configured', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: false },
    });

    renderCard();

    expect(await screen.findByTestId('settings-credentials-api-key-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-credentials-app-key-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-credentials-save-button')).toBeInTheDocument();
  });

  it('calls saveCredentials with entered values', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: false },
    });
    vi.mocked(settingsApi.saveCredentials).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    await screen.findByTestId('settings-credentials-api-key-input');

    fireEvent.change(screen.getByTestId('settings-credentials-api-key-input'), {
      target: { value: 'my-api-key' },
    });
    fireEvent.change(screen.getByTestId('settings-credentials-app-key-input'), {
      target: { value: 'my-app-key' },
    });
    fireEvent.click(screen.getByTestId('settings-credentials-save-button'));

    await waitFor(() => {
      expect(settingsApi.saveCredentials).toHaveBeenCalledWith(
        { apiKey: 'my-api-key', applicationKey: 'my-app-key' },
        'mock-token',
      );
    });
  });

  it('shows error message when save returns an error', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: false },
    });
    vi.mocked(settingsApi.saveCredentials).mockResolvedValue({
      ok: false,
      status: 400,
      error: 'ambient-credentials-invalid',
    });

    renderCard();

    await screen.findByTestId('settings-credentials-save-button');

    fireEvent.change(screen.getByTestId('settings-credentials-api-key-input'), {
      target: { value: 'bad' },
    });
    fireEvent.change(screen.getByTestId('settings-credentials-app-key-input'), {
      target: { value: 'key' },
    });
    fireEvent.click(screen.getByTestId('settings-credentials-save-button'));

    expect(await screen.findByTestId('settings-credentials-error')).toBeInTheDocument();
  });

  it('shows confirmation panel then calls deleteCredentials when confirmed', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });
    vi.mocked(settingsApi.deleteCredentials).mockResolvedValue({ ok: true, data: undefined });

    renderCard();

    // Click "Remove credentials" to reveal confirmation panel.
    const deleteBtn = await screen.findByTestId('settings-credentials-delete-button');
    fireEvent.click(deleteBtn);

    // Confirmation panel should appear.
    expect(await screen.findByTestId('settings-credentials-confirm-delete')).toBeInTheDocument();

    // Click "Yes, remove" to confirm.
    fireEvent.click(screen.getByTestId('settings-credentials-confirm-delete-button'));

    await waitFor(() => {
      expect(settingsApi.deleteCredentials).toHaveBeenCalledWith('mock-token');
    });
  });

  it('clears credential-dependent cached station data when credentials are removed', async () => {
    let hasCredentials = true;
    vi.mocked(settingsApi.getCredentialStatus).mockImplementation(() => Promise.resolve({
      ok: true,
      data: { hasCredentials },
    }));
    vi.mocked(settingsApi.deleteCredentials).mockImplementation(() => {
      hasCredentials = false;
      return Promise.resolve({ ok: true, data: undefined });
    });

    const { queryClient } = renderCard();
    queryClient.setQueryData(queryKeys.settings.devices(), [{ macAddress: 'STALEDEVICE' }]);
    queryClient.setQueryData(queryKeys.dashboard.current(), { deviceId: 'STALEDEVICE' });
    queryClient.setQueryData(queryKeys.dashboard.rainfall(), { deviceId: 'STALEDEVICE' });
    queryClient.setQueryData(queryKeys.dashboard.extrema(), { deviceId: 'STALEDEVICE' });

    fireEvent.click(await screen.findByTestId('settings-credentials-delete-button'));
    fireEvent.click(screen.getByTestId('settings-credentials-confirm-delete-button'));

    await waitFor(() => {
      expect(settingsApi.deleteCredentials).toHaveBeenCalledWith('mock-token');
      expect(queryClient.getQueryData(queryKeys.settings.credentialsStatus())).toEqual({ hasCredentials: false });
      expect(queryClient.getQueryData(queryKeys.settings.devices())).toEqual([]);
      expect(queryClient.getQueryData(queryKeys.dashboard.current())).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.dashboard.rainfall())).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.dashboard.extrema())).toBeUndefined();
    });
    expect(await screen.findByTestId('settings-credentials-status')).toHaveTextContent('Not configured');
  });

  it('stacks credential actions in bare flyout mode', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });

    renderBareCard();

    expect(await screen.findByTestId('settings-credentials-update-button')).toHaveClass('w-full');
    expect(screen.getByTestId('settings-credentials-delete-button')).toHaveClass('whitespace-normal');
  });

  it('cancel button hides the confirmation panel without deleting', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });

    renderCard();

    const deleteBtn = await screen.findByTestId('settings-credentials-delete-button');
    fireEvent.click(deleteBtn);
    expect(await screen.findByTestId('settings-credentials-confirm-delete')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-credentials-cancel-delete-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('settings-credentials-confirm-delete')).not.toBeInTheDocument();
    });
    expect(settingsApi.deleteCredentials).not.toHaveBeenCalled();
  });

  it('Escape hides the confirmation panel without deleting', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: true },
    });

    renderCard();

    const deleteBtn = await screen.findByTestId('settings-credentials-delete-button');
    fireEvent.click(deleteBtn);
    expect(await screen.findByTestId('settings-credentials-confirm-delete')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('settings-credentials-confirm-delete')).not.toBeInTheDocument();
    });
    expect(settingsApi.deleteCredentials).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    vi.mocked(settingsApi.getCredentialStatus).mockResolvedValue({
      ok: true,
      data: { hasCredentials: false },
    });

    const { container } = renderCard();
    await screen.findByTestId('settings-credentials-save-button');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
