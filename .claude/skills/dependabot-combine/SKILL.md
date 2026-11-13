---
name: dependabot-combine
description: Combine the open Dependabot pull requests into one branch and one PR — list them, re-check the open ignore-review issue, pick up earlier closed or ignored updates still not applied, record why any is left out, keep those whose CI passed, apply the exact versions each PR tested, check licences, run lint and tests, and open the PR that replaces them. Use when the user types /dependabot-combine or asks to merge or combine Dependabot updates.
disable-model-invocation: true
---

# dependabot-combine

1. **List them:** `gh pr list --author app/dependabot --state open --json number,title,headRefName,files`.
   For each, read only its failing checks
   (`gh pr view <n> --json statusCheckRollup --jq '[.statusCheckRollup[] | select(.conclusion=="FAILURE") | .name]'`).
   Leave out any PR with a failing check, a major bump, or a package that is deprecated or whose licence
   is not on the root `CLAUDE.md` "Keep it free" list. Record why on the PR itself, so later runs show it:
   `gh pr comment <n> --body "Left out: <reason>"`, and say it in the summary. To stop a recurring bump, add
   an `ignore` rule to `.github/dependabot.yml` with a comment above it giving the reason and when to remove
   it (`npm run lint:dependabot` fails on a rule without one); the monthly `dependabot-ignore-review`
   workflow re-checks every rule and lifts one that blocks a high fix.
2. **Ignore review issue:** `gh issue list --label dependabot-ignore-review --state open --json number,body`.
   For each reason under "Reasons to re-check", test whether it still holds against the registry (peer
   ranges with `npm view <pkg> peerDependencies`, licences, target framework). A cleared reason: remove the
   rule and take the update in this branch. Comment the verdict for every rule on the issue, then close it;
   the next monthly run opens a new one.
3. **Earlier skipped updates:** `node scripts/list-skipped-dependabot.mjs` lists closed, unmerged Dependabot
   PRs whose version the repo still lacks and no open PR carries, with what ignores each one:
   - `nothing (unhandled)`: take it like an open PR (same checks as step 1), at the version the table shows.
   - `rule ...`: already judged in step 2.
   - `left out: <reason>`: a PR an earlier run left out. Re-check the reason; take the update if it has
     cleared, else leave it.
   - `comment "ignore ..."`: an `@dependabot ignore` that `dependabot.yml` does not show. Either take the
     update, or move it into `dependabot.yml` as a rule with a reason, then comment `@dependabot unignore <pkg>`
     on that PR so the ignore lives in one place.
   - Any row left as it is without a reason yet gets a `Left out: <reason>` comment on its PR.
   List every row and its outcome in the summary and the PR body.
4. **Branch** from `origin/main`: `chore/dependabot-<yyyy-mm>[-b]`.
5. **Apply the exact versions each PR tested**, never newer ones:
   - NuGet: edit the version in the `.csproj` or `backend/Directory.Build.props` the PR changed.
   - npm direct dependency: `npm install --prefix <dir> <pkg>@<exact version> ...` for all of them at once,
     then check `package.json` kept its caret range.
   - npm indirect dependency (a security group PR): `npm update --prefix <dir> <pkg>`, then confirm the lock
     holds the PR's version.
   - A PR that is the only change to a lock file can be taken as is: `git checkout <pr-branch> -- <files>`.
6. **Verify:** `npm run lint` and `npm run test:quiet`; read `test-results/summary.txt`. Integration tests
   need Docker; if it is not running, say so and leave them to CI.
7. **Self-review:** `npm run self-review` and fix any `FAIL`.
8. **Commit** `chore(deps): combine <n> Dependabot updates`, listing each package `old -> new`, then push
   and open one PR whose body has a table of the replaced PRs. Close the originals only after it merges.
