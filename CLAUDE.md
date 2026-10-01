# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Project Rules — Ambient Weather Dashboard

This file is read by Claude on every task. Agents in `.claude/agents/` handle specific
layers. Always read the relevant agent file before working in that area.

---

## Project overview

Decoupled full-stack **web application** for live and historical Ambient Weather station
data. React + TypeScript frontend, .NET 10 ASP.NET Core backend, PostgreSQL, Redis.

Clean Architecture with MediatR handlers. All dependencies are free and open-source
(MIT, Apache 2.0, or BSD-3-Clause). See `docs/DEVELOPMENT_PLAN.md` for the full phased plan.

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
npm run lint          # CLAUDE.md split check + backend + frontend lint
npm run test:quiet    # backend + frontend + script tests: totals only, failing tests named (use in sessions)
npm test              # the same suites with full output

# One stack (run, lint, test, single test): backend/CLAUDE.md and frontend/CLAUDE.md, "Commands"
# E2E: npm run test:e2e (needs the Vite dev server on 5173, not the backend) — details in tests/e2e/CLAUDE.md
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
| `frontend/src/` | api · components · hooks · lib · pages · telemetry · types | `frontend/CLAUDE.md` — frontend architecture, frontend test rules, folder map |
| `tests/e2e/` | Playwright TS — playwright.config.ts, fixtures/, pages/, specs/ | `tests/e2e/CLAUDE.md` — Playwright standards, E2E commands and prerequisites |

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
- **Test fixtures must use faker libraries** to generate all location fields at runtime:
  - C# tests: `Bogus` (`new Bogus.Faker()`) — use `F.Address.Latitude()`, `F.Address.Longitude()`,
    `F.Address.StreetAddress()`, `F.Address.City()`, `F.Address.StateAbbr()`, `F.Address.ZipCode()`.
  - TypeScript tests: `@faker-js/faker` (`faker.location.*`) — `faker.location.latitude()`,
    `faker.location.longitude()`, `faker.location.buildingNumber()`, `faker.location.street()`,
    `faker.location.city()`, `faker.location.state({ abbreviated: true })`, `faker.location.zipCode()`.
  - Every test run must produce different values — no hardcoded values of any kind.
- **Never save** any address, GPS coordinate, station ID, or place name that a user enters or
  that is associated with a user's real deployment — not in memory, plans, or agent prompts.
  Use `{user-location}`, `{lat}`, `{lon}`, or `KXXX` as placeholders in documentation.
- **Documentation** must use generic placeholder coordinates (e.g. `{swLat}`, `{swLon}`)
  rather than real values, even in API examples or Postman-style test URLs.
- This rule applies to all agents listed in the agent index below.

### Keep it free
Every NuGet and npm package must be MIT, Apache 2.0, or BSD-3-Clause licensed. Check before adding.
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
When planning or completing any phase, keep the documentation chain in sync:
- Update `README.md` for newly implemented features, commands, setup steps, endpoints, or tooling.
- Update `docs/DEVELOPMENT_PLAN.md` with final status, verification, and deferrals.
- Update the immediately previous phase plan/closeout when carry-in work is completed, moved, or reclassified.
- Update the current phase plan before closeout so its checklist, verification, and deferred-work ledger match the code.
- When adding provider-specific plan items or integrations, include the official provider documentation link
  in the relevant phase plan and related-docs table. For Open-Meteo source fields, reference
  `https://open-meteo.com/en/docs`.
- Sanitize plans as they are created or updated: use placeholders or clearly dummy local-only values for
  tenant domains, client IDs, passwords, tokens, addresses, station IDs, personal paths, and deployment-specific
  identifiers. Do not add real or reusable local values to plans with the intent to clean them later.
- Include a final **Check EF migrations** step in every phase closeout going forward:
  `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.

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
  search string is found exactly once.
- **Git Bash rewrites path-like arguments.** Prefix `MSYS_NO_PATHCONV=1` when an argument is not a
  path (`git show origin/main:path`, `/api/health`).
- **Before a rebase, pull or force-push** a hook reports whether the branch is on `origin` and has a
  PR. After rebasing a pushed branch, `git push --force-with-lease`; never pull.
- **Settings:** read and edit `.claude/settings.json` directly.
- **One session per branch.** After each PR, update the status in `docs/DEVELOPMENT_PLAN.md`, then
  `/clear`. Stop at 80% context usage rather than chaining into the next task.

### Test everything
Every component, hook, handler, validator, and service gets tests before its phase is complete.
No phase is done until CI passes with new tests included.

| Layer | Tool |
|---|---|
| Backend handlers / validators | xUnit + Shouldly (+ `WebApplicationFactory` for integration) |
| Backend services / workers | xUnit + Moq or Testcontainers |
| Frontend components / hooks | Vitest + React Testing Library + jest-axe |
| E2E critical flows | Playwright Test TypeScript (`tests/e2e/`) — fixtures, page objects, `expect.poll` |
| API contract | OpenAPI snapshot ↔ TypeScript types |
| Backend lint | .NET SDK analyzers + Meziantou.Analyzer + Roslynator.Analyzers |
| Frontend lint | ESLint flat config + React/a11y/test/Vitest plugins |

See the **qa-engineer** agent.

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

## Agent index

| Agent | File | When to use |
|---|---|---|
| Architect | `.claude/agents/architect.md` | Cross-cutting design, Clean Architecture, maintainability |
| Backend | `.claude/agents/backend.md` | MediatR handlers, BFF controllers, workers |
| Frontend | `.claude/agents/frontend.md` | React components, hooks, pages, TanStack Query |
| Data | `.claude/agents/data.md` | EF Core, migrations, PostgreSQL schema, sync storage |
| API client | `.claude/agents/api-client.md` | Ambient REST, nearby public providers, rate limiter, Socket.IO client |
| Realtime | `.claude/agents/realtime.md` | Socket.IO → Redis → SignalR pipeline |
| Charts | `.claude/agents/charts.md` | Apache ECharts detail views, chart controls |
| Security | `.claude/agents/security.md` | Auth, credential encryption, authorization, rate limits |
| Performance | `.claude/agents/performance.md` | Runtime efficiency, query shape, caching, memory, scalability |
| Domain UX | `.claude/agents/domain-ux.md` | Ambient Weather product logic, user flows, dashboard/settings UX |
| DevOps | `.claude/agents/devops.md` | Docker, GitHub Actions, deployment |
| QA engineer | `.claude/agents/qa-engineer.md` | xUnit, Vitest, Playwright, contract tests |
