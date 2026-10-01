# E2E rules (Playwright Test TypeScript)

Loaded when Claude works on files under `tests/e2e/`. Repo-wide rules (privacy and faker fixtures,
shell safety, commit format) and the `data-test-id` naming pattern are in the root `CLAUDE.md`.
Location fields in fixtures come from `@faker-js/faker` (`faker.location.*`); the calls are listed in
`frontend/CLAUDE.md`, "Frontend tests".

---

## Commands

Run from the repo root.

```bash
# E2E — Playwright uses the frontend dev server on port 5173 if one is running; otherwise it starts
# Vite for the run and stops it afterwards (`webServer` in playwright.config.ts).
# Backend is NOT required: Auth0 and all BFF calls are mocked by Playwright route handlers.
# One-time browser install (matches @playwright/test version): cd tests/e2e && npm run install:browsers
# Auth0 domain is read from frontend/.env.local at runtime — keep that file present for E2E to work.
npm run test:e2e      # Playwright TypeScript suite (tests/e2e) — primary CI suite
npm run test:e2e:p0   # P0 smoke tests only
npm run test:e2e:p1   # P1 tests only
npm run pre-pr        # runs P0 last, with one retry as in CI; totals in test-results/summary.txt
npx playwright show-report              # open HTML report (run from repo root after test:e2e)
```

---

## Standards

Playwright: web-first locator assertions first, no arbitrary sleeps. Use `expect.poll` for
non-locator async state (route mock counters, captured request payloads, PUT/POST capture).
`data-test-id` is the primary locator; `page.getByTestId()` is verified to work reliably in
the TS suite. `BasePage.byTestId()` centralises this in page objects.

**TS Playwright standards** (`tests/e2e/`): config / fixtures / pages / specs are separated;
specs are tagged `@p0` / `@p1`; route mocks live in `fixtures/auth.ts` and `fixtures/bff.ts`;
every spec that touches authenticated pages must use the `homePage`, `settingsPage`, or
`metricDetailPage` fixture — never raw `{ page, context }` — so Auth0 + BFF mocks are wired
before any navigation. Test-specific route overrides are registered on `context` inside the test
body (LIFO: later registration = higher priority). `blockExternalNetwork` is registered first
(lowest priority) to abort unmatched external calls; localhost is always passed through.
