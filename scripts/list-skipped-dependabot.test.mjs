import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIgnoreRules } from './check-dependabot-ignores.mjs';
import {
  branchTarget,
  findSkipped,
  formatSkipped,
  ignoreCommand,
  leftOutReason,
  parseUpdateEntries,
  proposedUpdates,
} from './list-skipped-dependabot.mjs';

const CONFIG = `version: 2
updates:
  - package-ecosystem: "nuget"
    directory: "/backend"
    ignore:
      # Runtime reason.
      - dependency-name: "Runtime.*"
        versions: [">= 11.0.0"]

  - package-ecosystem: "npm"
    directory: "/frontend"

  - package-ecosystem: "github-actions"
    directory: "/"
`;

const entries = parseUpdateEntries(CONFIG);
const groups = parseIgnoreRules(CONFIG);
const installedMap = {
  'nuget:/backend': new Map([['Runtime.Hosting', '10.0.14'], ['Analyzer.Pack', '3.0.335']]),
  'npm:/frontend': new Map([['eslint', '9.39.4'], ['jsdom', '30.1.3'], ['vitest', '5.1.0'], ['globals', '17.13.0']]),
};
const installed = (ecosystem, directory) => installedMap[`${ecosystem}:${directory}`] ?? new Map();

const pr = (number, title, headRefName, extra = {}) => ({ number, title, headRefName, body: '', mergedAt: null, comments: [], ...extra });

test('parseUpdateEntries reads each ecosystem and directory', () => {
  assert.deepEqual(entries, [
    { ecosystem: 'nuget', directory: '/backend' },
    { ecosystem: 'npm', directory: '/frontend' },
    { ecosystem: 'github-actions', directory: '/' },
  ]);
});

test('branchTarget maps Dependabot branches and skips other ecosystems', () => {
  assert.deepEqual(branchTarget('dependabot/npm_and_yarn/frontend/jsdom-31.0.0', entries), { ecosystem: 'npm', directory: '/frontend' });
  assert.deepEqual(branchTarget('dependabot/nuget/backend/Runtime.Hosting-11.0.0', entries), { ecosystem: 'nuget', directory: '/backend' });
  assert.equal(branchTarget('dependabot/github_actions/actions/checkout-6', entries), null);
  assert.equal(branchTarget('feature/nuget/backend/x', entries), null);
});

test('proposedUpdates reads grouped bodies, single bodies and titles', () => {
  const grouped = 'Updates `Runtime.Config` from 10.0.14 to 10.0.15\nUpdates `Runtime.Json` from 10.0.14 to 10.0.15.';
  assert.deepEqual(proposedUpdates('Bump Runtime.Config and 1 other', grouped).map((u) => `${u.name}@${u.to}`), [
    'Runtime.Config@10.0.15',
    'Runtime.Json@10.0.15',
  ]);
  assert.deepEqual(proposedUpdates('x', 'Bumps [jsdom](https://example.test) from 30.1.3 to 31.0.0.'), [{ name: 'jsdom', from: '30.1.3', to: '31.0.0' }]);
  assert.deepEqual(proposedUpdates('chore(deps-dev): Bump jsdom from 30.1.3 to 31.0.0 in /frontend'), [{ name: 'jsdom', from: '30.1.3', to: '31.0.0' }]);
});

test('ignoreCommand finds an @dependabot ignore comment', () => {
  assert.equal(ignoreCommand([{ body: 'thanks' }, { body: '@dependabot ignore this major version' }]), 'ignore this major version');
  assert.equal(ignoreCommand([{ body: '@dependabot rebase' }]), null);
});

test('leftOutReason returns the latest Left out reason', () => {
  assert.equal(leftOutReason([{ body: 'Left out: CI failed' }, { body: 'note\nLeft out: needs ESLint 10 plugins' }]), 'needs ESLint 10 plugins');
  assert.equal(leftOutReason([{ body: 'It was left out: no' }]), null);
});

test('findSkipped keeps only closed updates the repo still lacks', () => {
  const closed = [
    pr(1, 'chore(deps-dev): Bump jsdom from 30.1.3 to 31.0.0 in /frontend', 'dependabot/npm_and_yarn/frontend/jsdom-31.0.0', {
      comments: [{ body: '@dependabot ignore this major version' }],
    }),
    pr(2, 'Bump vitest from 5.0.5 to 5.1.0 in /frontend', 'dependabot/npm_and_yarn/frontend/vitest-5.1.0'), // already applied
    pr(3, 'Bump Runtime.Hosting from 10.0.14 to 11.0.0', 'dependabot/nuget/backend/Runtime.Hosting-11.0.0'), // ignore rule
    pr(4, 'Bump Analyzer.Pack from 3.0.335 to 3.0.339', 'dependabot/nuget/backend/Analyzer.Pack-3.0.339'), // unhandled
    pr(5, 'Bump Analyzer.Pack from 3.0.335 to 3.0.337', 'dependabot/nuget/backend/Analyzer.Pack-3.0.337'), // older duplicate
    pr(6, 'Bump globals from 17.13.0 to 17.14.0', 'dependabot/npm_and_yarn/frontend/globals-17.14.0'), // open PR carries it
    pr(7, 'Bump Gone.Pkg from 1.0.0 to 1.1.0', 'dependabot/nuget/backend/Gone.Pkg-1.1.0'), // removed from repo
    pr(8, 'Bump Analyzer.Pack from 3.0.335 to 3.0.400', 'dependabot/nuget/backend/Analyzer.Pack-3.0.400', { mergedAt: '2026-01-01' }),
    pr(10, 'Bump eslint from 9.39.4 to 10.0.0', 'dependabot/npm_and_yarn/frontend/eslint-10.0.0', {
      comments: [{ body: 'Left out: plugin | peers stop at ESLint 9' }],
    }),
  ];
  const open = [pr(9, 'Bump globals from 17.13.0 to 17.15.0', 'dependabot/npm_and_yarn/frontend/globals-17.15.0')];

  const rows = findSkipped({ closed, open, entries, groups, installed });

  assert.deepEqual(
    rows.map((r) => [r.pr, r.name, r.installed, r.to, r.ignoredBy]),
    [
      [4, 'Analyzer.Pack', '3.0.335', '3.0.339', null],
      [10, 'eslint', '9.39.4', '10.0.0', 'left out: plugin \\| peers stop at ESLint 9'],
      [1, 'jsdom', '30.1.3', '31.0.0', 'comment "ignore this major version"'],
      [3, 'Runtime.Hosting', '10.0.14', '11.0.0', 'rule `Runtime.*`'],
    ],
  );
  assert.match(formatSkipped(rows), /\| #4 \| Analyzer\.Pack \| \/backend \| 3\.0\.335 \| 3\.0\.339 \| nothing \(unhandled\) \|/);
  assert.equal(formatSkipped([]), 'No closed Dependabot update is still pending.');
});
