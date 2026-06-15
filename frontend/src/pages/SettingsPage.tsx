import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PreferencesCard } from '../components/settings/PreferencesCard';
import { DevicesCard } from '../components/settings/DevicesCard';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import { getCredentialStatus } from '../api/settings';

export function SettingsPage() {
  const { getAccessToken } = useAuth();
  const [openCard, setOpenCard] = useState<'preferences' | 'devices' | null>('devices');

  const { data: credentialStatus, isLoading: isCredentialStatusLoading } = useQuery({
    queryKey: queryKeys.settings.credentialsStatus(),
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getCredentialStatus(token);
      if (!result.ok) return { hasCredentials: false };
      return result.data;
    },
  });

  return (
    <div className="p-6" data-test-id="settings-page">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <div className="max-w-4xl space-y-4">
        <PreferencesCard
          isOpen={openCard === 'preferences'}
          onToggle={() => { setOpenCard((c) => (c === 'preferences' ? null : 'preferences')); }}
        />
        <DevicesCard
          hasCredentials={credentialStatus?.hasCredentials ?? false}
          isCredentialStatusLoading={isCredentialStatusLoading}
          isOpen={openCard === 'devices'}
          onToggle={() => { setOpenCard((c) => (c === 'devices' ? null : 'devices')); }}
        />
      </div>
    </div>
  );
}

export default SettingsPage;
