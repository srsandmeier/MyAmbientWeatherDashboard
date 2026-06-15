import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDevices } from '../api/settings';
import { createWrapper } from '../test/testUtils';
import { useSettingsDevices } from './useSettingsDevices';

const mockGetAccessToken = vi.fn().mockResolvedValue('test-token');

vi.mock('../api/settings');
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: mockGetAccessToken,
  }),
}));

describe('useSettingsDevices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  it('returns an empty device list when Ambient credentials are missing', async () => {
    vi.mocked(getDevices).mockResolvedValue({
      ok: false,
      status: 428,
      error: 'ambient-credentials-required',
    });

    const { result } = renderHook(() => useSettingsDevices(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(getDevices).toHaveBeenCalledWith('test-token');
  });
});
