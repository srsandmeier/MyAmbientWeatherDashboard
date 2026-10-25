---
name: e2e-heal
description: Triage and repair a failing or flaky Playwright test — decide whether it is a product bug, the environment, stale test data or stale automation, fix only stale automation, and rerun narrowly. Use when an E2E spec fails locally or in CI, when a test passes only on retry, or when a UI change breaks specs.
---

# e2e-heal

Standards: `tests/e2e/CLAUDE.md`. Never hide a product bug to make a test pass.

1. **Get the failure, not the whole log.** CI: `gh run view <run-id> --log-failed > "$TMP/e2e.log"` and
   read the failing test's lines; download the `playwright-test-results-*` artifact for the trace. Local:
   `npm run test:e2e -- specs/<file>.spec.ts > "$TMP/e2e.log" 2>&1`, then
   `npx playwright show-trace <trace.zip>` or the report.
2. **Classify it:**
   - **Product bug:** the app does the wrong thing. Fix the app (or report it) and keep the assertion.
   - **Environment:** dev server not up, browsers not installed, port in use. Fix the environment. A
     `page.goto` timeout on several specs at once is usually Vite compiling on a cold start: rerun once
     before changing anything.
   - **Stale test data or mocks:** the BFF mock in `fixtures/bff.ts` or `mockData.ts` no longer matches the
     API types. Update the mock from the types.
   - **Stale automation:** a moved `data-test-id`, a page-object gap, a missing web-first wait.
3. **Probe before changing an assertion:** a short Playwright script or one `test.only` run that reports
   which elements exist and their state.
4. **Repair stale automation only:** update the page object or locator (still by `data-test-id`), add the
   missing `expect(...)` or `expect.poll`. Do not widen a locator, raise a timeout, add a sleep or skip.
5. **Rerun narrowly:** the one spec, then its group (`npm run test:e2e:p0` or `:p1`).
6. **A flake that cannot be fixed now** gets a GitHub issue; a skip names it (`test.skip(..., 'reason #123')`).
7. Close with `npm run self-review`; log the miss in `docs/LESSONS_LEARNED.md` if a review or CI caught it.
