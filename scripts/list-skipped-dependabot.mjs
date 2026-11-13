// Lists Dependabot updates that were closed without being applied and are still not handled.
//
//   node scripts/list-skipped-dependabot.mjs            # print the report (Markdown)
//   node scripts/list-skipped-dependabot.mjs --limit 300
//
// Reads the closed, unmerged Dependabot pull requests (gh CLI), takes each package and the version the
// PR proposed, and keeps those where the repo is still below that version and no open Dependabot PR
// carries the package. Each row says whether an ignore rule in .github/dependabot.yml covers it or an
// `@dependabot ignore` comment on the PR does (those are invisible in dependabot.yml). Used by the
// dependabot-combine skill.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG_FILE, compareVersions, installedPackages, matchesPattern, parseIgnoreRules, ruleIgnores } from './check-dependabot-ignores.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH_ECOSYSTEM = { nuget: 'nuget', npm_and_yarn: 'npm' };
const VERSION = String.raw`v?\d[\w.+-]*?`;

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
  const entry = byDirectory ?? candidates[0];
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

/** The `@dependabot ignore ...` command left on a PR, or null. */
export function ignoreCommand(comments = []) {
  for (const comment of comments) {
    const match = /@dependabot (ignore this (?:major version|minor version|patch version|dependency)|ignore [^\n]+)/i.exec(comment.body ?? '');
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Closed, unmerged Dependabot updates that the repo still does not have. One row per package (the
 * highest proposed version); packages carried by an open Dependabot PR are left to the normal flow.
 */
export function findSkipped({ closed, open, entries, groups, installed }) {
  const openPackages = new Set();
  for (const pr of open) for (const update of proposedUpdates(pr.title, pr.body)) openPackages.add(update.name.toLowerCase());

  const rows = new Map();
  for (const pr of closed) {
    if (pr.mergedAt) continue;
    const target = branchTarget(pr.headRefName ?? '', entries);
    if (!target) continue;
    const packages = installed(target.ecosystem, target.directory);
    for (const update of proposedUpdates(pr.title, pr.body)) {
      const key = `${target.ecosystem}:${target.directory}:${update.name.toLowerCase()}`;
      if (openPackages.has(update.name.toLowerCase())) continue;
      const current = packages.get(update.name)
        ?? [...packages].find(([name]) => target.ecosystem === 'nuget' && name.toLowerCase() === update.name.toLowerCase())?.[1];
      if (!current || compareVersions(current, update.to) >= 0) continue;
      const previous = rows.get(key);
      if (previous && compareVersions(previous.to, update.to) >= 0) continue;
      const rule = groups
        .filter((group) => group.ecosystem === target.ecosystem && group.directory === target.directory)
        .flatMap((group) => group.rules)
        .find((r) => matchesPattern(r.dependencyName, update.name, target.ecosystem) && ruleIgnores(r, current, update.to));
      const command = ignoreCommand(pr.comments);
      rows.set(key, {
        pr: pr.number,
        name: update.name,
        ecosystem: target.ecosystem,
        directory: target.directory,
        installed: current,
        to: update.to,
        ignoredBy: rule ? `rule \`${rule.dependencyName}\`` : command ? `comment "${command}"` : null,
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
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

function ghPrs(state, limit) {
  const fields = state === 'closed' ? 'number,title,body,headRefName,mergedAt,comments' : 'number,title,body,headRefName';
  const output = execFileSync('gh', ['pr', 'list', '--author', 'app/dependabot', '--state', state, '--limit', String(limit), '--json', fields], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number.parseInt(args[limitIndex + 1], 10) : 200;
  const text = readFileSync(join(REPO, CONFIG_FILE), 'utf8');
  const cache = new Map();
  const installed = (ecosystem, directory) => {
    const key = `${ecosystem}:${directory}`;
    if (!cache.has(key)) cache.set(key, installedPackages(ecosystem, directory, REPO));
    return cache.get(key);
  };
  const rows = findSkipped({
    closed: ghPrs('closed', limit),
    open: ghPrs('open', 100),
    entries: parseUpdateEntries(text),
    groups: parseIgnoreRules(text),
    installed,
  });
  console.log(formatSkipped(rows));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
