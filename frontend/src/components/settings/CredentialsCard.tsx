import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert } from '../ui/alert';
import { useAuth } from '../../lib/auth';
import { clearCredentialDependentQueries } from '../../lib/credentialDependentQueries';
import { queryKeys } from '../../lib/queryKeys';
import {
  deleteCredentials,
  getCredentialStatus,
  saveCredentials,
} from '../../api/settings';

interface CredentialsCardProps {
  /** When true renders without the Card shell — for embedding in the nav flyout. */
  readonly bare?: boolean;
}

export function CredentialsCard({ bare = false }: CredentialsCardProps) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState('');
  const [appKey, setAppKey] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmDelete(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [confirmDelete]);

  const { data: status, isLoading } = useQuery({
    queryKey: queryKeys.settings.credentialsStatus(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getCredentialStatus(token);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return saveCredentials({ apiKey, applicationKey: appKey }, token);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setError('Credentials could not be validated. Check your API key and application key.');
        return;
      }
      setApiKey('');
      setAppKey('');
      setShowForm(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.credentialsStatus() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.devices() });
    },
    onError: () => {
      setError('An unexpected error occurred. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return deleteCredentials(token);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setError('Credentials could not be removed. Please try again.');
        return;
      }

      setShowForm(false);
      setConfirmDelete(false);
      setError(null);
      clearCredentialDependentQueries(queryClient);
    },
  });

  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    saveMutation.mutate();
  };

  const hasCredentials = status?.hasCredentials ?? false;
  const actionLayoutClass = bare ? 'grid gap-2' : 'flex flex-wrap gap-2';
  const bareActionButtonClass = bare ? 'w-full whitespace-normal' : undefined;

  const content = isLoading ? (
    <p className="text-sm text-muted-foreground">Loading…</p>
  ) : (
          <>
            <p
              className="text-sm font-medium"
              data-test-id="settings-credentials-status"
              aria-live="polite"
            >
              Status:{' '}
              <span className={hasCredentials ? 'text-green-800 dark:text-green-300' : 'text-muted-foreground'}>
                {hasCredentials ? 'Saved' : 'Not configured'}
              </span>
            </p>

            {(!hasCredentials || showForm) && (
              <form onSubmit={handleSave} className="space-y-3" aria-label="Ambient credentials form">
                <div className="space-y-1">
                  <Label htmlFor="settings-api-key">API Key</Label>
                  <Input
                    id="settings-api-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); }}
                    required
                    aria-required="true"
                    data-test-id="settings-credentials-api-key-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-app-key">Application Key</Label>
                  <Input
                    id="settings-app-key"
                    type="password"
                    autoComplete="off"
                    value={appKey}
                    onChange={(e) => { setAppKey(e.target.value); }}
                    required
                    aria-required="true"
                    data-test-id="settings-credentials-app-key-input"
                  />
                </div>

                {error && (
                  <Alert variant="destructive" role="alert" data-test-id="settings-credentials-error">
                    {error}
                  </Alert>
                )}

                <div className={actionLayoutClass}>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className={bareActionButtonClass}
                    data-test-id="settings-credentials-save-button"
                  >
                    {saveMutation.isPending ? 'Saving…' : 'Save credentials'}
                  </Button>
                  {hasCredentials && (
                    <Button
                      type="button"
                      variant="outline"
                      className={bareActionButtonClass}
                      onClick={() => { setShowForm(false); setError(null); }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}

            {hasCredentials && !showForm && (
              <div className="flex flex-col gap-3">
                <div className={actionLayoutClass}>
                  <Button
                    variant="outline"
                    className={bareActionButtonClass}
                    onClick={() => { setShowForm(true); }}
                    data-test-id="settings-credentials-update-button"
                  >
                    Re-enter credentials
                  </Button>
                  <Button
                    variant="destructive"
                    className={bareActionButtonClass}
                    onClick={() => { setConfirmDelete(true); }}
                    disabled={deleteMutation.isPending}
                    data-test-id="settings-credentials-delete-button"
                  >
                    Remove credentials
                  </Button>
                </div>
                {confirmDelete && (
                  <div
                    className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2"
                    role="alertdialog"
                    aria-labelledby="confirm-delete-heading"
                    data-test-id="settings-credentials-confirm-delete"
                  >
                    <p id="confirm-delete-heading" className="text-sm font-medium">
                      Remove saved credentials?
                    </p>
                    <p className="text-sm text-foreground">
                      Your API key and application key will be deleted from the server. You will need to re-enter them to use the dashboard.
                    </p>
                    <div className={actionLayoutClass}>
                      <Button
                        size="sm"
                        variant="destructive"
                        className={bareActionButtonClass}
                        onClick={() => { setConfirmDelete(false); deleteMutation.mutate(); }}
                        disabled={deleteMutation.isPending}
                        data-test-id="settings-credentials-confirm-delete-button"
                      >
                        {deleteMutation.isPending ? 'Removing…' : 'Yes, remove'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={bareActionButtonClass}
                        onClick={() => { setConfirmDelete(false); }}
                        data-test-id="settings-credentials-cancel-delete-button"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
  );

  if (bare) {
    return (
      <div className="space-y-3" data-test-id="settings-credentials-bare">
        <p className="text-sm font-semibold">Ambient Weather Credentials</p>
        <p className="text-xs text-muted-foreground">API key and application key — stored encrypted on the server.</p>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Ambient Weather Credentials</CardTitle>
        <CardDescription>
          API key and application key — validated and stored encrypted on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {content}
      </CardContent>
    </Card>
  );
}
