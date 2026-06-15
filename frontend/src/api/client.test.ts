import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  it('returns ok result for 200 responses', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { status: 'healthy' }));
    const result = await apiFetch<{ status: string }>('/api/health');
    assert(result.ok);
    expect(result.data.status).toBe('healthy');
  });

  it('injects Authorization header when token is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/api/health', { token: 'my-jwt' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer my-jwt');
  });

  it('does NOT send Authorization header when no token is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/api/health');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('returns error result for non-ok responses', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    const result = await apiFetch('/api/missing');
    assert(!result.ok);
    expect(result.status).toBe(404);
  });

  it('returns error result when request is aborted', async () => {
    const controller = new AbortController();
    mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    const result = await apiFetch('/api/health', { signal: controller.signal });
    assert(!result.ok);
    expect(result.error).toBe('Request aborted');
  });
});
