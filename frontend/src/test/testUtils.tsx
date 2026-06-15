import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

/**
 * Returns a React wrapper component that provides a fresh QueryClient for each test.
 * Use with renderHook: `renderHook(() => useMyHook(), { wrapper: createWrapper() })`.
 */
export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
