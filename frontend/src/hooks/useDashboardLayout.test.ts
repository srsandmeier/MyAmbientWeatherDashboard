import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboardLayout } from './useDashboardLayout';
import type { DashboardLayoutDto, DashboardTileDto } from '../types/dashboard';
import { createWrapper } from '../test/testUtils';

const mockGetAccessToken = vi.fn().mockResolvedValue('test-token');

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: mockGetAccessToken,
  }),
}));

const mockFetch = vi.fn();

const STATUS_TILE: DashboardTileDto = { i: 'status', x: 0, y: 0, w: 2, h: 3, type: 'status' };

const SAMPLE_LAYOUT: DashboardLayoutDto = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  name: 'Default',
  layoutMode: 'default',
  tiles: [STATUS_TILE],
  customItems: [],
  updatedAtUtc: '2026-06-01T00:00:00Z',
};

function makeOkResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('useDashboardLayout', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return layout data on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_LAYOUT));

    const { result } = renderHook(() => useDashboardLayout(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.id).toBe(SAMPLE_LAYOUT.id);
      expect(result.current.data?.tiles).toHaveLength(1);
    });
  });

  it('should set isError on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ error: 'server-error' }, 500));

    const { result } = renderHook(() => useDashboardLayout(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.data).toBeUndefined();
  });

  it('should request with bearer token', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_LAYOUT));

    const { result } = renderHook(() => useDashboardLayout(), { wrapper: createWrapper() });
    await waitFor(() => !result.current.isPending);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/layout'),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });
});
