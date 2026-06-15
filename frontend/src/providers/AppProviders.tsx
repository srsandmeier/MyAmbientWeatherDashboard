import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { AppAuthProvider } from '../auth/AppAuthProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { router } from '../router';
import { ThemeProvider } from './ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Composes all app-wide providers in a single tree. */
export function AppProviders() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppAuthProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AppAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
