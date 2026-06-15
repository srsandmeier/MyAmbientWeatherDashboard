/** Rendered briefly during the Auth0 code-exchange redirect. Auth0Provider handles the exchange; this shows a spinner. */
export function AuthCallbackPage() {
  return (
    // AppShell owns <main id="main-content"> — use div here to avoid duplicate id and nested landmarks.
    <div
      className="flex min-h-[50vh] items-center justify-center"
      data-test-id="auth-callback-page"
    >
      <p role="status" className="text-muted-foreground">
        Completing sign in&hellip;
      </p>
    </div>
  );
}
