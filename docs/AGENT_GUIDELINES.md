# Agent and skill guidelines

How the agents (`.claude/agents/`) and skills (`.claude/skills/`) in this repo are written and kept
current. Adapted from the inclusive-travel-navigator repo (its `docs/agent-guidelines.md`), where the
same split is in use. `node scripts/check-agents-skills.mjs` (run by `npm run lint` and CI) enforces
every rule below that can be checked from the files.

## Agents vs skills vs CLAUDE.md

| | Agent | Skill | Folder `CLAUDE.md` |
|---|---|---|---|
| Is | A reviewer's or specialist's judgement: what good looks like, trade-offs, what to refuse | A repeatable procedure: exact commands, order, what to check | Facts and rules for code in that folder |
| Loads | When launched as a subagent, in its own context | When invoked, or preloaded by an agent | Automatically, when Claude works on a file in that folder |
| Changes when | Standards change | Scripts, file names or order change | The code in that folder changes |
| Example | `security` reviews a credential change | `ef-migration` scaffolds and checks a migration | `backend/src/AmbientWeather.Infrastructure/Ambient/CLAUDE.md` says how the rate limiter works |

- **Facts about code go in the folder's `CLAUDE.md`,** not in an agent. Claude Code loads it for free when
  the work is there, and the drift check compares it with the source. Implementation agents that only
  restated those facts (backend, frontend, data, api-client, realtime, charts) were folded into folder
  files in October 2026: twelve agent files had drifted to name classes, routes and workers that no
  longer existed, and none could be launched because none had a header.
- **Procedures go in skills.** When an agent grows a numbered list of commands, move it into a skill and
  preload the skill.
- **An agent earns its place** when it is worth a separate context: a review from one point of view, or
  work that reads much more than it writes.

## Every agent file has

1. **A header** (YAML front matter): `name` equal to the file name, and a `description` that says what
   the agent owns and when to use it ("Use when..."). Without a header Claude Code cannot launch the
   agent.
   - **Read-only reviewers** list their tools: `Read, Grep, Glob, Bash` (Bash runs `self-review` and the
     audit scripts; reviewers report and do not edit).
   - **`skills:`** preloads procedures: their full text is injected when the agent starts. An agent with a
     `tools` list can use only the skills it preloads (unless `Skill` is in the list), and needs `Bash`
     for a skill that runs commands. An agent with no `tools` list inherits every tool.
   - **`model:`** follows the table below.
2. **One owner per concern.** Link to the owner of a neighbouring concern instead of restating its rules.
   A line of 60 or more characters copied into several agent or skill files fails `self-review`.
3. **A "Must NOT do" section**: the mistakes this specialist exists to prevent.
4. **The findings format** below for any review.

## Model and ownership

Agents that apply written rules or checklists run on Sonnet to lower usage; the rest run on the
session's model because a miss costs a review round or more. Move an agent back to `session` if its
Sonnet output needs noticeably more correction. The check keeps this table and the headers equal.

| Agent | Model | Owns | Preloads |
|---|---|---|---|
| `architect` | session | Layer boundaries, Clean Architecture, maintainability, DRY | `self-review` |
| `security` | session | Auth, credentials, authorization, logging of secrets, OWASP | `self-review` |
| `qa-engineer` | session | Test strategy, xUnit / Vitest / Playwright, flake triage, proving tests | `self-review`, `e2e-heal` |
| `ui-ux-design` | session | Visual design, interaction, WCAG 2.2 AA, both themes, hands-on UI review | `self-review`, `ui-snapshot`, `a11y-audit`, `contrast-tokens` |
| `performance` | sonnet | Query shape, caching, bounded work, rate-limit traffic | `self-review` |
| `domain-ux` | sonnet | Weather-station owner's view: what values mean, flows, missing data | `self-review` |
| `release-ci` | sonnet | CI, Docker, deploy, dependencies, merge readiness | `self-review`, `dependabot-combine` |

Skills with no owning agent are used by the main session: `api-change`, `ef-migration` and
`phase-closeout`.

## Findings format (all reviews)

Lead with a one-line verdict, then findings ranked by severity:

- **Blocker:** data is lost or exposed, a secret leaks, or a user cannot complete the task. Fix before merge.
- **Major:** a rule in a `CLAUDE.md` is broken, a WCAG AA failure, a wrong value shown, or untested code.
- **Minor:** friction, inconsistency, or a small gap that does not mislead.
- **Polish:** refinement.

Each finding gives where (`file:line`), what the user or the next developer experiences, the rule it
breaks, a specific fix, and **Lesson:** the checklist item in `docs/LESSONS_LEARNED.md` that should have
caught it, or `Lesson: new`. Mark uncertain findings as uncertain. Keep the review to the findings: no
restating the diff.

## Keeping them current

- `npm run lint` fails when an agent, skill or `CLAUDE.md` names a script, npm script, path or class that
  is not in the repo. Fix the document in the same change that renames or removes the code.
- At each phase closeout (`phase-closeout`), reread the agents and skills the phase touched.
- Prefer pointing to a script or test that enforces a rule over restating numbers that change.
