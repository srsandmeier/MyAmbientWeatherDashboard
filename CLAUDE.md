# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Project Rules — Ambient Weather Dashboard

This file is read by Claude on every task. Folder `CLAUDE.md` files add the rules for each area;
agents and skills are listed at the end.

---

## Project overview

Decoupled full-stack **web application** for live and historical Ambient Weather station
data. React + TypeScript frontend, .NET 10 ASP.NET Core backend, PostgreSQL, Redis.

Clean Architecture with MediatR handlers. All dependencies are free and open-source
(permissive licences: MIT, Apache 2.0, BSD, ISC or 0BSD). See `docs/DEVELOPMENT_PLAN.md` for the full phased plan.

---

## Commands

All commands run from the repo root unless noted. Requires Docker Desktop running.

```bash
# Start infrastructure (PostgreSQL 5432, Redis 6379)
docker compose up -d

# One-time setup
dotnet tool restore                      # installs dotnet-ef
npm install --prefix frontend            # install frontend dependencies
npm install --prefix tests/e2e           # install TS Playwright dependencies

# User Secrets, frontend/.env.local and Auth0 dashboard URLs (first time only): README.md, "One-time setup"

# Unified dev start (concurrently: api:watch + Vite frontend)
npm run start:all

# All stacks
npm run lint          # CLAUDE.md split, agents/skills and token contrast checks + backend + frontend lint
npm run test:quiet    # backend + frontend + script tests: totals only, failing tests named (use in sessions)
npm test              # the same suites with full output
npm run pre-pr        # before a PR: self-review + lint + those suites + E2E P0, same summary file
npm run pre-pr:after-push  # once pushed: only what CI does not report; then read `gh pr checks`
npm run ui:snapshot   # screenshots of each page, 3 widths x light/dark (ui-snapshot skill)
npm run ui:contrast   # WCAG contrast of the theme tokens, both themes (contrast-tokens skill)

# One stack (run, lint, test, single test): backend/CLAUDE.md and frontend/CLAUDE.md, "Commands"
# E2E: npm run test:e2e (starts Vite on 5173 if needed; no backend) — details in tests/e2e/CLAUDE.md
# Database migrations: npm run db:update · npm run db:migrate -- AddMigrationName — details in backend/CLAUDE.md

# Utilities
npm run kill          # Kill background dotnet/node processes (Windows; useful after crashes)
```

**Runtime mock stations (no real hardware needed):** name a device `test.1` in Settings to inject one mock station into the dashboard; `test.2` injects two. Mock stations are local-only and never written to Ambient Weather.

---

## Where the rest of the rules live

Claude Code loads a folder's `CLAUDE.md` when it works on files in that folder, so area rules cost
nothing when the work is elsewhere. Read the file for an area before changing it.

| Folder | Contents | Rules |
|---|---|---|
| `backend/src/`, `backend/tests/` | Api · Application · Domain · Infrastructure · Workers; unit and integration tests | `backend/CLAUDE.md` — backend architecture, Ambient rate limit, EF migrations, realtime pipeline, backend test rules, folder map, external references |
| `backend/src/AmbientWeather.Api/` | Controllers, middleware, logging, telemetry | `backend/src/AmbientWeather.Api/CLAUDE.md` — BFF route table, Swagger and health endpoints |
| `backend/src/AmbientWeather.Infrastructure/` | DbContext, migrations, repositories, services | `backend/src/AmbientWeather.Infrastructure/CLAUDE.md` — schema, query and migration rules |
| `Infrastructure/Ambient/` | Rate-limited REST client, circuit breaker, Socket.IO client | `backend/src/AmbientWeather.Infrastructure/Ambient/CLAUDE.md` — Ambient client classes and rules |
| `Infrastructure/Neighbors/` | Nearby providers, discovery, aggregation | `backend/src/AmbientWeather.Infrastructure/Neighbors/CLAUDE.md` — provider contracts, Open-Meteo requests |
| `frontend/src/` | api · components · hooks · lib · pages · telemetry · types | `frontend/CLAUDE.md` — frontend architecture, frontend test rules, folder map |
| `frontend/src/components/charts/` | ECharts metric history chart, controls, table | `frontend/src/components/charts/CLAUDE.md` — option builder, chart accessibility and theming |
| `tests/e2e/` | Playwright TS — playwright.config.ts, fixtures/, pages/, specs/ | `tests/e2e/CLAUDE.md` — Playwright standards, E2E commands and prerequisites |
| `docs/` | Development plan, phase plans, lessons, security and API docs | `docs/CLAUDE.md` — phase planning and closeout steps, sanitizing plans |

`npm run lint:claude-md` keeps this table, the files and their sizes (14 KB each) in step. A new
folder `CLAUDE.md` needs a row here; a rule heading (`###`) lives in one file only. After changing which
files exist, run the live check: `node scripts/check-instructions-loading.mjs --all` (Haiku calls).

Rules that cross areas (detail in the area files):
- Browsers must **not** connect directly to Ambient Socket.IO; live data reaches the browser only
  through the backend SignalR hub (`backend/CLAUDE.md`, "Realtime pipeline").
- Every interactive or data-driven element carries a stable, kebab-case `data-test-id`
  (`<area>-<element>[-<qualifier>]`), and tests locate elements by it (`frontend/CLAUDE.md`,
  `tests/e2e/CLAUDE.md`).
- Before review agents or `/code-review`, run `npm run self-review`; log each miss a review finds in
  `docs/LESSONS_LEARNED.md` in the same branch.

---

## Non-negotiable rules (apply everywhere)

### Privacy — never hardcode or persist any address, GPS coordinate, or station ID

- **Never hardcode** any address, GPS coordinate, station ID, zip code, or place name
  anywhere — in code, tests, documentation, plan files, or memory — not even as
  a "placeholder" or "example" value.
- **Test fixtures must use faker libraries** to generate all location fields at runtime: `Bogus` in
  C# tests, `@faker-js/faker` in TypeScript tests. The calls to use are in the test rules of
  `backend/CLAUDE.md` and `frontend/CLAUDE.md`.
  - Every test run must produce different values — no hardcoded values of any kind.
- **Never save** any address, GPS coordinate, station ID, or place name that a user enters or
  that is associated with a user's real deployment — not in memory, plans, or agent prompts.
  Use `{user-location}`, `{lat}`, `{lon}`, or `KXXX` as placeholders in documentation.
- **Documentation** must use generic placeholder coordinates (e.g. `{swLat}`, `{swLon}`)
  rather than real values, even in API examples or Postman-style test URLs.
- This rule applies to every agent and skill.

### Keep it free
Every NuGet and npm package must have a permissive licence: MIT, Apache 2.0, BSD-2-Clause, BSD-3-Clause,
ISC or 0BSD. No copyleft (GPL, LGPL, AGPL, MPL) or source-available licences (SSPL, BSL). Check before adding.
Do not add anything else without updating the development plan and getting confirmation.
Prefer free-tier cloud services (Auth0 Free Tier) or self-hosted open-source (OpenIddict).

### No deprecated dependencies or APIs
- Use .NET 10+, React 19, Node 24 LTS, PostgreSQL 16, Redis 7.
- Prefer current Active LTS runtime versions. Supported Maintenance LTS versions are allowed
  only when an existing dependency or host requires them, and never after end-of-life.
- Do not add npm or NuGet packages flagged **deprecated** or end-of-life.
- Do not use deprecated .NET APIs, React class components, or legacy patterns.
- Before adding a dependency, confirm it is actively maintained.

### DRY — reuse before inventing
- Extend existing handlers, hooks, mappers, and components before creating parallel ones.
- Centralize metric definitions (`MetricDefinition`), unit conversion, TanStack Query keys,
  and Ambient field mappings — no copy-paste across layers.
- Extract shared logic only when used in **2+ places**; avoid premature abstraction.
- One typed API client function per BFF endpoint; one ECharts option builder for all charts.

### Best practices
- Smallest correct diff; match surrounding conventions; no unrelated drive-by refactors.
- User-facing BFF endpoints read from PostgreSQL or Redis — not live Ambient on every request.
- Every public API change updates backend DTO + frontend TypeScript type + tests.
- Prefer explicit configuration over magic abstractions.
- All I/O is async (`async`/`await`).

### Phase closeout documentation
When planning or completing any phase, keep the documentation chain in sync: `README.md`,
`docs/DEVELOPMENT_PLAN.md`, the previous phase plan and the current one. Plans never hold real tenant
domains, client IDs, tokens, addresses, station IDs or personal paths. Every closeout ends with the EF
migration check. The steps are in `docs/CLAUDE.md`; read it before planning or closing a phase.

### No plain-text secrets
Ambient `apiKey` and `applicationKey` are stored **server-side only**, encrypted with
ASP.NET Core Data Protection. Never expose them to the React frontend, never write them
to `appsettings.json` in plain text, and never log them. Use .NET User Secrets locally.
See `docs/SECURITY.md` and the **security** agent.

### Shell commands — platform safety
**Never use `sed -i`** — it silently truncates files on Windows/Git Bash (confirmed data-loss
incident). Use the `Edit` tool with `replace_all: true` for bulk in-place substitutions.

**On Windows, use `python` not `python3`** — the `python3` command is intercepted by a Windows
app execution alias that redirects to the Microsoft Store instead of the installed interpreter.
A `PreToolUse` hook in `.claude/settings.json` blocks both (`scripts/hooks/block-unsafe-shell.mjs`).

**PowerShell via Bash — always use single quotes around the `-Command` argument:**
```bash
powershell -Command 'Write-Output "ok" 2>$null'
```
Double-quoted `-Command` strings cause Bash to expand `$null` (and any other `$var`) before
PowerShell sees them, producing quoting errors. Single quotes prevent Bash expansion entirely.
If a PowerShell string literal inside the command itself needs single quotes, escape the dollar
sign instead: `"... 2>\$null ..."`, but prefer the single-quote outer form.

### Keep context lean
Same checks, less usage: most session cost is reading and printing.
- **Never print long output.** Run `npm run test:quiet` and read `test-results/summary.txt`; send build
  and migration logs to a file. In long-line files (`docs/openapi.json`, lock files) search for counts
  or match-only first. `.claude/settings.json` caps inline command output at 10,000 characters.
- **Read in ranges.** Outline first (`grep -n "^## "` for `docs/DEVELOPMENT_PLAN.md`; class and method
  lines for large source files), then read only the part needed.
- **No edit retry loops.** Use the Edit tool for anything with backslashes; a scripted edit asserts its
  search string is found exactly once. The shell hook denies inline Python, `node -e`, `perl -i` and
  heredoc writes whose text holds a backslash.
- **Prove tests with the script.** `node scripts/prove-tests.mjs mutations.json` (list in your scratchpad)
  puts each old bug back and prints one line per mutation, instead of hand-editing and rerunning.
- **Probe before writing browser tests.** Measure the real page first (a short Playwright script: which
  elements exist, what is clipped), then write the assertions; run one spec while iterating, the suite once.
- **Git Bash rewrites path-like arguments.** Prefix `MSYS_NO_PATHCONV=1` when an argument is not a
  path (`git show origin/main:path`, `/api/health`).
- **Before a rebase, pull or force-push** a hook reports whether the branch is on `origin` and has a
  PR. After rebasing a pushed branch, `git push --force-with-lease`; never pull.
- **Settings:** read and edit `.claude/settings.json` directly.
- **One session per branch.** After each PR, update the status in `docs/DEVELOPMENT_PLAN.md`, then
  `/clear`. Stop at 80% context usage rather than chaining into the next task.

### Test everything
Every component, hook, handler, validator, and service gets tests before its phase is complete.
No phase is done until CI passes with new tests included. The tools for each layer are in the test
rules of `backend/CLAUDE.md`, `frontend/CLAUDE.md` and `tests/e2e/CLAUDE.md`. See the **qa-engineer** agent.

### Line endings
All files use **LF** (`\n`) line endings — never CRLF. `.editorconfig` and `.gitattributes` enforce this. Git is configured with `core.autocrlf=false` and `core.eol=lf`.

### Commit message format
```
<type>(<scope>): <short description>

feat(api): add rate-limit queue with token bucket
fix(ui): chart range picker not updating series
docs(plan): add Phase 11 neighbor config spec
refactor(sync): extract history pagination into service
test(tiles): add MetricTile render tests
```
Types: feat · fix · docs · refactor · test · chore

---

## Agents and skills

Agents (`.claude/agents/`) are reviewers and specialists launched as subagents; skills (`.claude/skills/`)
are procedures. Claude Code lists both with their descriptions, so they are not repeated here. Ownership,
models and the review findings format: `docs/AGENT_GUIDELINES.md`. Facts about code live in the folder
`CLAUDE.md` files, not in agents.
- **Agents:** reviews by `architect`, `security`, `performance`, `domain-ux` and `ui-ux-design`; tests by
  `qa-engineer`; CI, dependencies and merge readiness by `release-ci`.
- **Skills:** `api-change` (add or change a BFF endpoint), `ef-migration`, `e2e-heal`, `ui-snapshot`,
  `a11y-audit`, `contrast-tokens`, `self-review`; and, only when you type them, `/phase-closeout` and
  `/dependabot-combine`.
