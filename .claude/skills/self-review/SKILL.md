---
name: self-review
description: Check the branch against the misses recorded in docs/LESSONS_LEARNED.md; use before review agents, /code-review, or opening a pull request.
---

# self-review

A review should find new problems, not the ones we already know we make. Run this first. It takes
under a second and runs no build and no tests.

```bash
npm run self-review              # first run on a branch: checks, weakest items, checklist
npm run self-review -- --quiet   # every later run on the branch: checks only
```

## Reading the output

- `FAIL` is a required check and exits 1. Fix it before anything else.
- `WARN` is advisory. Fix it, or say in the pull request why it does not apply.
- A check that passed prints nothing; the last line counts them.
- The checklist shows only the items for the areas the branch changed. Answer each one against the
  diff. A "no" is fixed before review.
- It names the sections of `docs/LESSONS_LEARNED.md` for those areas. Read those sections, not the
  file.

What each check looks for is in the header of `scripts/self-review.mjs` and in
`scripts/lib/self-review-rules.mjs`; it is not repeated here.

## When you are the reviewer

1. Run `npm run self-review` on the branch before reading the diff.
2. Report its `FAIL` and `WARN` lines first, before your own findings.
3. End every finding with `Lesson: <checklist item>` for the item that should have caught it, or
   `Lesson: new` when no item covers it.

## When a review finds something

In the same branch as the fix, add or update an entry in `docs/LESSONS_LEARNED.md` (its header gives the
format and the size limits). If the miss can be checked from a diff, add a rule to
`scripts/lib/self-review-rules.mjs` with a test, mark the entry `enforced`, and remove a checklist item
that the rule now answers in full. `node scripts/lessons-report.mjs` shows which checklist items to
automate first.
