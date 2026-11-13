import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  formatReport,
  installedPackages,
  matchesPattern,
  parseIgnoreRules,
  removeRules,
  reviewRules,
  ruleIgnores,
  rulesWithoutReason,
  satisfiesRange,
} from './check-dependabot-ignores.mjs';

const CONFIG = `version: 2
updates:
  - package-ecosystem: "nuget"
    directory: "/backend"
    schedule:
      interval: "weekly"
    # Reviewed monthly.
    ignore:
      # Licence reason.
      - dependency-name: "Paid.Lib"
        versions: [">= 13.0.0"]
      # Runtime reason.
      - dependency-name: "Runtime.*"
        versions: [">= 11.0.0"]
      - dependency-name: "Other.*"
        versions: [">= 11.0.0"]

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    ignore:
      # Peer reason.
      - dependency-name: "linter"
        update-types: ["version-update:semver-major"]

  - package-ecosystem: "github-actions"
    directory: "/"
`;

test('parseIgnoreRules groups rules under their comment and keeps ecosystem and directory', () => {
  const groups = parseIgnoreRules(CONFIG);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.rules.map((r) => r.dependencyName)), [['Paid.Lib'], ['Runtime.*', 'Other.*'], ['linter']]);
  assert.equal(groups[1].reason, 'Runtime reason.');
  assert.equal(groups[1].ecosystem, 'nuget');
  assert.equal(groups[2].directory, '/frontend');
  assert.deepEqual(groups[0].rules[0].versions, ['>= 13.0.0']);
  assert.deepEqual(groups[2].rules[0].updateTypes, ['version-update:semver-major']);
});

test('rulesWithoutReason flags only rules with no comment above their group', () => {
  assert.deepEqual(rulesWithoutReason(parseIgnoreRules(CONFIG)), []);
  const bare = CONFIG.replace('      # Peer reason.\n', '');
  assert.deepEqual(rulesWithoutReason(parseIgnoreRules(bare)).map(({ rule }) => rule.dependencyName), ['linter']);
});

test('matchesPattern supports wildcards and ignores case only for NuGet', () => {
  assert.ok(matchesPattern('Runtime.*', 'runtime.signalr', 'nuget'));
  assert.ok(matchesPattern('Microsoft.EntityFrameworkCore*', 'Microsoft.EntityFrameworkCore', 'nuget'));
  assert.ok(!matchesPattern('Runtime.*', 'RuntimeX', 'nuget'));
  assert.ok(!matchesPattern('Linter', 'linter', 'npm'));
});

test('satisfiesRange handles comparators, combined ranges and .x', () => {
  assert.ok(satisfiesRange('11.0.0', '>= 11.0.0'));
  assert.ok(!satisfiesRange('10.0.16', '>= 11.0.0'));
  assert.ok(satisfiesRange('2.5.0', '>= 2.0, < 3'));
  assert.ok(!satisfiesRange('3.0.0', '>= 2.0, < 3'));
  assert.ok(satisfiesRange('6.1.4', '6.1.x'));
});

test('ruleIgnores checks version ranges and update types', () => {
  const ranged = { versions: ['>= 11.0.0'], updateTypes: [] };
  assert.ok(ruleIgnores(ranged, '10.0.14', '11.0.1'));
  assert.ok(!ruleIgnores(ranged, '10.0.14', '10.0.16'));
  const major = { versions: [], updateTypes: ['version-update:semver-major'] };
  assert.ok(ruleIgnores(major, '9.39.4', '10.0.0'));
  assert.ok(!ruleIgnores(major, '9.39.4', '9.40.0'));
  assert.ok(ruleIgnores({ versions: [], updateTypes: [] }, '1.0.0', '1.0.1'));
});

test('removeRules drops one rule but keeps the shared comment while the group has rules left', () => {
  const groups = parseIgnoreRules(CONFIG);
  const out = removeRules(CONFIG, groups, new Set([groups[1].rules[0].start]));
  assert.ok(!out.includes('Runtime.*'));
  assert.ok(out.includes('# Runtime reason.'));
  assert.ok(out.includes('Other.*'));
});

test('removeRules drops the comment with the last rule of a group, and an emptied ignore key', () => {
  const groups = parseIgnoreRules(CONFIG);
  let out = removeRules(CONFIG, groups, new Set(groups[1].rules.map((r) => r.start)));
  assert.ok(!out.includes('Runtime reason'));
  assert.ok(out.includes('Paid.Lib'));
  out = removeRules(CONFIG, groups, new Set([groups[2].rules[0].start]));
  assert.ok(!out.includes('Peer reason'));
  assert.equal(out.match(/ignore:/g).length, 1);
  assert.deepEqual(parseIgnoreRules(out).map((g) => g.ecosystem), ['nuget', 'nuget']);
});

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'dependabot-ignores-'));
  mkdirSync(join(root, 'backend', 'src'), { recursive: true });
  writeFileSync(join(root, 'backend', 'src', 'App.csproj'), [
    '<Project>',
    '  <PackageReference Include="Paid.Lib" Version="12.5.0" />',
    '  <PackageReference Include="Runtime.Hub" Version="10.0.14" />',
    '  <PackageReference Include="Other.Thing" Version="10.0.14" />',
    '</Project>',
  ].join('\n'));
  mkdirSync(join(root, 'frontend'));
  writeFileSync(join(root, 'frontend', 'package-lock.json'), JSON.stringify({
    packages: { '': {}, 'node_modules/linter': { version: '9.1.0' }, 'node_modules/x/node_modules/linter': { version: '8.0.0' } },
  }));
  return root;
}

test('installedPackages reads NuGet references and top-level npm packages only', () => {
  const root = fixtureRepo();
  try {
    assert.deepEqual([...installedPackages('nuget', '/backend', root)], [['Paid.Lib', '12.5.0'], ['Runtime.Hub', '10.0.14'], ['Other.Thing', '10.0.14']]);
    assert.deepEqual([...installedPackages('npm', '/frontend', root)], [['linter', '9.1.0']]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const advisory = (severity, patched) => ({ id: 'GHSA-test', severity, summary: 's', url: 'https://example.invalid', patched });

test('reviewRules lifts a rule only when a high or critical fix is inside the ignored range', async () => {
  const root = fixtureRepo();
  try {
    const advisories = {
      'Runtime.Hub': [advisory('high', '11.0.1')], // fix only in an ignored version: lift
      'Other.Thing': [advisory('critical', '10.0.16')], // fix in an allowed patch: Dependabot handles it
      'Paid.Lib': [advisory('high', null)], // no fix released: report, nothing to lift
      linter: [advisory('critical', '10.0.0')], // major fix blocked by semver-major ignore: lift
    };
    const lookups = {
      latestVersion: async () => '99.0.0',
      blockingAdvisories: async (_eco, name) => (advisories[name] ?? []).map((a) => ({ ...a })),
    };
    const groups = parseIgnoreRules(CONFIG);
    const result = await reviewRules(groups, root, lookups);
    const lifted = [...result.lift].map((start) => groups.flatMap((g) => g.rules).find((r) => r.start === start).dependencyName);
    assert.deepEqual(lifted.sort(), ['Runtime.*', 'linter']);
    const linterRow = result.rows.find((r) => r.rule.dependencyName === 'linter');
    assert.deepEqual(linterRow.packages.map((p) => p.version), ['9.1.0']);
    const report = formatReport(result, new Date('2026-11-01T00:00:00Z'));
    assert.match(report, /Dependabot ignore review 2026-11/);
    assert.match(report, /2 rule\(s\) lifted/);
    assert.match(report, /`Runtime\.\*` \*\*LIFT\*\*/);
    assert.match(report, /fixed in no release yet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reviewRules lifts nothing when no advisory applies', async () => {
  const root = fixtureRepo();
  try {
    const lookups = { latestVersion: async () => null, blockingAdvisories: async () => [] };
    const result = await reviewRules(parseIgnoreRules(CONFIG), root, lookups);
    assert.equal(result.lift.size, 0);
    assert.match(formatReport(result), /No ignore rule holds back a high or critical fix/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
