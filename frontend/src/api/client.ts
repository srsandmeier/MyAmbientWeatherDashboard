import { appConfig } from '../config/app';

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly error: string };

interface FetchOptions {
  readonly signal?: AbortSignal;
  readonly token?: string;
  readonly method?: string;
  readonly body?: unknown;
}

/** Typed fetch wrapper with bearer-token injection, cancellation, and no secret logging. */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<ApiResult<T>> {
  const { signal, token, method = 'GET', body } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method,
      headers,
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return { ok: false, status: response.status, error: text };
    }

    if (response.status === 204) {
      return { ok: true, data: undefined as T };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'Request aborted' };
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, status: 0, error: message };
  }
}
