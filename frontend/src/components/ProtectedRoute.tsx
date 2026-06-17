import { useEffect, type ReactNode } from 'react';
import { getCurrentRouterPath } from '../lib/deploymentBase';
import { useAuth } from '../lib/auth';
import { Skeleton } from './ui/skeleton';

interface Props {
  readonly children: ReactNode;
}

/** Redirects unauthenticated users to Auth0 login. Shows a skeleton while auth loads. */
export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      login(getCurrentRouterPath());
    }
  }, [isAuthenticated, isLoading, login]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
