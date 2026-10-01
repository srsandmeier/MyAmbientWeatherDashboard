# Context and Usage Cost Plan

Status: in progress (2026-10-01). Branch: `chore/context-cost`. Implemented so far: the Vercel plugin
is turned off for this project (part of C1) and `CLAUDE.md` is split by folder (C2). Everything else is
planned.

Goal: lower the tokens every Claude Code session and subagent spends in this repo, without removing or
weakening any rule or check. Source: the context-cost work in the `inclusive-travel-navigator` repo (its
PRs #74 to #76 and section Q8 of its `docs/quality-hardening-plan.md`), filtered to what applies here.
The self-review step and lessons-learned rails from the same repo are planned separately in
[`QUALITY_PROCESS_PLAN.md`](QUALITY_PROCESS_PLAN.md).

That work found most usage came from two places, not from the checks themselves:

1. **Always-loaded instructions**: sent with every session and every subagent.
2. **Reading and printing**: long build and test output, whole-file reads, and retry loops.

---

## Where this repo stands

Sizes measured on `main` at `fd20296`. Token figures are estimates at about 4 bytes per token.

| Always loaded | Size | Notes |
|---|---|---|
| Root `CLAUDE.md` | 31.6 KB (about 8,000 tokens) | The only `CLAUDE.md`; backend, frontend and E2E rules all load for every task |
| Vercel plugin (enabled in user settings) | about 40 skill descriptions and several hundred tool names | Not used by this project. Turned off in `.claude/settings.json` on this branch |
| `update-config` skill | loads the whole settings schema when it runs | Runs automatically for any settings change |

| Read on demand | Size | Notes |
|---|---|---|
| `docs/DEVELOPMENT_PLAN.md` | 86 KB | Phase closeout rules send every phase task here |
| `docs/PHASE_12_COMPLETION_PLAN.md` | 45 KB | |
| `.claude/agents/*.md` | 3 to 14 KB each, 72 KB in total | "Always read the relevant agent file"; they have no frontmatter, so they are not registered subagents and cost nothing until read |

Before this branch there was no project `.claude/settings.json` (only the ignored
`settings.local.json`). There is no output cap and no quiet test command: `npm test` streams the full
`dotnet test` and Vitest output into the session.

`CLAUDE.md` by section, largest first: Commands 4.5 KB, Backend architecture 4.1 KB, Frontend
architecture 3.5 KB, Folder responsibilities 3.1 KB, Test everything 2.6 KB, BFF API surface 2.3 KB,
Realtime pipeline 1.9 KB.

---

## C1. Project settings (smallest change, do first)

Done on this branch: a tracked `.claude/settings.json` with `enabledPlugins`:
`"vercel@claude-plugins-official": false`. The user-level setting is unchanged, so other projects keep
the plugin. It takes effect in the next session started in this repo; confirm there that no Vercel
skills or tools are listed.

Still to add to that file:

- The `sed -i` and `python3` blocking hooks that `CLAUDE.md` describes. They live only in one user's
  settings today, so they protect nobody else who works in the repo.
- `bashOutputMaxChars: 10000`: longer command output is saved to a file and previewed.
- `skillOverrides`: `"update-config": "user-invocable-only"`, so settings are edited directly unless
  `/update-config` is typed.
- `env.PYTHONUTF8: "1"`: Python on Windows reads UTF-8 in scripted edits (a non-ASCII character made
  scripted edits fail and retry in the reference repo).

Verify first: `bashOutputMaxChars` and `skillOverrides` are copied from the reference repo's settings
file and were not checked against the current Claude Code settings reference in this planning pass.
Check each one, and confirm the effect in a fresh session (a long command is truncated to a preview).

Exit: a new session in this repo lists no Vercel skills or tools; `.claude/settings.json` is committed
and `settings.local.json` stays ignored.

## C2. Split `CLAUDE.md` by folder

Claude Code loads a folder's `CLAUDE.md` only when it works on files in that folder. Move area rules
line for line (no rewording in the same change, so the diff can be checked as a pure move):

| File | Gets |
|---|---|
| `CLAUDE.md` (root) | Overview, the day-to-day commands, the repo-wide non-negotiables (privacy, free licences, no deprecated dependencies, DRY, best practices, phase closeout, no plain-text secrets, line endings, commit format), shell platform safety, the agent index, a short folder map, and a table pointing to the files below |
| `backend/CLAUDE.md` | Backend architecture, Ambient rate limit, EF migrations, Realtime pipeline, the backend test rules (xUnit naming, integration test factories), the backend half of Folder responsibilities, external references |
| `backend/src/AmbientWeather.Api/CLAUDE.md` | The BFF API surface table, Swagger and health endpoint notes |
| `frontend/CLAUDE.md` | Frontend architecture, the frontend test rules (Vitest, `fetch` stubbing), the frontend half of Folder responsibilities |
| `tests/e2e/CLAUDE.md` | Playwright standards (fixtures, tags, route mocks, `expect.poll`, `data-test-id` locators) and the E2E command notes |

Rules that cross areas stay in the root, because a frontend task must still see them: "every public API
change updates backend DTO + frontend TypeScript type + tests", the `data-test-id` requirement (one line
in the root, detail in `frontend/`), and the privacy and faker rule.

Also trim the root without losing content:

- One-time setup in Commands (User Secrets, `.env.local`, Auth0 dashboard URLs) is already in
  `README.md`; replace it with a pointer.
- The frontend client needs the route list too: `frontend/CLAUDE.md` points to `docs/openapi.json` and
  the BFF table in `backend/CLAUDE.md` rather than repeating it.

Target: root at or under 14 KB (from 31.6 KB), no area file over 14 KB.

Delivered (2026-10-01, branch `chore/context-cost`): the four files were built from line ranges of the
old file by a script, which then checked that every original line is in exactly one new file. The only
lines not carried over are the 15 one-time setup lines (already in `README.md`, "One-time setup", now a
one-line pointer) and the `tests/e2e/` line of the folder map (now a row of the root's area table).

| Task touches | Files loaded | Size | Share of the old 31.6 KB |
|---|---|---|---|
| Docs, scripts, CI only | root | 12.7 KB | 40% |
| `tests/e2e/` | root + `tests/e2e/CLAUDE.md` (2.1 KB) | 14.8 KB | 47% |
| `frontend/` | root + `frontend/CLAUDE.md` (4.7 KB) | 17.4 KB | 55% |
| `backend/` outside the Api project | root + `backend/CLAUDE.md` (11.5 KB) | 24.2 KB | 77% |
| `backend/src/AmbientWeather.Api/` | the two above + its own `CLAUDE.md` (2.9 KB) | 27.1 KB | 86% |

These are file sizes. Which files Claude Code really loads for a task is not yet confirmed; that is the
live check in C3.

What differs from the plan as first written:

- **Backend saves less than estimated** (77% of the old size, not 60%). Most of the old file was
  backend rules.
- **The BFF route table is referenced, not always loaded.** The table and the Swagger and health notes
  are in `backend/src/AmbientWeather.Api/CLAUDE.md`, which loads automatically for controller work.
  `backend/CLAUDE.md` ("Where the route table lives") and `frontend/CLAUDE.md` each carry a pointer that
  says when to read it: before adding or changing a route, the handler behind one, its DTO, or a
  frontend API client. The pointers are plain paths, not `@` imports, because an import would load the
  table every time and undo the saving. The cost: outside the Api project the table is read on demand
  rather than present from the start, so it depends on the pointer being followed. The rules that apply
  to every route (rate-limit policies, thin controllers, exception mapping) are not in the table; they
  stay in `backend/CLAUDE.md`, "Backend architecture".
- **The realtime rule for browsers** ("never connect directly to Ambient Socket.IO") is a line in the
  root, under "Rules that cross areas", rather than in `frontend/CLAUDE.md`. The root always loads. The
  full Realtime pipeline section is in `backend/CLAUDE.md`.
- **Database and E2E commands** moved to their area files; the root keeps one summary line for each,
  including the E2E prerequisite (Vite dev server, no backend).
- **`AGENTS.md` is unchanged.** It is a separate full copy for Codex and never referred to `CLAUDE.md`.
  `.cursorrules` and `README.md` ("Build-process transparency") now name the folder files.
- **Agent files are unchanged.** They restate only a few rules (`data-test-id`, `AsNoTracking`,
  `RateLimitedApiClient`), and replacing those with links is a rewording, so it is left for a separate
  change.

## C3. Guard the split

Without a guard the root grows back. Add `scripts/check-claude-md.mjs` and run it in the `frontend` CI
job next to lint (it needs only Node):

- every `CLAUDE.md` is under its size limit (14 KB each);
- the root's area table lists every folder `CLAUDE.md` that exists, and nothing that does not;
- a fixed list of repo-wide rule headings is present in the root;
- no rule heading (`###`) appears in two files.

Port `scripts/check-instructions-loading.mjs` and its task list from the reference repo for a live
check: it runs Claude Code headless on one file read per task and records, through the
`InstructionsLoaded` hook, which instruction files were loaded. It makes real (small) model calls, so
it stays out of CI and is run by hand after the set of `CLAUDE.md` files changes. Sample tasks: a MediatR
handler, a React component, a Playwright spec, an EF migration, a repo script, a doc under `docs/`.

Exit: the offline check fails when a section is copied back into the root (seen to fail once, then
reverted); the live check passes for every sample task.

## C4. Quiet test and build output

Add a quiet mode to `scripts/test-all.mjs` and expose it as `npm run test:quiet`:

- each suite's full log goes to `test-results/<suite>.log` (ignored by git);
- on success, print only the totals line for each suite;
- on failure, print the failing tests and their messages, not the passing ones;
- always write `test-results/summary.txt`.

`npm test` and CI stay as they are (CI logs are not read into a session). `CLAUDE.md` then says to use
`test:quiet` in sessions and to read the summary file, and gives the single-class and single-file
commands for iterating.

Check before building: whether `dotnet test --verbosity quiet` plus a minimal console logger and Vitest's
`dot` reporter already give short enough output, in which case the script only needs to pass flags.
Playwright already writes only the HTML report.

Exit: a passing `npm run test:quiet` prints under 20 lines; a failing run names each failing test.

## C5. "Keep context lean" working rules

Add a short section to the root `CLAUDE.md`, next to "Shell commands — platform safety", adapted from
the reference repo:

- **Never print long output.** Send build, test and migration logs to a file and read back the summary
  (C4). Cap searches of long-line files (`docs/openapi.json`, lock files): counts or match-only first.
- **Read in ranges.** Outline first (`grep -n "^## "` for the 86 KB development plan; class and method
  lines for large source files), then read only the part needed.
- **Avoid edit retry loops.** Use the Edit tool for anything with backslashes; a scripted edit must
  assert its search string is found exactly once.
- **Git Bash rewrites some arguments.** Prefix `MSYS_NO_PATHCONV=1` when an argument looks like a path
  but is not one (`git show origin/main:path`, a route such as `/api/health`).
- **Check before rebasing** (C6).
- **Settings changes:** read and edit `.claude/settings.json` directly.
- **One session per branch.** After each PR: update the phase status in `docs/DEVELOPMENT_PLAN.md` (the
  one place status is kept), then `/clear`.
- **Stop at 80% context usage** rather than chaining into the next task.

The existing "Phase closeout documentation" rule already covers keeping the plan in sync; this adds
only the `/clear` step and the read-by-section habit.

## C6. Pre-rebase hook

Port `scripts/hooks/before-rebase.mjs` and its `PreToolUse` entry in `.claude/settings.json`. Before
`git rebase`, `git pull` or a force-push it reports whether the branch is on `origin` and whether a pull
request uses it, as added context; it never blocks or fails the command. In the reference repo a pull
after a rebase merged already-pushed commits back in, and the cleanup cost more than the hook.

Changes needed: the default branch is `main`, not `master`, in the message text. It uses `node` and
`gh`, both already required here.

Exit: a rebase on a branch with an open pull request shows the note; any other command shows nothing.

---

## Considered and not carried over

| Reference change | Why not here |
|---|---|
| `lessons-learned.md` loop, weak-item report, `self-review`, review-round counts, `prove-tests.mjs` | Quality process, not a usage fix. Planned in [`QUALITY_PROCESS_PLAN.md`](QUALITY_PROCESS_PLAN.md) |
| `release-check` and its repeat-run warnings | No single pre-PR gate exists here. C4's summary file takes the one usage idea from it; the gate itself is a later item in the quality plan |
| Quiet pre-commit hook | This repo has no pre-commit hook |
| Dropping hand-maintained counts from `CLAUDE.md` | `CLAUDE.md` here states no test or data counts |
| Probe-the-page-first Playwright rule, Chromium-only iteration | E2E here runs against mocked routes with fixtures and page objects; add it only if E2E iteration proves costly |
| Session handoff note in Claude's memory | `docs/DEVELOPMENT_PLAN.md` already carries phase status; the privacy rule also restricts what memory may hold |
| Trimming `settings.local.json` permissions | Permission rules are not sent to the model |

---

## Order and verification

Remaining, in this order: C3 (the guard for the split already made), the rest of C1, C4, C5, C6. The
Vercel change already made removes the largest fixed cost.

Measure before C1 and after C2 in a fresh session with `/context`, and record both figures here:
total at session start, and the split between memory files, skills and tools.

Each branch: `npm run lint`, `npm test`. No application code, schema or public API changes, so no EF
migration and no DTO or TypeScript type updates are expected. Closeout still runs the migration check:
`dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.

## Related docs

| Doc | Notes |
|---|---|
| [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) | Phase status; linked from its Related Documentation table |
| [`QUALITY_PROCESS_PLAN.md`](QUALITY_PROCESS_PLAN.md) | Self-review step and lessons-learned rails |
| [Claude Code settings](https://docs.claude.com/en/docs/claude-code/settings) | Check the C1 key names here |
| [Claude Code memory](https://docs.claude.com/en/docs/claude-code/memory) | How folder `CLAUDE.md` files load |
| [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks) | `PreToolUse` and `InstructionsLoaded` |
