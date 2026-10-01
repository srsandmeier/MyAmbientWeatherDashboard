# Quality Process Tooling Plan

Status: planned (2026-10-01). Branch: `chore/context-cost`. Nothing below is implemented yet.

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
commit hook. CI (analyzers, ESLint, the OpenAPI contract test) is the only rail, and it runs after the
work is pushed.

Some lessons already live in `CLAUDE.md` as rules: the `sed -i` data loss, the `python3` alias, the
type-predicate error, the `ApiResult` mock without `status`, the test factory that returns 500 when a
mock is missing. They have no recorded cause, no marker for whether anything enforces them, and no way
to see which keep recurring. The archived phase fix plans under `docs/archive/phases/` hold more.

---

## P1. Lessons file and its rails

Add `docs/LESSONS_LEARNED.md` in the reference format, with sections Process checklist, Backend,
Frontend, Tests and E2E, Docs and drift, and Process.

- **Seed it from the record only**: the pitfalls already written into `CLAUDE.md`, and the fix plans
  for phases 3, 6, 8, 9, 10, 11 and 12. Each entry is marked enforced (naming the hook, analyzer, lint
  rule or test) or manual. No invented entries. The privacy rule applies: no real location, station or
  deployment value in any entry.
- **Start the checklist small**: only items backed by a seeded entry. Candidates: one change per branch;
  diff and file list read before every commit; new checks seen to fail on broken code; reported
  failures reproduced before fixing; migration scaffolded with the entity change; DTO, TypeScript type
  and tests changed together; test factory updated when a handler gains a dependency; misses logged.
- **Port `scripts/lessons-report.mjs`** (path changed, otherwise as is), with `--check` and `--json`.
- **Tests** in `scripts/__tests__/lessons.test.mjs`, run by Node's built-in test runner
  (`node --test`), so no package is added: entry format, citations exist, size cap, markers present,
  and the ranking on synthetic input. Add one step to the `frontend` CI job, which already has Node.
- **Size cap 24 KB**, read by section (`grep -n "^## "` lists them).

Exit: the report runs and lists no unknown citation; each test was seen to fail on a broken file.

## P2. Self-review script and skill

Add `scripts/self-review.mjs`, `npm run self-review`, and `.claude/skills/self-review/SKILL.md`.
Compare against the merge base with `main`; `SELF_REVIEW_BASE` overrides it so checks can be tried on a
slice of history. Rules that take a file list live as pure functions in
`scripts/lib/self-review-rules.mjs` so they can be tested on synthetic input.

It must stay fast: no `dotnet build`, no test run. It checks only what nothing else catches early.

| Check | Level | Why here |
|---|---|---|
| No control characters in changed files | Required | A `\b` written through a script becomes a backspace; ported as is |
| No CRLF in changed files | Required | The LF rule; cheaper than finding it in a diff |
| `lessons-report --check` and the lessons tests pass | Required | Keeps P1's rails on every branch |
| Every controller has a class-level `[EnableRateLimiting]` | Required | `CLAUDE.md` says never leave one without, and there is no global fallback. No test checks it today. Needs an allow-list if any controller is exempt by design; settle that on the first run |
| Branch scope: over 25 files, or many areas | Advisory | One change per branch |
| Entity or `DbContext` configuration changed, nothing new under `Infrastructure/Migrations/` | Advisory | Integration tests catch it, but only after a full Testcontainers run |
| A DTO changed, nothing under `frontend/src/types/` or `docs/openapi.json` changed | Advisory | "Every public API change updates backend DTO + frontend TypeScript type + tests" |
| `docs/openapi.json` changed with no backend change | Advisory | It is generated (`npm run swagger:generate`); a hand edit is lost on the next run |
| A handler, validator, service, component or hook added with no test file added or changed | Advisory | "Test everything" |
| Review-fix commits on the branch, lessons file unchanged | Advisory | The lessons loop |
| Commits name a phase, nothing under `docs/` changed | Advisory | Phase closeout documentation |
| A `CLAUDE.md` or `AGENTS.md` added, moved or deleted | Advisory | Points to the live loading check in the context plan (C3) |

Left out, with reasons: the design-note check and the aria-outline check (no design-review skill or
outline files here), and a hard-coded-location scan. A scan for coordinate or postcode-shaped literals
would serve the privacy rule, but it needs a trial on real history first to see its false-positive
rate; that trial is a step of this item, and the check is added as advisory only if it is usable.

Rules that analyzers or ESLint already enforce (no underscores in test names, no hex colours, no `any`)
are not repeated.

Exit: under 20 seconds on a typical branch; each rule function seen to fail on synthetic input; run on
three past branches with `SELF_REVIEW_BASE`, with any false warning fixed or the check dropped.

## P3. Put it in the path of every review

- **Pull request template** (`.github/pull_request_template.md`): what and why; self-review passes;
  lint and tests pass; checklist answered; new checks seen to fail on broken code; misses recorded;
  the EF migrations check for phase closeouts. Dependabot pull requests do not use the template.
- **Review agents** (`architect`, `security`, `performance`, `domain-ux`, `qa-engineer`): a first
  section, "Reviewing a branch: self-review first", that runs the script and reports its failures
  before anything else, and a findings format where every finding carries a `Lesson:` tag.
- **`CLAUDE.md`**: three or four lines in the root: run self-review before review agents or
  `/code-review`; read only your area's section of the lessons file; log every miss in the same branch.
  The root stays inside the size limit set by the context plan.
- **CI**: self-review's required checks run in the `frontend` job. Advisory checks stay local.

Exit: a review agent started on a branch that fails self-review reports that first.

## P4. Later, if the first three prove useful

| Item | What | When |
|---|---|---|
| Prove-tests | Port `scripts/prove-tests.mjs`: put an old bug back, run the test that should catch it, restore the file. The `cmd` form already runs any command, so it works for `dotnet test --filter` and Vitest | When "new checks proven" has been missed once |
| Review rounds | A `Review rounds: N` line in the template and a script that reads merged pull requests with `gh` | When there are enough pull requests after P3 to compare |
| Pre-PR gate | One command for self-review, lint, both test suites and E2E P0, with a summary file. The quiet test runner in the context plan (C4) is most of it | After C4 lands |
| Pre-commit hook | Self-review's required checks only; no build or tests, so it stays under a few seconds | Only if required checks keep failing in CI |
| Quarterly prune | Merge duplicate entries; retire ones whose enforced check has not fired | When the file nears its cap |

---

## Order and verification

P1, then P2, then P3, one branch each. P2 needs P1's file and report. P3's `CLAUDE.md` lines fit best
after the per-folder split in the context plan (C2), so do C2 first if both plans go ahead; nothing
else depends on that plan.

Measure: review rounds per pull request (a round is a review pass whose findings needed a fix commit),
counted by hand for the first few pull requests after P3. The target is at most one.

Each branch: `npm run lint`, `npm test`, and the new `node --test` step. No application code, schema or
public API changes, so no EF migration and no DTO or TypeScript type updates are expected. Closeout
still runs the migration check:
`dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.

## Related docs

| Doc | Notes |
|---|---|
| [`CONTEXT_COST_PLAN.md`](CONTEXT_COST_PLAN.md) | Session cost; C2 to C4 are referenced above |
| [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) | Phase status; linked from its Related Documentation table |
| [Node.js test runner](https://nodejs.org/api/test.html) | Runs the script tests without a new dependency |
| [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills) | Format of the `self-review` skill file |
