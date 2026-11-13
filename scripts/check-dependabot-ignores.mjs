// Monthly review of the ignore rules in .github/dependabot.yml.
//
//   node scripts/check-dependabot-ignores.mjs                  # print the review report
//   node scripts/check-dependabot-ignores.mjs --lift           # also remove rules that block a high/critical fix
//   node scripts/check-dependabot-ignores.mjs --report <file>  # write the report (Markdown) to a file
//   node scripts/check-dependabot-ignores.mjs --check-reasons  # offline lint: fail when a rule has no reason comment
//
// For each ignore rule it lists the installed packages the rule covers, their latest release and any
// high or critical GitHub advisory against the installed version. When the first patched version of such
// an advisory is itself ignored by the rule, the rule is lifted: an ignore must never hold back a
// high-severity fix. Set GITHUB_TOKEN or GH_TOKEN to raise the advisory API rate limit.
// Run monthly by .github/workflows/dependabot-ignore-review.yml.

import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_FILE = '.github/dependabot.yml';
export const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

const unquote = (value) => value.trim().replace(/^["']|["']$/g, '');
const listValue = (value) => value.trim().replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean);
const indentOf = (line) => line.length - line.trimStart().length;

/**
 * Parses the ignore rules of a dependabot.yml. Comment lines directly above a rule start a new group;
 * rules that follow without a comment join the previous group and share its reason.
 */
export function parseIgnoreRules(text) {
  const lines = text.split('\n');
  const groups = [];
  let ecosystem = null;
  let directory = null;
  let ignoreIndent = -1;
  let ignoreLine = -1;
  let pending = null;
  let group = null;
  let rule = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const eco = /^-\s*package-ecosystem:\s*(.+)$/.exec(trimmed);
    if (eco) {
      ecosystem = unquote(eco[1]);
      directory = null;
      ignoreIndent = -1;
      group = null;
      rule = null;
      continue;
    }
    const dir = /^directory:\s*(.+)$/.exec(trimmed);
    if (dir && ignoreIndent < 0) directory = unquote(dir[1]);

    if (ignoreIndent < 0) {
      if (trimmed === 'ignore:') {
        ignoreIndent = indentOf(line);
        ignoreLine = i;
        pending = null;
        group = null;
      }
      continue;
    }
    if (trimmed === '' || indentOf(line) <= ignoreIndent) {
      ignoreIndent = -1;
      rule = null;
      continue;
    }
    if (trimmed.startsWith('#')) {
      pending ??= { start: i, lines: [] };
      pending.lines.push(trimmed.replace(/^#\s?/, ''));
      rule = null;
      continue;
    }
    const name = /^-\s*dependency-name:\s*(.+)$/.exec(trimmed);
    if (name) {
      if (pending || !group) {
        group = { ecosystem, directory, ignoreLine, reason: pending?.lines.join(' ') ?? '', commentStart: pending?.start ?? i, rules: [] };
        groups.push(group);
        pending = null;
      }
      rule = { dependencyName: unquote(name[1]), versions: [], updateTypes: [], start: i, end: i };
      group.rules.push(rule);
      continue;
    }
    if (!rule) continue;
    const versions = /^versions:\s*(.+)$/.exec(trimmed);
    const types = /^update-types:\s*(.+)$/.exec(trimmed);
    if (versions) rule.versions = listValue(versions[1]);
    if (types) rule.updateTypes = listValue(types[1]);
    rule.end = i;
  }
  return groups;
}

/** Dependabot dependency-name patterns: `*` matches any run of characters. NuGet names ignore case. */
export function matchesPattern(pattern, name, ecosystem) {
  const source = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${source}$`, ecosystem === 'nuget' ? 'i' : '').test(name);
}

/** Numeric parts of a version; a prerelease suffix is dropped. */
export function parseVersion(version) {
  return String(version).replace(/^v/, '').split(/[-+]/)[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
}

/** The prerelease identifiers of a version (`1.0.0-rc.1+build` -> ['rc', '1']); empty for a release. */
function prereleaseOf(version) {
  const match = /^[^-+]*-([^+]+)/.exec(String(version).replace(/^v/, ''));
  return match ? match[1].split('.') : [];
}

/** Semver order: numeric parts first, then a prerelease sorts below its release (`1.0.0-rc.1 < 1.0.0`). */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  const leftPre = prereleaseOf(a);
  const rightPre = prereleaseOf(b);
  if (leftPre.length === 0 || rightPre.length === 0) return Math.sign(rightPre.length - leftPre.length);
  for (let i = 0; i < Math.max(leftPre.length, rightPre.length); i += 1) {
    if (leftPre[i] === undefined) return -1;
    if (rightPre[i] === undefined) return 1;
    const leftNum = /^\d+$/.test(leftPre[i]);
    const rightNum = /^\d+$/.test(rightPre[i]);
    if (leftNum && rightNum) {
      const diff = Number(leftPre[i]) - Number(rightPre[i]);
      if (diff !== 0) return Math.sign(diff);
    } else if (leftNum !== rightNum) {
      return leftNum ? -1 : 1;
    } else if (leftPre[i] !== rightPre[i]) {
      return leftPre[i] < rightPre[i] ? -1 : 1;
    }
  }
  return 0;
}

/** True when `version` satisfies one Dependabot range such as ">= 11.0.0" or ">= 2.0, < 3". */
export function satisfiesRange(version, range) {
  const comparators = range.split(/,|\s+(?=[<>=])/).map((part) => part.trim()).filter(Boolean);
  return comparators.every((comparator) => {
    const match = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(comparator);
    if (!match) return false;
    const target = match[2].replace(/\.x$/i, '');
    const cmp = compareVersions(version, target);
    switch (match[1] ?? '=') {
      case '>=': return cmp >= 0;
      case '<=': return cmp <= 0;
      case '>': return cmp > 0;
      case '<': return cmp < 0;
      default: return match[2].endsWith('.x')
        ? parseVersion(version).slice(0, parseVersion(target).length).join('.') === parseVersion(target).join('.')
        : cmp === 0;
    }
  });
}

/** True when the rule would stop Dependabot from moving `installed` to `candidate`. */
export function ruleIgnores(rule, installed, candidate) {
  if (rule.versions.length === 0 && rule.updateTypes.length === 0) return true;
  if (rule.versions.some((range) => satisfiesRange(candidate, range))) return true;
  const [fromMajor, fromMinor] = parseVersion(installed);
  const [toMajor, toMinor] = parseVersion(candidate);
  const kind = toMajor !== fromMajor ? 'major' : toMinor !== fromMinor ? 'minor' : 'patch';
  return rule.updateTypes.includes(`version-update:semver-${kind}`);
}

function walkFiles(dir, accept, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['bin', 'obj', 'node_modules', '.git'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, accept, found);
    else if (accept(entry.name)) found.push(path);
  }
  return found;
}

/**
 * Every version of each dependency one Dependabot entry holds: Map name -> distinct versions. NuGet
 * references in each project, top-level npm lock entries, and the `owner/repo` of each workflow
 * `uses:` (a sub-path such as `github/codeql-action/init` counts as `github/codeql-action`).
 */
export function packageVersions(ecosystem, directory, root = REPO) {
  const base = join(root, directory ?? '/');
  const found = new Map();
  const add = (name, version) => {
    const list = found.get(name) ?? [];
    if (!list.includes(version)) list.push(version);
    found.set(name, list);
  };
  if (ecosystem === 'nuget') {
    for (const file of walkFiles(base, (name) => /\.(cs|fs)proj$|\.props$/.test(name))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g)) add(match[1], match[2]);
    }
  } else if (ecosystem === 'npm') {
    const lockFile = join(base, 'package-lock.json');
    if (existsSync(lockFile)) {
      const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
      for (const [key, value] of Object.entries(lock.packages ?? {})) {
        const name = key.startsWith('node_modules/') ? key.slice('node_modules/'.length) : null;
        if (name && !name.includes('/node_modules/') && value.version) add(name, value.version);
      }
    }
  } else if (ecosystem === 'github-actions') {
    for (const file of walkFiles(join(base, '.github', 'workflows'), (name) => /\.ya?ml$/.test(name))) {
      const text = readFileSync(file, 'utf8');
      // A ref pinned to a commit SHA takes its version from the trailing `# vX.Y.Z` comment.
      for (const match of text.matchAll(/uses:\s*["']?([\w.-]+\/[\w.-]+)(?:\/[^@\s"']*)?@([^\s"'#]+)["']?[ \t]*(?:#[ \t]*(v?\d[\w.-]*))?/g)) {
        add(match[1], /^[0-9a-f]{40}$/.test(match[2]) && match[3] ? match[3] : match[2]);
      }
    }
  }
  return found;
}

/** Installed direct dependencies of one Dependabot entry: Map name -> lowest version held. */
export function installedPackages(ecosystem, directory, root = REPO) {
  const found = new Map();
  for (const [name, versions] of packageVersions(ecosystem, directory, root)) {
    found.set(name, versions.reduce((low, v) => (compareVersions(v, low) < 0 ? v : low)));
  }
  return found;
}

const ADVISORY_ECOSYSTEM = { nuget: 'nuget', npm: 'npm' };

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': 'dependabot-ignore-review', ...headers } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${String(response.status)}`);
  return response.json();
}

/** Latest stable release from the package registry, or null if it cannot be read. */
export async function latestVersion(ecosystem, name) {
  try {
    if (ecosystem === 'npm') return (await getJson(`https://registry.npmjs.org/${name.replaceAll('/', '%2F')}/latest`)).version;
    if (ecosystem === 'nuget') {
      const { versions } = await getJson(`https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`);
      return versions.filter((v) => !v.includes('-')).at(-1) ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

/** High and critical advisories that affect `name@version`, each with its first patched version. */
export async function blockingAdvisories(ecosystem, name, version) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const headers = { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const url = `https://api.github.com/advisories?ecosystem=${ADVISORY_ECOSYSTEM[ecosystem]}&affects=${encodeURIComponent(`${name}@${version}`)}&per_page=100`;
  const advisories = await getJson(url, headers);
  return advisories
    .filter((a) => BLOCKING_SEVERITIES.has(a.severity) && !a.withdrawn_at)
    .map((a) => {
      const vuln = (a.vulnerabilities ?? []).find((v) => v.package?.name?.toLowerCase() === name.toLowerCase()) ?? {};
      return { id: a.ghsa_id, severity: a.severity, summary: a.summary, url: a.html_url, patched: vuln.first_patched_version ?? null };
    });
}

/** Removes the given rules (by start line); drops a group's comment when all its rules go. */
export function removeRules(text, groups, rulesToRemove) {
  const lines = text.split('\n');
  const drop = new Set();
  const remainingPerIgnore = new Map();
  for (const group of groups) {
    const removed = group.rules.filter((rule) => rulesToRemove.has(rule.start));
    for (const rule of removed) for (let i = rule.start; i <= rule.end; i += 1) drop.add(i);
    if (removed.length === group.rules.length) for (let i = group.commentStart; i < group.rules[0].start; i += 1) drop.add(i);
    remainingPerIgnore.set(group.ignoreLine, (remainingPerIgnore.get(group.ignoreLine) ?? 0) + group.rules.length - removed.length);
  }
  for (const [ignoreLine, remaining] of remainingPerIgnore) if (remaining === 0) drop.add(ignoreLine);
  return lines.filter((_, i) => !drop.has(i)).join('\n');
}

/** Rules with no comment above them (or above the first rule of their group): every ignore needs a reason. */
export function rulesWithoutReason(groups) {
  return groups.filter((group) => group.reason.trim() === '').flatMap((group) => group.rules.map((rule) => ({ group, rule })));
}

/** Reviews every rule; returns { rows, lift } where lift holds the start lines of rules to remove. */
export async function reviewRules(groups, root = REPO, lookups = { latestVersion, blockingAdvisories }) {
  const rows = [];
  const lift = new Set();
  for (const group of groups) {
    const installed = installedPackages(group.ecosystem, group.directory, root);
    for (const rule of group.rules) {
      const packages = [...installed].filter(([name]) => matchesPattern(rule.dependencyName, name, group.ecosystem));
      const row = { group, rule, packages: [], liftReasons: [] };
      for (const [name, version] of packages) {
        const latest = await lookups.latestVersion(group.ecosystem, name);
        const advisories = await lookups.blockingAdvisories(group.ecosystem, name, version);
        for (const advisory of advisories) {
          advisory.blockedByRule = advisory.patched !== null && ruleIgnores(rule, version, advisory.patched);
          if (advisory.blockedByRule) row.liftReasons.push(`${advisory.id} (${advisory.severity}) on ${name}@${version}, fixed in ${advisory.patched}`);
        }
        row.packages.push({ name, version, latest, latestIgnored: latest !== null && compareVersions(latest, version) > 0 && ruleIgnores(rule, version, latest), advisories });
      }
      if (row.liftReasons.length > 0) lift.add(rule.start);
      rows.push(row);
    }
  }
  return { rows, lift };
}

const describeRule = (rule) => [rule.versions.length ? `versions ${rule.versions.join(', ')}` : '', rule.updateTypes.length ? rule.updateTypes.join(', ') : ''].filter(Boolean).join('; ') || 'all versions';

export function formatReport({ rows, lift }, date = new Date()) {
  const month = date.toISOString().slice(0, 7);
  const out = [`## Dependabot ignore review ${month}`, ''];
  out.push(lift.size > 0
    ? `**${String(lift.size)} rule(s) lifted:** they held back the fix for a high or critical advisory.`
    : 'No ignore rule holds back a high or critical fix.', '');
  out.push('| Rule | Ecosystem | Ignores | Installed | Latest | High/critical advisories |', '|---|---|---|---|---|---|');
  for (const { group, rule, packages, liftReasons } of rows) {
    const installed = packages.map((p) => `${p.name}@${p.version}`).join('<br>') || '(none installed)';
    const latest = packages.map((p) => `${p.latest ?? '?'}${p.latestIgnored ? ' (ignored)' : ''}`).join('<br>') || '-';
    const advisories = packages.flatMap((p) => p.advisories.map((a) =>
      `[${a.id}](${a.url}) ${a.severity} on ${p.name}, fixed in ${a.patched ?? 'no release yet'}${a.blockedByRule ? ' **(blocked: lifted)**' : ''}`)).join('<br>') || 'none';
    out.push(`| \`${rule.dependencyName}\`${liftReasons.length ? ' **LIFT**' : ''} | ${group.ecosystem} ${group.directory ?? ''} | ${describeRule(rule)} | ${installed} | ${latest} | ${advisories} |`);
  }
  out.push('', '### Reasons to re-check', '');
  const seen = new Set();
  for (const { group } of rows) {
    if (seen.has(group)) continue;
    seen.add(group);
    out.push(`- **${group.rules.map((r) => `\`${r.dependencyName}\``).join(', ')}** (${group.ecosystem}): ${group.reason || 'no reason recorded'}`);
  }
  out.push('', 'Each month, check whether each reason still holds; remove a rule whose blocker has cleared.');
  return out.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const reportIndex = args.indexOf('--report');
  const configPath = join(REPO, CONFIG_FILE);
  const text = readFileSync(configPath, 'utf8');
  const groups = parseIgnoreRules(text);
  if (args.includes('--check-reasons')) {
    const missing = rulesWithoutReason(groups);
    for (const { group, rule } of missing) {
      console.error(`${CONFIG_FILE}:${rule.start + 1}: ignore rule "${rule.dependencyName}" (${group.ecosystem}) has no reason comment above it`);
    }
    if (missing.length > 0) process.exit(1);
    console.log(`dependabot ignores: ${String(groups.reduce((n, g) => n + g.rules.length, 0))} rules, all with a reason.`);
    return;
  }
  const result = await reviewRules(groups);
  const report = formatReport(result);
  console.log(report);
  if (reportIndex >= 0 && args[reportIndex + 1]) writeFileSync(args[reportIndex + 1], `${report}\n`);
  if (args.includes('--lift') && result.lift.size > 0) writeFileSync(configPath, removeRules(text, groups, result.lift));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `lifted=${String(result.lift.size)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
