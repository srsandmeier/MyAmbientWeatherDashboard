---
name: dependabot-combine
description: Combine the open Dependabot pull requests into one branch and one PR — list them, keep those whose CI passed, apply the exact versions each PR tested, check licences, run lint and tests, and open the PR that replaces them. Use when the user types /dependabot-combine or asks to merge or combine Dependabot updates.
disable-model-invocation: true
---

# dependabot-combine

1. **List them:** `gh pr list --author app/dependabot --state open --json number,title,headRefName,files`.
   For each, read only its failing checks
   (`gh pr view <n> --json statusCheckRollup --jq '[.statusCheckRollup[] | select(.conclusion=="FAILURE") | .name]'`).
   Leave out any PR with a failing check, a major bump, or a package that is deprecated or not MIT,
   Apache 2.0 or BSD-3-Clause; say why in the summary.
2. **Branch** from `origin/main`: `chore/dependabot-<yyyy-mm>[-b]`.
3. **Apply the exact versions each PR tested**, never newer ones:
   - NuGet: edit the version in the `.csproj` or `backend/Directory.Build.props` the PR changed.
   - npm direct dependency: `npm install --prefix <dir> <pkg>@<exact version> ...` for all of them at once,
     then check `package.json` kept its caret range.
   - npm indirect dependency (a security group PR): `npm update --prefix <dir> <pkg>`, then confirm the lock
     holds the PR's version.
   - A PR that is the only change to a lock file can be taken as is: `git checkout <pr-branch> -- <files>`.
4. **Verify:** `npm run lint` and `npm run test:quiet`; read `test-results/summary.txt`. Integration tests
   need Docker; if it is not running, say so and leave them to CI.
5. **Self-review:** `npm run self-review` and fix any `FAIL`.
6. **Commit** `chore(deps): combine <n> Dependabot updates`, listing each package `old -> new`, then push
   and open one PR whose body has a table of the replaced PRs. Close the originals only after it merges.
