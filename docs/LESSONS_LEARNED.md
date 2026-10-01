# Lessons learned: misses and what prevents them

Every miss we catch goes here, with its cause and what now stops it happening again.

**Reading it.** Never read the whole file. Self-review prints the checklist items for the areas a
branch changed; read a section below only when working in that area
(`grep -n "^## " docs/LESSONS_LEARNED.md` lists them). `node scripts/lessons-report.mjs --check` holds
the sizes: 24 KB for the file, 6,000 bytes a section, 600 bytes an entry, 12 checklist items of at most
200 characters. When a limit is hit, merge duplicates, retire entries whose enforced check has not
fired, or automate a checklist item; do not raise the limit.

**The loop.**

1. A review, a test or a person catches a miss.
2. The reviewer tags the finding **Lesson:** with the checklist item that should have caught it, or
   "new".
3. Whoever fixes it adds or updates an entry here in the same branch.
4. If the prevention can be checked automatically it becomes a hook, a lint rule, a test or a
   self-review check, the entry says **enforced**, and a checklist item that the check now covers in
   full is removed. Otherwise the entry says **manual** and cites a checklist item.
5. `node scripts/lessons-report.mjs` ranks checklist items by the entries that cite them
   (`checklist item "Name"`) and are not yet enforced. Automate the top ones first.

**An entry** starts with a bold `Miss:` label, has a bold `Cause:` (why it happened, not a restatement)
and a bold `Prevention:` (what to do, in a form that can be checked), and ends with `(enforced: …)`
naming the check, or `(manual)`. An entry for a pitfall that a `CLAUDE.md` already states gives the file
and heading as its miss and does not repeat the rule. No real location, station or deployment value
appears in any entry (root `CLAUDE.md`, "Privacy").

## Process checklist

Every item exists because of an entry below, is a question that the branch's diff can answer with yes
or no, and carries the areas it applies to: `all`, `backend`, `frontend`, `e2e`, `docs`. A "no" means
stop and fix it first. An item that a `CLAUDE.md` rule covers names the heading and does not repeat the
rule. `node scripts/lessons-report.mjs --checklist backend,docs` prints the items for those areas.

<!-- process-checklist:start -->
- [ ] **New checks proven.** [all] Was every new test, hook or guard seen to fail on deliberately
      broken input?
- [ ] **Failures reproduced.** [all] Was each reported failure reproduced, and its message read, before
      code was changed for it?
- [ ] **Contract changed together.** [backend, frontend, e2e] Did the DTO, the TypeScript type, the
      tests and the E2E route mocks change in one branch? (root `CLAUDE.md`, "Best practices")
- [ ] **Test factory updated.** [backend] Does the test factory mock every dependency the handler now
      injects? (`backend/CLAUDE.md`, "Backend tests")
- [ ] **Reuse first.** [backend, frontend] Was an existing handler, hook, mapper, component or pattern
      searched for before a new one was written? (root `CLAUDE.md`, "DRY — reuse before inventing")
- [ ] **Docs match the code.** [all] Was every count, command and status code this change touches
      checked against the code, and each documented command run? (root `CLAUDE.md`, "Phase closeout
      documentation")
- [ ] **Nothing secret logged.** [backend, frontend] Do new log lines and request URLs leave out keys,
      tokens and raw user identifiers? (root `CLAUDE.md`, "No plain-text secrets")
- [ ] **Misses logged.** [all] Does every review finding fixed on this branch have an entry here?
<!-- process-checklist:end -->

## Backend

- **Miss:** `backend/CLAUDE.md`, "Schema changes require EF migrations", and the troubleshooting line
  under its "Commands" (a new endpoint returns 500 locally after a pull).
  **Cause:** the entity and its migration are separate files and the build passes without the
  migration; a pull brings a migration but does not apply it to the local database.
  **Prevention:** scaffold the migration with the entity change (enforced: self-review warns when an
  entity or `DbContext` file changes and no migration is added; the Testcontainers integration tests
  fail on a missing one).
- **Miss:** `backend/CLAUDE.md`, "Backend tests" (integration test factories): an endpoint test gets 500
  instead of the status it expects.
  **Cause:** a factory mocks services one at a time, so a dependency added to a handler resolves from
  the real container and reaches a database that is not there.
  **Prevention:** checklist item "Test factory updated" (manual).
- **Miss:** request logs held the Ambient `apiKey` and `applicationKey` (Phase 3 fix plan, S-2).
  **Cause:** Ambient takes both keys in the query string, and `HttpClientFactory` logs each request URI
  at Information level.
  **Prevention:** the `System.Net.Http.HttpClient.AmbientWeatherRest: Warning` filter in
  `appsettings.json`; checklist item "Nothing secret logged" (manual).
- **Miss:** the realtime subscription registry logged a prefix of the raw Auth0 subject (Phase 10 plan,
  section 0).
  **Cause:** the log parameter took the subject, not the user hash that the realtime code already uses
  for group names.
  **Prevention:** the log lines take `HashPrefix`; checklist item "Nothing secret logged" (manual).

## Frontend

- **Miss:** `frontend/CLAUDE.md`, "Frontend architecture" (type predicate narrowing).
  **Cause:** a predicate's type has to be assignable to the parameter's type, and a const array's
  element type is narrower than the union being filtered to.
  **Prevention:** drop the predicate and cast the result (enforced: TypeScript error TS2677 in
  `npx tsc -b`, a step of the CI `frontend` job).
- **Miss:** `frontend/CLAUDE.md`, "Frontend architecture" (`ApiResult` error mocks).
  **Cause:** each test writes its failure object by hand, and a mock that is not typed as
  `ApiResult<T>` is not checked by the compiler.
  **Prevention:** checklist item "Contract changed together" (manual: `tsc -b` catches it only where
  the mock is typed).
- **Miss:** `frontend/CLAUDE.md`, "Frontend architecture" (React Compiler).
  **Cause:** the compiler tracks the parent object where the dependency array named a property, and the
  disable comment for `exhaustive-deps` does not cover the second rule.
  **Prevention:** depend on the object and read the property inside the callback (enforced: ESLint, by
  the React Compiler rule that section names).
- **Miss:** `frontend/CLAUDE.md`, "Frontend architecture" (TanStack Query v5 disabled-query pattern).
  **Cause:** v5 reports a disabled query as pending although it is not fetching, so a hook that passes
  `isPending` through shows a loading state that never ends.
  **Prevention:** copy the guard in `useNeighborsConfig.ts` and `useCredentialStatus.ts`; checklist item
  "Reuse first" (manual).
- **Miss:** two config modules, `config/auth.ts` and `lib/config.ts`, and two copies of the
  `localStorage` error handling in `ThemeProvider` (Phase 3 fix plan, D-3 and D-4).
  **Cause:** the auth settings and the API base URL were each given a module of their own, and the
  second storage call copied the first one's `try`/`catch`.
  **Prevention:** one `config/app.ts` and one `safeStorage` helper; checklist item "Reuse first"
  (manual).
- **Miss:** two pages rendered their own `<main id="main-content">` inside the one `AppShell` renders
  (Phase 3 fix plan, M-2).
  **Cause:** each page was written as a whole document, and a component test renders a page without the
  shell, so the nesting never shows there.
  **Prevention:** `AppShell` owns the landmark and pages use a `<div>` (enforced: the page-level audits
  in `tests/e2e/specs/axe-audits.spec.ts` for the dashboard, settings and metric detail pages; manual
  for the other routes).

## Tests and E2E

- **Miss:** the settings smoke test's mocks and assertions lacked `dateFormat` after the preference was
  added (Phase 8 plan, section 0).
  **Cause:** E2E route mocks are hand-written copies of a response, and nothing ties them to the DTO.
  **Prevention:** checklist item "Contract changed together" (enforced: `SwaggerContractTests` compares
  the API with `docs/openapi.json`, and self-review warns when a DTO changes without the frontend
  types; manual for E2E mocks).
- **Miss:** an E2E locator still matched the old dashboard heading after the heading text changed
  (Phase 3 fix plan, T-3).
  **Cause:** the locator matched visible text, which changes with the page.
  **Prevention:** locate by `data-test-id` (root `CLAUDE.md`, "Rules that cross areas") (manual).
- **Miss:** 26 integration tests fail with "Docker is either not running" and read like a broken
  branch (context plan, C4).
  **Cause:** Testcontainers needs Docker Desktop; the failure is in the environment, not the code.
  **Prevention:** `npm run test:quiet` prints the shared message once above the test names; checklist
  item "Failures reproduced" (manual).

## Docs and drift

- **Miss:** test counts in `docs/DEVELOPMENT_PLAN.md` were behind the suites, and one was stale again
  before the fix pass ended (Phase 3 fix plan, T-1 and T-2).
  **Cause:** the counts are typed by hand and change with every test added.
  **Prevention:** checklist item "Docs match the code" (manual).
- **Miss:** `CLAUDE.md` gave the wrong status code for `AmbientCredentialsRequiredException` (Phase 8
  plan, section 0).
  **Cause:** the mapping lives in the exception middleware and was retyped into the rules file.
  **Prevention:** checklist item "Docs match the code" (manual).
- **Miss:** `CLAUDE.md` listed `npm run lint:fix` as a root command; the script exists only in
  `frontend/` (context plan, C5).
  **Cause:** the command was written down without being run.
  **Prevention:** checklist item "Docs match the code" (manual).

- **Miss:** all twelve agent files ended with a copy of the privacy rule, and three still described the
  C# Playwright suite or MSW as current (quality plan, "Agents and skills audit").
  **Cause:** each agent file was written to stand alone, and nothing compared them with each other or
  with the code after the E2E migration.
  **Prevention:** shared text lives in one `CLAUDE.md` or skill; checklist item "Docs match the code"
  (enforced: self-review fails on a line copied across agent or skill files; manual for stale facts).

## Process

- **Miss:** root `CLAUDE.md`, "Shell commands — platform safety" (`sed -i`).
  **Cause:** on Windows under Git Bash an in-place `sed` truncates the file and reports no error.
  **Prevention:** edit with the Edit tool (enforced: `scripts/hooks/block-unsafe-shell.mjs` denies the
  command).
- **Miss:** root `CLAUDE.md`, "Shell commands — platform safety" (`python3`).
  **Cause:** a Windows app execution alias answers to that name and opens the Microsoft Store.
  **Prevention:** call `python` (enforced: `scripts/hooks/block-unsafe-shell.mjs` denies the command on
  Windows).
- **Miss:** root `CLAUDE.md`, "Shell commands — platform safety" (PowerShell through Bash).
  **Cause:** inside double quotes Bash expands `$null` and every other `$name` before PowerShell runs.
  **Prevention:** single quotes around the `-Command` argument (manual).
- **Miss:** root `CLAUDE.md`, "Keep context lean" (Git Bash rewrites path-like arguments).
  **Cause:** Git Bash converts an argument that starts with `/` into a Windows path, so a route or a
  `/context` prompt arrives as a file path.
  **Prevention:** prefix `MSYS_NO_PATHCONV=1` (manual).
- **Miss:** the `sed -i` hook that `CLAUDE.md` described never denied a command, and there was no
  `python3` hook at all (context plan, C1).
  **Cause:** the hook parsed its input with `jq`, which was not installed, and it was never seen to
  deny anything after it was written.
  **Prevention:** checklist item "New checks proven" (enforced: `scripts/hooks/hooks.test.mjs` runs the
  hook on a denied and on an allowed command).
- **Miss:** the pre-rebase hook showed its note for any command that mentioned a rebase, a pull or a
  force-push, such as a commit message (context plan, C6).
  **Cause:** it matched the words anywhere in the command text, and its first samples were all real
  commands.
  **Prevention:** match only where git is run as a command, after quoted text is emptied (enforced:
  `scripts/hooks/hooks.test.mjs`, "a command that only mentions rebase, pull or force-push is not
  risky").
- **Miss:** pitfalls were written into `CLAUDE.md` as rules with no cause and nothing to say whether a
  check enforces them, so the dead hook above went unnoticed (quality plan, "What this repo has today").
  **Cause:** there was no place to record a miss, only a place to add a rule.
  **Prevention:** this file and its report; checklist item "Misses logged" (enforced: self-review warns
  when a branch has review-fix commits and this file is unchanged; manual for a miss found any other
  way).
- **Miss:** root `CLAUDE.md`, "Keep context lean" (no edit retry loops): two scripted edits whose search
  text held backslashes matched nothing (quality plan, P1 and P2).
  **Cause:** the search text passed through a shell here-document inside a JavaScript string, and the
  backslashes did not arrive as written.
  **Prevention:** the Edit tool, or a script file written directly; a scripted edit asserts one match,
  which is what stopped both (manual).
