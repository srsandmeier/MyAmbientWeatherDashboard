// Tables and checks for the dependabot-combine skill.
//
//   node scripts/list-skipped-dependabot.mjs                  # closed updates still not applied (Markdown)
//   node scripts/list-skipped-dependabot.mjs --open           # open Dependabot PRs: bump class, CI, commits
//   node scripts/list-skipped-dependabot.mjs --verify <json>  # check the repo holds each taken version
//   node scripts/list-skipped-dependabot.mjs --limit 300      # read more closed PRs (default 200)
//
// Skipped: reads the closed, unmerged Dependabot pull requests (gh CLI), takes each package and the
// version the PR proposed, and keeps those where the repo is still below that version and no open
// Dependabot PR for the same ecosystem and directory carries it at that version or higher. Each row
// says whether an ignore rule in .github/dependabot.yml covers it, an `@dependabot ignore` comment on
// the PR does (those are invisible in dependabot.yml), or the skill left it out with a
// `Left out: <reason>` comment. Only comments by the repo owner, members and collaborators count: the
// repo is public and anyone can comment.
//
// Verify: <json> is an array of { ecosystem, directory, name, to }. Fails when any NuGet reference,
// workflow `uses:` or lock entry differs from `to`, when a lock entry resolves from a host other than
// registry.npmjs.org, or when a lock package that is new or changed against origin/main has a licence
// outside the allowed list (root CLAUDE.md, "Keep it free").

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG_FILE, compareVersions, installedPackages, matchesPattern, packageVersions, parseIgnoreRules, parseVersion, ruleIgnores } from './check-dependabot-ignores.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH_ECOSYSTEM = { nuget: 'nuget', npm_and_yarn: 'npm', github_actions: 'github-actions' };
const VERSION = String.raw`v?\d[\w.+-]*?`;
export const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
export const ALLOWED_LICENCES = new Set(['MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'BlueOak-1.0.0']);
const NPM_REGISTRY = 'https://registry.npmjs.org/';
const MAX_REASON = 200;
const OPEN_LIMIT = 30;

/** The `package-ecosystem` / `directory` pairs of a dependabot.yml, in file order. */
export function parseUpdateEntries(text) {
  const entries = [];
  for (const match of text.matchAll(/package-ecosystem:\s*["']?([\w-]+)["']?\s*\n\s*directory:\s*["']?([^"'\n]+)["']?/g)) {
    entries.push({ ecosystem: match[1] === 'npm' ? 'npm' : match[1], directory: match[2].trim() });
  }
  return entries;
}

/** Ecosystem and directory of a Dependabot branch such as `dependabot/npm_and_yarn/frontend/vitest-5.1.0`. */
export function branchTarget(headRefName, entries) {
  const segments = headRefName.split('/');
  const ecosystem = BRANCH_ECOSYSTEM[segments[1]];
  if (segments[0] !== 'dependabot' || !ecosystem) return null;
  const candidates = entries.filter((entry) => entry.ecosystem === ecosystem);
  const byDirectory = candidates.find((entry) => {
    const dir = entry.directory.replace(/^\/|\/$/g, '');
    return dir !== '' && headRefName.includes(`/${dir}/`);
  });
  // A branch with no directory segment belongs to the root entry (`dependabot/npm_and_yarn/pkg-1.0.0`).
  const entry = byDirectory ?? candidates.find((e) => e.directory.replace(/\/$/, '') === '') ?? candidates[0];
  return entry ? { ecosystem, directory: entry.directory } : null;
}

/** Package updates a Dependabot PR proposed: [{ name, from, to }], from its body, else its title. */
export function proposedUpdates(title, body = '') {
  const found = new Map();
  const patterns = [
    new RegExp(String.raw`Updates \`([^\`]+)\` from (${VERSION}) to (${VERSION})(?=[.\s]*(?:\s|$))`, 'g'),
    new RegExp(String.raw`Bumps \[([^\]]+)\]\([^)]*\) from (${VERSION}) to (${VERSION})(?=[.\s]*(?:\s|$))`, 'g'),
  ];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) found.set(match[1], { name: match[1], from: match[2], to: match[3] });
  }
  if (found.size === 0) {
    const match = new RegExp(String.raw`[Bb]ump (\S+) from (${VERSION}) to (${VERSION})(?:\s|$)`).exec(title);
    if (match) found.set(match[1], { name: match[1], from: match[2], to: match[3] });
  }
  return [...found.values()];
}

/** Comments by the repo owner, members and collaborators; anyone else's text is never read as a decision. */
export function trustedComments(comments = []) {
  return comments.filter((comment) => TRUSTED_ASSOCIATIONS.has(comment.authorAssociation));
}

/** Untrusted-looking characters removed, length capped: the text goes into a Markdown table an agent reads. */
export function cleanReason(text) {
  const cleaned = text.replace(/[`<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > MAX_REASON ? `${cleaned.slice(0, MAX_REASON)}…` : cleaned;
}

/** The `@dependabot ignore ...` command a trusted commenter left on a PR, or null. */
export function ignoreCommand(comments = []) {
  for (const comment of trustedComments(comments)) {
    const match = /@dependabot (ignore this (?:major version|minor version|patch version|dependency)|ignore [^\n]+)/i.exec(comment.body ?? '');
    if (match) return cleanReason(match[1]);
  }
  return null;
}

/** The reason in the latest trusted `Left out: <reason>` comment on a PR, or null. */
export function leftOutReason(comments = []) {
  let reason = null;
  for (const comment of trustedComments(comments)) {
    const match = /^Left out:\s*(.+)$/m.exec(comment.body ?? '');
    if (match) reason = cleanReason(match[1]);
  }
  return reason;
}

/**
 * Semver class of an update: `major` when the major part changes, or when a 0.x minor changes (0.x
 * minors are breaking by semver convention); else `minor` or `patch`.
 */
export function bumpClass(from, to) {
  const [fromMajor, fromMinor] = parseVersion(from);
  const [toMajor, toMinor] = parseVersion(to);
  if (toMajor !== fromMajor) return 'major';
  if (toMinor !== fromMinor) return fromMajor === 0 ? 'major' : 'minor';
  return 'patch';
}

/**
 * CI state of a PR from its statusCheckRollup: `none` (no checks), `pending` (any not finished),
 * `pass` (every check SUCCESS, SKIPPED or NEUTRAL) or `fail: <names>`.
 */
export function ciState(rollup = []) {
  if (rollup.length === 0) return 'none';
  const passed = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);
  const failed = [];
  let pending = false;
  for (const check of rollup) {
    if (check.__typename === 'StatusContext') {
      if (['PENDING', 'EXPECTED'].includes(check.state)) pending = true;
      else if (check.state !== 'SUCCESS') failed.push(check.context ?? 'status');
    } else if (check.status !== 'COMPLETED') {
      pending = true;
    } else if (!passed.has(check.conclusion)) {
      failed.push(`${check.name} (${String(check.conclusion).toLowerCase()})`);
    }
  }
  if (failed.length > 0) return `fail: ${failed.join(', ')}`;
  return pending ? 'pending' : 'pass';
}

/** Logins other than Dependabot that authored a commit on the PR branch. */
export function foreignCommitAuthors(commits = []) {
  const others = new Set();
  for (const commit of commits) {
    for (const author of commit.authors ?? []) if (author.login !== 'dependabot[bot]') others.add(author.login || author.email || 'unknown');
  }
  return [...others];
}

const updateKey = (ecosystem, directory, name) => `${ecosystem}:${directory}:${name.toLowerCase()}`;

/**
 * Closed, unmerged Dependabot updates that the repo still does not have. One row per package (the
 * highest proposed version); an update an open Dependabot PR carries at that version or higher, for
 * the same ecosystem and directory, is left to the normal flow.
 */
export function findSkipped({ closed, open, entries, groups, installed }) {
  const openVersions = new Map();
  for (const pr of open) {
    const target = branchTarget(pr.headRefName ?? '', entries);
    if (!target) continue;
    for (const update of proposedUpdates(pr.title, pr.body)) {
      const key = updateKey(target.ecosystem, target.directory, update.name);
      if (!openVersions.has(key) || compareVersions(update.to, openVersions.get(key)) > 0) openVersions.set(key, update.to);
    }
  }

  const rows = new Map();
  for (const pr of closed) {
    if (pr.mergedAt) continue;
    const target = branchTarget(pr.headRefName ?? '', entries);
    if (!target) continue;
    const packages = installed(target.ecosystem, target.directory);
    for (const update of proposedUpdates(pr.title, pr.body)) {
      const key = updateKey(target.ecosystem, target.directory, update.name);
      if (openVersions.has(key) && compareVersions(openVersions.get(key), update.to) >= 0) continue;
      const current = packages.get(update.name)
        ?? [...packages].find(([name]) => target.ecosystem !== 'npm' && name.toLowerCase() === update.name.toLowerCase())?.[1];
      if (!current || compareVersions(current, update.to) >= 0) continue;
      const previous = rows.get(key);
      if (previous && compareVersions(previous.to, update.to) >= 0) continue;
      const rule = groups
        .filter((group) => group.ecosystem === target.ecosystem && group.directory === target.directory)
        .flatMap((group) => group.rules)
        .find((r) => matchesPattern(r.dependencyName, update.name, target.ecosystem) && ruleIgnores(r, current, update.to));
      const command = ignoreCommand(pr.comments);
      const leftOut = leftOutReason(pr.comments);
      rows.set(key, {
        pr: pr.number,
        name: update.name,
        ecosystem: target.ecosystem,
        directory: target.directory,
        installed: current,
        to: update.to,
        ignoredBy: rule ? `rule \`${rule.dependencyName}\`` : command ? `comment "${command}"` : leftOut ? `left out: ${leftOut}` : null,
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** One row per package in each open Dependabot PR, with what step 1 of the skill decides on. */
export function describeOpen({ open, entries }) {
  const rows = [];
  for (const pr of open) {
    const target = branchTarget(pr.headRefName ?? '', entries);
    const foreign = foreignCommitAuthors(pr.commits);
    const ci = ciState(pr.statusCheckRollup);
    const leftOut = leftOutReason(pr.comments);
    const autoMerge = (pr.labels ?? []).some((label) => label.name === 'automerge-dependabot');
    for (const update of proposedUpdates(pr.title, pr.body)) {
      rows.push({
        pr: pr.number,
        name: update.name,
        ecosystem: target?.ecosystem ?? '?',
        directory: target?.directory ?? '?',
        from: update.from,
        to: update.to,
        bump: bumpClass(update.from, update.to),
        ci,
        commits: foreign.length > 0 ? `also by ${foreign.map(cleanReason).join(', ')}` : 'dependabot only',
        notes: [autoMerge ? 'automerge label' : '', leftOut ? `left out before: ${leftOut}` : ''].filter(Boolean).join('; '),
      });
    }
  }
  return rows.sort((a, b) => a.pr - b.pr || a.name.localeCompare(b.name));
}

export function formatSkipped(rows) {
  if (rows.length === 0) return 'No closed Dependabot update is still pending.';
  const out = [
    '| PR | Package | Directory | Installed | Proposed | Ignored by |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    out.push(`| #${row.pr} | ${row.name} | ${row.directory} | ${row.installed} | ${row.to} | ${row.ignoredBy ?? 'nothing (unhandled)'} |`);
  }
  return out.join('\n');
}

export function formatOpen(rows) {
  if (rows.length === 0) return 'No open Dependabot pull request.';
  const out = [
    '| PR | Package | Ecosystem | Directory | From -> To | Bump | CI | Commits | Notes |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    out.push(`| #${row.pr} | ${row.name} | ${row.ecosystem} | ${row.directory} | ${row.from} -> ${row.to} | ${row.bump} | ${row.ci} | ${row.commits} | ${row.notes || '-'} |`);
  }
  return out.join('\n');
}

/** Warning line when a gh listing returned exactly its limit, so older PRs may be missing; else null. */
export function limitWarning(kind, count, limit) {
  return count >= limit ? `Warning: read ${String(count)} ${kind} pull requests, the limit; older ones are not listed. Rerun with a higher --limit.` : null;
}

/**
 * Problems with the versions the branch now holds: each expected { ecosystem, directory, name, to } must
 * be the only version found. `versions(ecosystem, directory)` returns Map name -> string[].
 */
export function versionMismatches(expected, versions) {
  const problems = [];
  for (const row of expected) {
    const found = versions(row.ecosystem, row.directory);
    const key = [...found.keys()].find((name) => (row.ecosystem === 'npm' ? name === row.name : name.toLowerCase() === row.name.toLowerCase()));
    const actual = key ? found.get(key) : [];
    if (actual.length === 0) problems.push(`${row.name} (${row.ecosystem} ${row.directory}): not found, expected ${row.to}`);
    else if (actual.some((v) => compareVersions(v, row.to) !== 0)) problems.push(`${row.name} (${row.ecosystem} ${row.directory}): found ${actual.join(', ')}, expected ${row.to}`);
  }
  return problems;
}

/** Lock entries that resolve from a host other than the npm registry. */
export function foreignResolved(lock) {
  return Object.entries(lock.packages ?? {})
    .filter(([key, value]) => key !== '' && value.resolved && !value.link && !value.resolved.startsWith(NPM_REGISTRY))
    .map(([key, value]) => `${key}: resolved from ${value.resolved}`);
}

/** Lock packages new or changed against `base` whose licence is not on the allowed list. */
export function disallowedLicences(lock, base = { packages: {} }) {
  const problems = [];
  for (const [key, value] of Object.entries(lock.packages ?? {})) {
    if (key === '' || value.link || base.packages?.[key]?.version === value.version) continue;
    const licence = value.license ?? 'none';
    const parts = String(licence).replace(/[()]/g, '').split(/\s+OR\s+/);
    if (!parts.some((part) => ALLOWED_LICENCES.has(part.trim()))) problems.push(`${key}@${String(value.version)}: licence ${String(licence)}`);
  }
  return problems;
}

const FIELDS = {
  closed: 'number,title,body,headRefName,mergedAt,comments',
  open: 'number,title,body,headRefName',
  openDetail: 'number,title,body,headRefName,comments,commits,labels,statusCheckRollup',
};

function ghPrs(state, limit, fields = FIELDS[state]) {
  const output = execFileSync('gh', ['pr', 'list', '--author', 'app/dependabot', '--state', state, '--limit', String(limit), '--json', fields], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function readLock(directory, ref = null) {
  const path = `${directory.replace(/^\/|\/$/g, '')}/package-lock.json`.replace(/^\//, '');
  try {
    const text = ref
      ? execFileSync('git', ['show', `${ref}:${path}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
      : readFileSync(join(REPO, path), 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function verify(file) {
  const expected = JSON.parse(readFileSync(file, 'utf8'));
  const cache = new Map();
  const versions = (ecosystem, directory) => {
    const key = `${ecosystem}:${directory}`;
    if (!cache.has(key)) cache.set(key, packageVersions(ecosystem, directory, REPO));
    return cache.get(key);
  };
  const problems = versionMismatches(expected, versions);
  const npmDirs = new Set(parseUpdateEntries(readFileSync(join(REPO, CONFIG_FILE), 'utf8')).filter((e) => e.ecosystem === 'npm').map((e) => e.directory));
  for (const directory of npmDirs) {
    const lock = readLock(directory);
    if (!lock) continue;
    problems.push(...foreignResolved(lock).map((p) => `${directory}: ${p}`));
    problems.push(...disallowedLicences(lock, readLock(directory, 'origin/main') ?? undefined).map((p) => `${directory}: ${p}`));
  }
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log(`dependabot verify: ${String(expected.length)} versions match; locks resolve from the npm registry; new lock packages have allowed licences.`);
}

function main() {
  const args = process.argv.slice(2);
  const verifyIndex = args.indexOf('--verify');
  if (verifyIndex >= 0) {
    verify(args[verifyIndex + 1]);
    return;
  }
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number.parseInt(args[limitIndex + 1], 10) : 200;
  const text = readFileSync(join(REPO, CONFIG_FILE), 'utf8');
  const entries = parseUpdateEntries(text);
  // Commit authors make the detailed open query costly (GitHub caps a query at 500,000 nodes); Dependabot
  // keeps a few open PRs per ecosystem, so the limit is ample and the warning says when it is not.
  const open = ghPrs('open', OPEN_LIMIT, args.includes('--open') ? FIELDS.openDetail : FIELDS.open);
  const warnings = [limitWarning('open', open.length, OPEN_LIMIT)];
  if (args.includes('--open')) {
    console.log(formatOpen(describeOpen({ open, entries })));
  } else {
    const cache = new Map();
    const installed = (ecosystem, directory) => {
      const key = `${ecosystem}:${directory}`;
      if (!cache.has(key)) cache.set(key, installedPackages(ecosystem, directory, REPO));
      return cache.get(key);
    };
    const closed = ghPrs('closed', limit);
    warnings.push(limitWarning('closed', closed.length, limit));
    console.log(formatSkipped(findSkipped({ closed, open, entries, groups: parseIgnoreRules(text), installed })));
  }
  for (const warning of warnings.filter(Boolean)) console.log(`\n${warning}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
