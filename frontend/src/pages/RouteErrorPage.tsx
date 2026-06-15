import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '../components/ui/button';

/** Displayed by React Router when a route throws during render or navigation. */
export function RouteErrorPage() {
  const error = useRouteError();

  const heading = isRouteErrorResponse(error) ? String(error.status) : 'Error';
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'Something went wrong with this route.'
    : 'An unexpected error occurred. Please try again.';

  return (
    // AppShell owns <main id="main-content"> — use div here to avoid duplicate id and nested landmarks.
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center"
      data-test-id="route-error-page"
    >
      <h1 className="text-4xl font-bold">{heading}</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild data-test-id="route-error-home-button">
        <Link to="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
