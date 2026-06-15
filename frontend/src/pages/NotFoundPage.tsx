import { Link } from 'react-router';
import { Button } from '../components/ui/button';

/** 404 not-found page. */
export function NotFoundPage() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center"
      data-test-id="not-found-page"
    >
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild data-test-id="not-found-home-button">
        <Link to="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
