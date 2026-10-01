# Context and Usage Cost Plan

Status: complete (2026-10-01). The Vercel plugin setting and the `CLAUDE.md` split (part of C1, C2)
merged in PR #144. The guard for the split (C3), the rest of the project settings and the blocking hooks
(C1), the quiet test runner (C4), the "Keep context lean" rules (C5) and the pre-rebase hook (C6) merged
in PR #145. The closeout (branch `chore/context-cost-closeout`) confirmed the settings and hooks in a
fresh session, recorded the `/context` figures, added the test for the split guard and narrowed what the
pre-rebase hook reacts to. Each item below ends with a "Delivered" note; nothing is open.

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

Delivered (2026-10-01, branch `chore/claude-md-check`):

- **Vercel plugin:** the session after PR #144 listed no Vercel skills. Three `vercel:*` agent types
  were still offered, so the setting removes the skills but not every trace of the plugin.
- **Key names checked** against the [settings reference](https://code.claude.com/docs/en/settings-reference):
  `bashOutputMaxChars`, `skillOverrides` (value `user-invocable-only`), `env` and `enabledPlugins` are
  all documented keys. All four are now in `.claude/settings.json`.
- **Blocking hook:** `scripts/hooks/block-unsafe-shell.mjs` denies `sed -i` (every spelling, also
  behind `xargs` and `find -exec`) and, on Windows only, `python3`. It reads the command from the
  hook's JSON with Node. A command that only mentions `sed -i` (a commit message, a `grep`) is allowed.
- **What it replaces:** the hook `CLAUDE.md` described did not work. The user-level hook parsed its
  input with `jq`, which is not installed on the machine it was written for, so it never denied
  anything, and there was no `python3` hook at all. That user-level hook is unchanged; it is harmless
  and now redundant in this repo.
- **Not yet seen in a live session:** settings and hooks are read at session start. The hook command
  lines were run through `bash` with the hook's JSON on stdin (deny for `sed -i` and `python3`, nothing
  for `sed -n`), but a real denial, the 10,000-character output preview and the `update-config`
  override have to be confirmed in the next session.

Confirmed live (2026-10-01, branch `chore/context-cost-closeout`, the first session started after PR
#145 merged, Claude Code 2.1.287):

- **Denials:** a `sed -i` on a scratch file and `python3 --version` were both refused before they ran,
  with the hook's reason shown.
- **Output cap:** a command that printed 14.8 KB (over the 10,000-character cap, under Claude Code's
  default) was saved to a file and shown as a 2 KB preview. The preview is 2 KB, not 10,000 characters;
  10,000 is the size above which output is saved and previewed.
- **`update-config`:** the skill is not in the list of skills the model can start by itself.
- **Vercel agent types:** `enabledPlugins: false` left the plugin's three agent types on offer.
  `permissions.deny` in `.claude/settings.json` now names them (`Agent(vercel:ai-architect)`,
  `Agent(vercel:deployment-expert)`, `Agent(vercel:performance-optimizer)`, the form the
  [subagents page](https://code.claude.com/docs/en/sub-agents) documents). The running session dropped
  all three as soon as the file was saved. A new agent type added by the plugin would need a new line.

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

These are file sizes. The live check in C3 confirmed that Claude Code loads exactly these files for each
kind of task.

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

Second split (2026-10-01, branch `chore/pre-pr-gate`): the root had grown to 13,967 of 14,000 bytes, so
three area-specific parts moved out. No rule heading left the root.

| Moved | From the root's | To |
|---|---|---|
| The closeout steps and the plan-sanitizing rule | "Phase closeout documentation", which keeps a four-line summary and a pointer | a new `docs/CLAUDE.md` (1,481 bytes), loaded for work under `docs/` |
| The `Bogus` and `@faker-js/faker` call lists | "Privacy", which keeps the rule and names both libraries | "Backend tests" in `backend/CLAUDE.md` and "Frontend tests" in `frontend/CLAUDE.md`; `tests/e2e/CLAUDE.md` points to the frontend list |
| The layer and tool table | "Test everything", which keeps the rule and a pointer | one "Tools:" line in each of the same two sections; the E2E tools were already in `tests/e2e/CLAUDE.md` |

The root is 12,431 bytes, `backend/CLAUDE.md` 12,425 and `frontend/CLAUDE.md` 5,893. The area table has
a `docs/` row, `scripts/claude-md-tasks.json` expects `docs/CLAUDE.md` for a doc edit, and the live check
passed for all 8 tasks. The cost: a task that only reads a file under `docs/` now loads 1.5 KB more,
and the closeout steps depend on the root's pointer when a phase is closed without opening `docs/`.

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

Delivered (2026-10-01, branch `chore/claude-md-check`):

- `scripts/check-claude-md.mjs` runs as `npm run lint:claude-md`, as the first step of `npm run lint`,
  and as its own step after lint in the CI `frontend` job. The limit is 14,000 bytes per file. It lists
  files with `git ls-files` (tracked plus untracked and not ignored), so a new folder file is checked
  before it is committed. The repo-wide headings it requires in the root are the eleven `###` headings
  under "Non-negotiable rules".
- Seen to fail, then restored, for five changes: "Backend architecture" copied back into the root
  (reported twice: over the size limit, and the heading in two files), an area table row removed, a
  table row for a file that does not exist, a repo-wide heading renamed, and a new folder `CLAUDE.md`
  with no table row.
- `scripts/check-instructions-loading.mjs` and `scripts/claude-md-tasks.json` are ported from the
  reference repo. Eight tasks: a MediatR handler, a React component, a BFF controller (the nested Api
  file), a Playwright spec, an EF migration, a backend integration test, a repo script, a doc under
  `docs/`. Run with `--all` on Claude Code 2.1.286: all eight loaded exactly the expected files, and
  nothing else from the repo.

The root is now 13,171 bytes (the two command lines and the note under the area table added 422), which
leaves 829 bytes under the limit. C5 adds a section to the root, so it has to make room first (move
something to an area file or a doc) rather than raise the limit.

Test added (2026-10-01, branch `chore/context-cost-closeout`): `scripts/check-claude-md.test.mjs`, run
by `npm run test:scripts`. The rules moved into an exported `findProblems(texts)`, which takes the files
as a map of path to text, so each rule is tested without touching the repo's own files: a clean split,
a missing root, the size limit (at the limit, one byte over, and bytes rather than characters), a folder
file with no table row, a table row with no file, a missing table section, a renamed repo-wide heading,
a heading in two files, and headings or rows inside a fenced code block. One more test runs the script
on this repo. The five failures above were produced by hand before this test existed.

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

Delivered (2026-10-01, branch `chore/claude-md-check`):

- `scripts/test-all.mjs --quiet` (`npm run test:quiet`) writes `test-results/<suite>.log` and
  `test-results/summary.txt`; the parsing is in `scripts/lib/test-summary.mjs`. `test-results/` was
  already ignored by git.
- **Passing run:** 4 lines (one per suite and a pointer to the logs), against about 1,170 lines from
  `npm test`. Measured with Docker running: 611 unit, 166 integration, 526 frontend and 20 script tests.
- **Failing run:** with Docker stopped, 26 integration tests failed and the summary was 38 lines. Every
  failing test is named. Tests that share a message (a fixture that could not start) are listed
  together with the first three lines of that message printed once, and no stack trace.
- **Backend** totals and failures are read from the `dotnet test` console output. **Frontend** results
  come from Vitest's JSON reporter (`test-results/frontend.json`), checked against a real failing test.
  Build errors (`error CS0103` and the like) are printed once each.
- **A third suite, `scripts`:** `npm run test:scripts` runs `node --test` over `scripts/**/*.test.mjs`
  (the two hooks and the summary parser, 20 tests). It is part of `npm test`, `npm run test:quiet` and
  the CI `frontend` job. Node's built-in runner adds no dependency.
- **The flag-only route was not measured.** `--verbosity quiet` and the `dot` reporter would not write
  the log files or the summary file, so the script was needed either way.
- `scripts/test-all.sh`, the older shell version of `npm test`, is unchanged and does not run the
  scripts suite; nothing calls it.

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

Delivered (2026-10-01, branch `chore/claude-md-check`): "### Keep context lean" in the root, after
"Shell commands — platform safety", with all eight points (the last two share a bullet). The heading is
on the list `check-claude-md.mjs` requires in the root.

To make room under the 14,000-byte limit, the single-stack commands moved line for line to their area
files: the backend group (`api`, `api:watch`, `lint:backend`, `test:backend`, single test class) to
`backend/CLAUDE.md`, and the frontend group (`dev`, `build`, `lint:frontend`, `test:frontend`, single
file, `lint:fix`, watch mode) to a new "Commands" section in `frontend/CLAUDE.md`. The root keeps the
all-stack commands and a pointer. This goes one step past C2, which kept the day-to-day commands in the
root: a task that touches only docs or scripts no longer sees `npm run test:backend`, and uses
`npm run test:quiet` instead. One moved line was corrected: `lint:fix` is a frontend script, so the
command is `cd frontend && npm run lint:fix`; `npm run lint:fix` from the root never existed.

Sizes after this branch: root 13,728 bytes, `backend/CLAUDE.md` 11,870, `frontend/CLAUDE.md` 5,327. The
root has 272 bytes left, so the next rule added to it has to move something out first.

## C6. Pre-rebase hook

Port `scripts/hooks/before-rebase.mjs` and its `PreToolUse` entry in `.claude/settings.json`. Before
`git rebase`, `git pull` or a force-push it reports whether the branch is on `origin` and whether a pull
request uses it, as added context; it never blocks or fails the command. In the reference repo a pull
after a rebase merged already-pushed commits back in, and the cleanup cost more than the hook.

Changes needed: the default branch is `main`, not `master`, in the message text. It uses `node` and
`gh`, both already required here.

Exit: a rebase on a branch with an open pull request shows the note; any other command shows nothing.

Delivered (2026-10-01, branch `chore/claude-md-check`): `scripts/hooks/before-rebase.mjs` and its entry
in `.claude/settings.json`, for both the Bash and PowerShell tools. Run through `bash` with the hook's
JSON on stdin: `git rebase origin/main` and `git push --force-with-lease` printed the note ("branch
... is at ... locally. It is not on origin. No pull request uses this branch."); `git status`,
`npm run lint` and the other samples printed nothing. The wording for an open and a merged pull request
is covered by `scripts/hooks/hooks.test.mjs`. Not yet seen: the note on a branch that really has an
open pull request, in a live session (this branch was not pushed when the hook was written).

Confirmed live and narrowed (2026-10-01, branch `chore/context-cost-closeout`):

- **Seen live:** a `git pull` on the unpushed branch showed "It is not on origin. No pull request uses
  this branch." After PR #146 was opened, `git push --force-with-lease` showed "It is on origin at ...
  (same commit). PR #146 is OPEN." with the advice to push with `--force-with-lease` and not pull.
- **Narrower match:** the note used to appear for any command that mentioned a rebase, a pull or a
  force-push in text, such as a pull request body or a commit message. `isRisky` now matches only where
  git is run as a command (line start, after `;`, `&`, `|` or `(`, or after `VAR=value` prefixes), and
  first empties quoted arguments, here-document bodies and PowerShell here-strings. Seen live: an
  `echo` of text naming both commands, and the `gh pr create` whose body described this change, showed
  no note. The cost: a git command passed as a quoted string (`bash -c "git pull"`) gets no note.
- **Shared code:** `scripts/hooks/command-text.mjs` holds the command-start pattern and the text
  stripping for both hooks. The blocking hook matches exactly what it did before; it does not strip
  here-documents, because a guard against data loss should err towards denying.

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

All six items are implemented and confirmed; nothing is open. The live confirmation of C1 and C6 and
the test for `check-claude-md.mjs` are recorded under each item.

**`/context` figures** (2026-10-01, `main` at `32bd907`, Claude Code 2.1.287). Measured with
`MSYS_NO_PATHCONV=1 claude -p "/context"` from the repo root: a new headless session, before any message. It reads the same
settings and memory files as an interactive session; the tool and skill lists of an interactive session
differ a little, so its total will not match to the token.

| Category | Tokens at session start |
|---|---|
| Total | 22.4k |
| System tools | 9k |
| Memory files | 5.4k (root `CLAUDE.md`; the memory index adds 66 tokens) |
| Skills | 3.9k (21 skills, none from the Vercel plugin) |
| System prompt | 2.7k |
| MCP tools and server instructions | 1.3k |

Deferred tools (26.2k, loaded only when a tool is fetched) are listed by `/context` but are not part of
the total. The "before" figure can no longer be measured on this machine (the split and the plugin
setting are merged); the file sizes in C2 stand in for it. The root measures about 2.5 bytes per token
(13,728 bytes, 5.4k tokens), not the 4 assumed in "Where this repo stands". At that rate the old 31.6 KB
root would have been about 12k tokens (an estimate, not a measurement) where 5.4k load now, before the
Vercel plugin's skill descriptions are counted.

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
