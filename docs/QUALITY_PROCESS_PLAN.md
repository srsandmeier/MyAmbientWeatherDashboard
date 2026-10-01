# Quality Process Tooling Plan

Status: P1, P2 and P3 delivered (2026-10-01, one branch, `chore/quality-process`, at the owner's
request; the plan had one branch for each). P4 stays optional. Each item below ends with a "Delivered"
note. Revised the same day, after the context plan was completed, to use what that plan delivered and
to keep this tooling cheap to run and free of repeated text (see "Cost and reuse limits").

Goal: fewer review rounds and no repeated misses. A branch is checked against the mistakes we already
know we make before anyone reviews it, and every miss a review does find is recorded with its cause and
either automated away or added to a short checklist.

Source: the `inclusive-travel-navigator` repo (sections Q6 and Q7 of its
`docs/quality-hardening-plan.md`, its `scripts/self-review.mjs`, `scripts/lessons-report.mjs` and
`docs/lessons-learned.md`), adapted to this stack. Companion plan for session cost:
[`CONTEXT_COST_PLAN.md`](CONTEXT_COST_PLAN.md).

---

## How it works in the reference repo

**The lessons file** holds one entry per miss, in a fixed shape: `- **Miss:**` what went wrong,
`**Cause:**` why (not a restatement), `**Prevention:**` what stops it now, ending `(enforced: …)` or
`(manual)`. Entries are grouped by area. Near the top, between two HTML comment markers, is a process
checklist: one bold-named item for each kind of miss that cannot yet be checked by a machine.

**The loop** has five steps:

1. A review, a test or a person catches a miss.
2. The reviewer tags the finding `Lesson: <checklist item>` (the item that should have caught it) or
   `Lesson: new`.
3. The fix adds or updates an entry in the same branch.
4. If the prevention can be checked automatically it moves into the self-review script, a guard test or
   a shared component, and the entry says "enforced". Otherwise it says "manual" and the checklist
   gets an item.
5. A report ranks checklist items by how many entries cite them without an enforced check, so the
   weakest items are automated first.

**The rails** keep the loop from decaying:

| Rail | What it does |
|---|---|
| Format test | Every entry has a cause and a prevention marked enforced or manual |
| Citation test | An entry may cite only a checklist item that exists |
| Size cap (24 KB) | The file is pruned rather than grown, and is read one section at a time |
| Weak-item report | Counts entries per checklist item, weakest first; lists entries that are manual and cite no item |
| Self-review warning | Review-fix commits on a branch with the lessons file unchanged |
| Checklist markers | Self-review prints the checklist straight from the file, so there is one list |

**Self-review** is one Node script, about five to twenty seconds, no build. It diffs the branch
against its merge base and runs required checks (exit 1) and advisory checks (warn), prints one
`PASS`/`WARN`/`FAIL` line each, then the top three weak items and the checklist. `--quiet` skips the
checklist on reruns. It is wrapped in a skill, runs first in the pre-PR gate, and the review agents run
it before anything else and report its failures first.

## What this repo has today

Nothing does this job. There is no lessons file, no self-review step, no pull request template and no
commit hook. CI (analyzers, ESLint, the OpenAPI contract test) runs after the work is pushed. The
context plan added three rails that run earlier: the Claude Code hook that denies `sed -i` and `python3`
(`scripts/hooks/block-unsafe-shell.mjs`), the `CLAUDE.md` split check (`npm run lint:claude-md`), and
a test runner for repo scripts (`npm run test:scripts`, also a CI step).

Some lessons already live in `CLAUDE.md` as rules: the `sed -i` data loss, the `python3` alias, the
type-predicate error, the `ApiResult` mock without `status`, the test factory that returns 500 when a
mock is missing. The first two are now enforced by the hook. None has a recorded cause, a marker for
whether anything enforces it, or a way to see which keep recurring. The archived phase fix plans under
`docs/archive/phases/` hold more.

---

## Cost and reuse limits

This tooling runs in every session that prepares a branch, so it follows the context plan's rules and
the repo's DRY rule. Each item below is built to these limits; an exit criterion names the ones that can
be measured.

**Cost**

- **Output is short.** A passing self-review prints under 20 lines: one line for each `WARN` or `FAIL`,
  and one totals line for the checks that passed. The checklist and the weak items are printed on the
  first run of a branch and skipped with `--quiet` on reruns.
- **Nothing is added to what always loads beyond one line in the root `CLAUDE.md` and one skill
  description.** The root has 272 bytes free under the 14,000-byte limit; the line is at most 200 bytes
  and the detail lives in the skill, which loads only when it runs. The skill description is one
  sentence.
- **The lessons file is read by section**, never whole, and is capped at 24 KB, with 6,000 bytes a
  section and 600 bytes an entry.
- **The checklist is filtered, not printed whole.** Each item carries the areas it applies to, and
  self-review prints only the items for the areas the branch changed. The checklist holds at most 12
  items of at most 200 characters; an item that a check now covers in full is removed.
- **Self-review runs no build and no tests.** Tests for the tooling run in `npm run test:scripts`, which
  `npm run test:quiet` and CI already call. Each branch is verified with `npm run test:quiet`, not
  `npm test`.

**Reuse**

- **One statement of each rule.** A lessons entry seeded from a `CLAUDE.md` rule names the file and
  heading and adds only the cause and what enforces it; it does not restate the rule.
- **One description of the review step.** How to run self-review and report its findings is written
  once, in the skill file. The review agent files point to it.
- **No check that something else already makes.** Before a check is added, look for a git attribute,
  analyzer, lint rule, hook or existing script that covers it.
- **Shared script code is imported, not copied:** tests sit next to their file as `*.test.mjs` (the
  pattern `npm run test:scripts` picks up), and the pre-PR gate builds on `scripts/test-all.mjs` and
  `scripts/lib/test-summary.mjs`.

---

## P1. Lessons file and its rails

Add `docs/LESSONS_LEARNED.md` in the reference format, with sections Process checklist, Backend,
Frontend, Tests and E2E, Docs and drift, and Process.

- **Seed it from the record only**: the pitfalls already written into `CLAUDE.md`, and the fix plans
  for phases 3, 6, 8, 9, 10, 11 and 12. Each entry is marked enforced (naming the hook, analyzer, lint
  rule or test) or manual. No invented entries. The privacy rule applies: no real location, station or
  deployment value in any entry.
- **Point to rules, do not copy them**: an entry for a pitfall that `CLAUDE.md` already states gives the
  file and heading as its miss, then the cause and the prevention. The `sed -i` and `python3` entries
  are enforced by `scripts/hooks/block-unsafe-shell.mjs`.
- **Start the checklist small**: only items backed by a seeded entry. Candidates: one change per branch;
  diff and file list read before every commit; new checks seen to fail on broken code; reported
  failures reproduced before fixing; migration scaffolded with the entity change; DTO, TypeScript type
  and tests changed together; test factory updated when a handler gains a dependency; an existing
  handler, hook, mapper or component searched for before a new one is added (the DRY rule); misses
  logged. An item that only repeats a `CLAUDE.md` rule is worded as the question to answer and names
  the heading.
- **Port `scripts/lessons-report.mjs`** (path changed, otherwise as is), with `--check` and `--json`.
- **Tests** in `scripts/lessons-report.test.mjs`, next to the script: entry format, citations exist,
  size cap, markers present, and the ranking on synthetic input. `npm run test:scripts` and its CI step
  already run every `scripts/**/*.test.mjs`, so no package, script or CI step is added.
- **Size cap 24 KB**, read by section (`grep -n "^## "` lists them).

Exit: the report runs and lists no unknown citation; each test was seen to fail on a broken file; no
entry restates a rule that `CLAUDE.md` holds.

Delivered (2026-10-01, branch `chore/quality-process`; the counts are as P1 left them, before P2 added
two entries and removed one checklist item):

- **`docs/LESSONS_LEARNED.md`:** 23 entries and 9 checklist items, 12.4 KB of the 24 KB cap. Sources:
  the pitfalls in the root, backend and frontend `CLAUDE.md` files (9 entries), the Phase 3 fix plan
  (5), the carry-in sections of the Phase 8 and Phase 10 plans (3), and the context plan's delivery
  notes (5), plus one for the loop itself. The Phase 6, 9, 11 and 12 plans were read and gave no entry:
  their carry-in lists are deferred work and decisions, not misses with a recorded cause.
- **Checklist differs from the candidates.** Kept: new checks proven, failures reproduced, migration,
  contract, test factory, reuse, misses logged. Added because two or more entries back them: "Docs
  match the code" and "Nothing secret logged". Left out because no recorded miss backs them: "one
  change per branch" and "diff and file list read before every commit". P2's branch-scope check does
  not depend on a checklist item.
- **`scripts/lessons-report.mjs`** is the reference script with single quotes and this repo's path.
  Two changes from "as is". The rails moved into an exported `findProblems(text)`, the shape
  `check-claude-md.mjs` uses, so `--check` covers format, citations, sizes and markers and each rail is
  tested on synthetic text. And `--checklist <areas>` prints the checklist items for those areas.
- **Kept lean and usable in self-review** (asked for during the work). Limits held by `--check`:
  6,000 bytes a section (the unit a session reads), 600 bytes an entry, 12 checklist items, 200
  characters an item so it prints on one line. Every item is a yes-or-no question about the branch and
  carries an area tag (`all`, `backend`, `frontend`, `e2e`, `docs`). For a docs-only branch
  `--checklist docs` prints 4 of the 9 items.
- **Tests:** `scripts/lessons-report.test.mjs`, 17 tests, run by `npm run test:scripts`. No package,
  script or CI step was added.
- **Seen to fail:** `findProblems` was run on twelve broken copies of the real file (cause removed,
  ending removed, unknown citation, start marker removed, loop item removed, area tag removed, unknown
  area, file over 24 KB, section over 6,000 bytes, entry over 600 bytes, 13 items, an item over 200
  characters). Each was reported; the unchanged file passed. The tests found two defects in the first
  version: the entry size counted a trailing newline, and the label of an entry with no cause ran on
  into its prevention.
- **Report now:** 9 entries cite no checklist item; 4 of those are not fully enforced (the E2E text
  locator, PowerShell quoting, Git Bash path rewriting, and the nested `<main>` on routes without an
  axe audit). The weakest item is "Docs match the code" (3 manual entries).
- **Causes are read from the record.** Where a fix plan gave only the fix, the cause is what the fix
  implies and no more; misses whose cause could not be read from the record were left out (for
  example the Phase 3 development-identity fix and the Phase 8 primary-station fix).

## P2. Self-review script and skill

Add `scripts/self-review.mjs`, `npm run self-review`, and `.claude/skills/self-review/SKILL.md`.
Compare against the merge base with `main`; `SELF_REVIEW_BASE` overrides it so checks can be tried on a
slice of history. Rules that take a file list live as pure functions in
`scripts/lib/self-review-rules.mjs` so they can be tested on synthetic input, with their tests in
`scripts/lib/self-review-rules.test.mjs`.

It must stay fast: no `dotnet build`, no test run. It checks only what nothing else catches early.

Output follows the quiet test runner: one line for each `WARN` or `FAIL`, one totals line for the checks
that passed, then the top three weak items and the checklist. The checklist is not printed whole: the
script maps the changed files to areas (`backend`, `frontend`, `e2e`, `docs`) and prints
`checklistFor(text, areas)` from `scripts/lessons-report.mjs`, so a docs-only branch sees 4 items, and
it names the lessons section to read for each area. An item whose advisory check ran on the branch
(migration, contract) is replaced by that check's line. `--quiet` skips the weak items and the
checklist; the skill uses it on every run after the first on a branch. The skill's description, which loads in every session,
is one sentence; the instructions are in its body.

| Check | Level | Why here |
|---|---|---|
| No control characters in changed files | Required | A `\b` written through a script becomes a backspace; ported as is |
| `lessons-report --check` passes | Required | Keeps P1's rails on every branch. The lessons tests are not run here; `npm run test:scripts` runs them |
| Every controller has a class-level `[EnableRateLimiting]` | Required | `CLAUDE.md` says never leave one without, and there is no global fallback. No test checks it today. Needs an allow-list if any controller is exempt by design; settle that on the first run |
| Branch scope: over 25 files (the "many areas" half was dropped after the trial; see "Delivered") | Advisory | One change per branch |
| Entity or `DbContext` configuration changed, nothing new under `Infrastructure/Migrations/` | Advisory | Integration tests catch it, but only after a full Testcontainers run |
| A DTO changed, nothing under `frontend/src/types/` or `docs/openapi.json` changed | Advisory | "Every public API change updates backend DTO + frontend TypeScript type + tests" |
| `docs/openapi.json` changed with no backend change | Advisory | It is generated (`npm run swagger:generate`); a hand edit is lost on the next run |
| A handler, validator, service, component or hook added with no test file added or changed | Advisory | "Test everything" |
| Review-fix commits on the branch, lessons file unchanged | Advisory | The lessons loop |
| Commits name a phase, nothing under `docs/` changed | Advisory | Phase closeout documentation |
| A `CLAUDE.md` added, moved or deleted | Advisory | Prints a reminder to run the live loading check (`node scripts/check-instructions-loading.mjs --all`), which makes model calls and so is not in lint. It does not re-check the area table or sizes; `npm run lint:claude-md` does that |
| A line of 60 or more characters that is in three or more `.claude/agents/*.md` files, or in a skill file and an agent file | Required | Shared text has one home: the root `CLAUDE.md`, an area `CLAUDE.md` or a skill. A line that only points to a file is exempt. See "Agents and skills audit" |
| An added `queryKey: [` that does not start from `queryKeys`, in a frontend file that is not a test | Advisory | The DRY rule: query keys come from `frontend/src/lib/queryKeys.ts`. An array that spreads a shared key (`[...queryKeys.x(), …]`) is fine. No line in `frontend/src` breaks this today |

The query-key check is the one DRY rule cheap enough to check from a diff. The other centralised
definitions in the DRY rule (`MetricDefinition`, unit conversion, Ambient field mappings, one API client
function for each endpoint, one chart option builder) have no reliable text pattern; they stay with the
checklist item in P1 and with review. P4 lists a copy-paste detector for later.

Left out, with reasons: the design-note check and the aria-outline check (no design-review skill or
outline files here), a CRLF check (`.gitattributes` has `* text=auto eol=lf`, so git already stores
every text file with LF), and a hard-coded-location scan. A scan for coordinate or postcode-shaped literals
would serve the privacy rule, but it needs a trial on real history first to see its false-positive
rate; that trial is a step of this item, and the check is added as advisory only if it is usable.

Rules that analyzers or ESLint already enforce (no underscores in test names, no hex colours, no `any`)
are not repeated.

Exit: under 20 seconds on a typical branch; a passing run prints under 20 lines with `--quiet`; each
rule function seen to fail on synthetic input; run on three past branches with `SELF_REVIEW_BASE`, with
any false warning fixed or the check dropped.

Delivered (2026-10-01, branch `chore/quality-process`):

- **Files:** `scripts/self-review.mjs`, `npm run self-review`, the rules in
  `scripts/lib/self-review-rules.mjs` with 17 tests next to them, and
  `.claude/skills/self-review/SKILL.md` (the repo's first skill; its description is one sentence).
- **Cost:** 0.3 seconds on this branch. `--quiet` prints one line when everything passes. A passing
  check prints nothing. The first run on a docs and scripts branch prints 12 lines: the totals, the three
  weakest items, and 4 of the 8 checklist items.
- **Checks:** the four required and nine advisory checks in the table, plus one more advisory check
  from the location trial below. `--required` runs the required four over the whole repo and needs no
  git history, so CI can run it on a shallow checkout.
- **Rate limiting, settled on the first run:** seven controllers carry the attribute.
  `HealthController` is the one exemption (an anonymous liveness probe) and is named in
  `RATE_LIMIT_EXEMPT`.
- **Checklist filtering:** the script maps changed files to areas and prints `checklistFor`. The
  "Migration scaffolded" item was removed from the checklist, because the migration check answers it
  in full; this replaces the planned "item replaced by its check's line", with no list to keep in step.
- **Seen to fail:** each rule was broken in a temporary copy of `scripts/` and the tests re-run: 27 of
  28 changes were caught. The one not caught does not change behaviour (a deleted file adds no
  lines). One more was dead code, now removed. The run also showed that `--required` passed outside a
  git repository with nothing checked; it now exits 1 there. The three required checks other than the
  lessons rail were also seen to fail on temporary files in this repo, then pass once those were
  removed.
- **Trial on past branches, short of the exit:** this repo's history starts at one squashed commit, so
  only four pull requests could be replayed (#138, #144, #145 and #34), and none changes an entity, a
  DTO or a hook. The rules ran on their ranges from a scratch script (`SELF_REVIEW_BASE` moves the base,
  not the working tree). Result: #144 got the `CLAUDE.md` loading reminder, which is right. #144 and
  #145 got a "many top-level folders" scope warning; that half of the scope check was dropped, because a
  change that follows the rules (DTO, TypeScript type, tests and docs together) spans five folders. The
  file-count half stays. The migration, DTO, test and query-key checks have run on synthetic input only.
- **Location scan, kept as advisory:** over the last 150 commits (72,778 added lines) 79 lines held a
  coordinate-shaped number and 9 a postcode-shaped one. Unit-conversion constants were the false hits,
  so the check also needs the line to mention a latitude, longitude, coordinate, zip or postal code. It
  names files and never prints the value. Most of the 79 are in backend tests and look like fixed
  coordinates in fixtures; they were not changed here and are worth a separate look against the
  privacy rule.
- **Not built:** the review-agent exit in P3 (an agent reports a self-review failure first) needs a
  live agent run and was not done in this branch.

## P3. Put it in the path of every review

- **Pull request template** (`.github/pull_request_template.md`): what and why; self-review passes;
  lint and tests pass; checklist answered; new checks seen to fail on broken code; misses recorded;
  the EF migrations check for phase closeouts. Dependabot pull requests do not use the template.
- **Review agents** (`architect`, `security`, `performance`, `domain-ux`, `qa-engineer`): one line at
  the top of each file, pointing to `.claude/skills/self-review/SKILL.md`. The skill file holds the
  step once: run the script first, report its failures before anything else, and give every finding a
  `Lesson:` tag. The same section is not copied into five files.
- **`CLAUDE.md`**: one line in the root, at most 200 bytes (272 are free under the limit): run
  self-review before review agents or `/code-review`, and log every miss in the same branch. Reading
  only your area's section of the lessons file is covered by "Read in ranges" under "Keep context
  lean" and is said in the skill, not again in the root. `npm run lint:claude-md` fails if the root
  goes over.
- **CI**: self-review's required checks run in the `frontend` job. Advisory checks stay local.

Exit: a review agent started on a branch that fails self-review reports that first; the root
`CLAUDE.md` is inside its limit with nothing moved out; the review step is described in one file.

Delivered (2026-10-01, branch `chore/quality-process`):

- **Pull request template:** `.github/pull_request_template.md`, six check lines.
- **Review agents:** the same one-line pointer to the skill file is the first line of `architect`,
  `security`, `performance`, `domain-ux` and `qa-engineer`. The review step is written only in the skill
  file. The copy check lets the line through because it points to a Markdown file.
- **Root `CLAUDE.md`:** one bullet under "Rules that cross areas", 149 bytes. The root is 13,877 of
  14,000 bytes with nothing moved out.
- **CI:** a "Self-Review Required Checks" step in the `frontend` job runs
  `node scripts/self-review.mjs --required`.
- **Open:** the first exit criterion. No review agent was started on a failing branch; the skill and
  the pointer are in place, and the first review on a real branch will show whether an agent follows
  them.

## Agents and skills audit (2026-10-01)

Asked for while P1 was built: are the agent files and skills still useful, and is shared text kept in
one place and not copied into each agent?

- **Skills:** the repo has none (`.claude/skills/` does not exist), so nothing is copied yet. P2 adds
  the first, `self-review`, and P3 keeps its review step in that one file with a one-line pointer in
  five agent files.
- **Agent files:** twelve role files under `.claude/agents/`, 72 KB, with no frontmatter. They are
  read on demand and are not registered subagents, so they cost nothing until read.
- **Copied text, removed:** every agent file ended with a "Privacy — faker for all location data"
  section (five wordings, about 7 KB in all) that repeated the root rule, which already says it
  applies to every agent. Eleven files lost the section. `qa-engineer.md` keeps the two lines the root
  does not have and points to the root for the rest. No other line of 45 or more characters is in two
  agent files or in an agent file and a `CLAUDE.md`. With the stale text below gone, the agent files
  are 64.7 KB.
- **Stale text, corrected:** `qa-engineer.md` and `devops.md` still described the C# Playwright suite
  as current and the TypeScript one as a Phase 12 target; the C# project is no longer in the repo.
  `frontend.md` told tests to use MSW, which `frontend/CLAUDE.md` says is not installed. `data.md` named
  an interfaces folder that does not exist. Every other path the agent files name exists.
- **Airport line, kept (decided 2026-10-01):** one of the two lines kept in `qa-engineer.md` says a
  test that needs a geographically accurate address picks "a real US airport at random from a short
  predefined list". It reads against the root privacy rule's "no place name anywhere", but the rule
  protects a user's own location and deployment, and a public airport picked at random is neither. The
  line was in nine agent files; it is now in one, unchanged.
- **Kept from growing back:** the P2 check above. Rules that agent files paraphrase from a `CLAUDE.md`
  (`data-test-id` in three files, `RateLimitedApiClient` in four, `AsNoTracking` in three) are not
  line-for-line copies and are left; replacing them with pointers is a rewording for a later change.
- **`AGENTS.md`** (the Codex copy of the rules, 15.6 KB) is unchanged; Claude Code does not load it.

## P4. Later, if the first three prove useful

| Item | What | When |
|---|---|---|
| Prove-tests | Port `scripts/prove-tests.mjs`: put an old bug back, run the test that should catch it, restore the file. The `cmd` form already runs any command, so it works for `dotnet test --filter` and Vitest | When "new checks proven" has been missed once |
| Review rounds | A `Review rounds: N` line in the template and a script that reads merged pull requests with `gh` | When there are enough pull requests after P3 to compare |
| Pre-PR gate | One command for self-review, lint, the test suites and E2E P0, with a summary file. Built as more suites in `scripts/test-all.mjs --quiet` (the context plan's C4, delivered), not as a second runner | After P2 |
| Pre-commit hook | Self-review's required checks only; no build or tests, so it stays under a few seconds | Only if required checks keep failing in CI |
| Copy-paste detector | A duplicate-code report for `backend/src` and `frontend/src`, advisory. A candidate is `jscpd` (MIT); it is a new dev dependency, so check the licence and maintenance and get confirmation first ("Keep it free") | When the lessons file holds two or more misses caused by duplicated code |
| Quarterly prune | Merge duplicate entries; retire ones whose enforced check has not fired | When the file nears its cap |

---

## Order and verification

P1, then P2, then P3, one branch each. P2 needs P1's file and report. The context plan is complete, so
everything this plan relies on from it is in place: the per-folder split and its check, the script test
runner and the quiet test run.

Measure: review rounds per pull request (a round is a review pass whose findings needed a fix commit),
counted by hand for the first few pull requests after P3. The target is at most one. For cost, compare
`/context` at session start after P3 with the figures in the context plan's "Order and verification"
(`MSYS_NO_PATHCONV=1 claude -p "/context"`): memory files and skills together should grow by no more
than the one root line and the one skill description.

**`/context` after P3** (2026-10-01, branch `chore/quality-process`, same headless command): total
22.5k tokens against 22.4k before. The `self-review` skill description is about 50 tokens (skills 4k
against 3.9k), and the root `CLAUDE.md` still shows as 5.4k with its one new line. The memory index grew
from 66 to 112 tokens for a reason outside this plan (a second memory note). Review rounds are not yet
counted: no pull request has gone through the new path.

Each branch: `npm run lint` and `npm run test:quiet` (which includes the script tests). No application code, schema or
public API changes, so no EF migration and no DTO or TypeScript type updates are expected. Closeout
still runs the migration check:
`dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.

## Related docs

| Doc | Notes |
|---|---|
| [`CONTEXT_COST_PLAN.md`](CONTEXT_COST_PLAN.md) | Session cost (complete); its split check, script test runner, quiet test run and `/context` figures are used above |
| [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) | Phase status; linked from its Related Documentation table |
| [Node.js test runner](https://nodejs.org/api/test.html) | Runs the script tests without a new dependency |
| [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills) | Format of the `self-review` skill file |
