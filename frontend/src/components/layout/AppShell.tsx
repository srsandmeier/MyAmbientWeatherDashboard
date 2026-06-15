import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { telemetry } from '../../telemetry';
import { SkipNav } from '../SkipNav';
import { Navigation } from './Navigation';
import { Skeleton } from '../ui/skeleton';

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6" role="status" aria-label="Loading page">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Top-level layout rendered for all routes. Manages skip-nav, focus on navigation, and lazy page loading. */
export function AppShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.getElementById('main-content');
    main?.focus({ preventScroll: true });
    telemetry.trackPageView(document.title || pathname, pathname);
  }, [pathname]);

  return (
    <>
      <SkipNav />
      <div className="flex min-h-screen flex-col bg-background">
        <header>
          <Navigation />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 outline-none"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Ambient Weather Dashboard
        </footer>
      </div>
    </>
  );
}
