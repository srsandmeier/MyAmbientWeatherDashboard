---
name: release-ci
description: CI, Docker, deployment artifacts, dependencies and merge readiness — the GitHub Actions workflows, docker-compose, Dependabot updates, licence and deprecation checks, and the pre-PR gate. Use when a CI job or build fails, when changing a workflow, docker-compose or a dependency, when combining Dependabot pull requests, or before asking whether a branch is ready to merge.
model: sonnet
skills:
  - self-review
  - dependabot-combine
---

# Release and CI

## Reviewing a branch

Report `self-review` failures before your own findings.
Findings format: `docs/AGENT_GUIDELINES.md`.

## What runs where

- **`.github/workflows/ci.yml`** runs three jobs in parallel on every PR and push to `main`:
  - `backend`: restore, build, `dotnet format whitespace --verify-no-changes`, then unit and integration
    tests (Testcontainers needs Docker on the runner).
  - `frontend`: `tsc -b`, ESLint, the CLAUDE.md split check, the agents and skills check, token contrast,
    `self-review --required`, the repo-script tests, Vitest and the production build.
  - `e2e`: a matrix of P0 and P1, each against the Vite dev server with every BFF and Auth0 call mocked.
    One retry in CI; a test that passes on its retry is flaky and gets an issue.
- **`codeql.yml`** (C#, TypeScript, Actions), **`deploy.yml`** (build artifacts on `main`), **`pages.yml`**,
  and **`dependabot-auto-merge.yml`** (auto-merge only for a labelled patch bump).
- **Local:** `npm run pre-pr` runs what CI runs, with totals in `test-results/summary.txt`. After the branch
  is pushed, CI is the gate: run `npm run pre-pr:after-push` (only what CI does not report: self-review's
  advisory warnings and checklist) and read `gh pr checks <number>`.
- **docker-compose:** PostgreSQL 16 and Redis 7 with health checks; the integration tests start their own
  containers.

## Rules

- Runtimes: .NET 10, Node 24 LTS, PostgreSQL 16, Redis 7 (root `CLAUDE.md`, "No deprecated dependencies").
  A setup action or image pins a supported LTS, never an end-of-life one.
- Every package is MIT, Apache 2.0 or BSD-3-Clause, maintained and not deprecated. Check before adding.
- Secrets come from `${{ secrets.* }}` or User Secrets, never from a workflow file, compose file or
  `appsettings.json`.
- Caches key on lock files (`package-lock.json`, the project files for NuGet) so a dependency change
  invalidates them.
- A failing job is read from its log summary first (`gh run view --log-failed`), not the whole log.

## Must NOT do

- Bypass a hook or a required check (`--no-verify`, `continue-on-error` on a gate).
- Merge a Dependabot bump whose CI has not run on the exact versions being merged.
- Add a paid service or a package outside the allowed licences without updating the development plan
  and getting confirmation.
