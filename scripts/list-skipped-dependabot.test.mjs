import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIgnoreRules } from './check-dependabot-ignores.mjs';
import {
  branchTarget,
  bumpClass,
  ciState,
  cleanReason,
  describeOpen,
  disallowedLicences,
  findSkipped,
  foreignCommitAuthors,
  foreignResolved,
  formatOpen,
  formatSkipped,
  ignoreCommand,
  leftOutReason,
  limitWarning,
  parseUpdateEntries,
  proposedUpdates,
  versionMismatches,
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

  - package-ecosystem: "npm"
    directory: "/tests/e2e"

  - package-ecosystem: "github-actions"
    directory: "/"
`;

const entries = parseUpdateEntries(CONFIG);
const groups = parseIgnoreRules(CONFIG);
const installedMap = {
  'nuget:/backend': new Map([['Runtime.Hosting', '10.0.14'], ['Analyzer.Pack', '3.0.335'], ['Mixed.Case', '1.0.0']]),
  'npm:/frontend': new Map([['eslint', '9.39.4'], ['jsdom', '30.1.3'], ['vitest', '5.1.0'], ['globals', '17.13.0'], ['runner', '1.0.0'], ['rc-pkg', '2.0.0-rc.1']]),
  'npm:/tests/e2e': new Map([['runner', '1.0.0']]),
  'github-actions:/': new Map([['actions/checkout', 'v6']]),
};
const installed = (ecosystem, directory) => installedMap[`${ecosystem}:${directory}`] ?? new Map();

const owner = (body) => ({ body, authorAssociation: 'OWNER' });
const pr = (number, title, headRefName, extra = {}) => ({ number, title, headRefName, body: '', mergedAt: null, comments: [], ...extra });

test('parseUpdateEntries reads each ecosystem and directory', () => {
  assert.deepEqual(entries, [
    { ecosystem: 'nuget', directory: '/backend' },
    { ecosystem: 'npm', directory: '/frontend' },
    { ecosystem: 'npm', directory: '/tests/e2e' },
    { ecosystem: 'github-actions', directory: '/' },
  ]);
});

test('branchTarget maps Dependabot branches, GitHub Actions included, and falls back to the first entry', () => {
  assert.deepEqual(branchTarget('dependabot/npm_and_yarn/frontend/jsdom-31.0.0', entries), { ecosystem: 'npm', directory: '/frontend' });
  assert.deepEqual(branchTarget('dependabot/npm_and_yarn/tests/e2e/runner-1.1.0', entries), { ecosystem: 'npm', directory: '/tests/e2e' });
  assert.deepEqual(branchTarget('dependabot/nuget/backend/Runtime.Hosting-11.0.0', entries), { ecosystem: 'nuget', directory: '/backend' });
  assert.deepEqual(branchTarget('dependabot/github_actions/actions/checkout-7', entries), { ecosystem: 'github-actions', directory: '/' });
  assert.deepEqual(branchTarget('dependabot/npm_and_yarn/elsewhere/x-1.0.0', entries), { ecosystem: 'npm', directory: '/frontend' });
  const withRoot = [...entries, { ecosystem: 'npm', directory: '/' }];
  assert.deepEqual(branchTarget('dependabot/npm_and_yarn/runner-1.1.0', withRoot), { ecosystem: 'npm', directory: '/' });
  assert.deepEqual(branchTarget('dependabot/npm_and_yarn/frontend/jsdom-31.0.0', withRoot), { ecosystem: 'npm', directory: '/frontend' });
  assert.equal(branchTarget('dependabot/pip/x-1.0.0', entries), null);
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
  assert.deepEqual(proposedUpdates('Bump actions/checkout from v6 to v7'), [{ name: 'actions/checkout', from: 'v6', to: 'v7' }]);
});

test('ignoreCommand and leftOutReason read trusted comments only', () => {
  assert.equal(ignoreCommand([owner('thanks'), owner('@dependabot ignore this major version')]), 'ignore this major version');
  assert.equal(ignoreCommand([owner('@dependabot rebase')]), null);
  assert.equal(ignoreCommand([{ body: '@dependabot ignore this dependency', authorAssociation: 'NONE' }]), null);
  assert.equal(leftOutReason([owner('Left out: CI failed'), { body: 'note\nLeft out: needs ESLint 10 plugins', authorAssociation: 'COLLABORATOR' }]), 'needs ESLint 10 plugins');
  assert.equal(leftOutReason([owner('Left out: real'), { body: 'Left out: fake reason', authorAssociation: 'CONTRIBUTOR' }]), 'real');
  assert.equal(leftOutReason([owner('It was left out: no')]), null);
});

test('cleanReason strips Markdown and HTML characters and caps the length', () => {
  assert.equal(cleanReason('a `cmd` <b>x</b> | y'), 'a cmd b x /b y');
  assert.equal(cleanReason('z'.repeat(250)).length, 201);
});

test('findSkipped keeps only closed updates the repo still lacks', () => {
  const closed = [
    pr(1, 'chore(deps-dev): Bump jsdom from 30.1.3 to 31.0.0 in /frontend', 'dependabot/npm_and_yarn/frontend/jsdom-31.0.0', {
      comments: [owner('@dependabot ignore this major version')],
    }),
    pr(2, 'Bump vitest from 5.0.5 to 5.1.0 in /frontend', 'dependabot/npm_and_yarn/frontend/vitest-5.1.0'), // already applied
    pr(3, 'Bump Runtime.Hosting from 10.0.14 to 11.0.0', 'dependabot/nuget/backend/Runtime.Hosting-11.0.0', {
      comments: [owner('Left out: also has a reason')], // the rule wins over the comment
    }),
    pr(4, 'Bump Analyzer.Pack from 3.0.335 to 3.0.339', 'dependabot/nuget/backend/Analyzer.Pack-3.0.339'), // unhandled
    pr(5, 'Bump Analyzer.Pack from 3.0.335 to 3.0.337', 'dependabot/nuget/backend/Analyzer.Pack-3.0.337'), // older duplicate
    pr(6, 'Bump globals from 17.13.0 to 17.14.0', 'dependabot/npm_and_yarn/frontend/globals-17.14.0'), // open PR carries a higher one
    pr(7, 'Bump Gone.Pkg from 1.0.0 to 1.1.0', 'dependabot/nuget/backend/Gone.Pkg-1.1.0'), // removed from repo
    pr(8, 'Bump Analyzer.Pack from 3.0.335 to 3.0.400', 'dependabot/nuget/backend/Analyzer.Pack-3.0.400', { mergedAt: '2026-01-01' }),
    pr(10, 'Bump eslint from 9.39.4 to 10.0.0', 'dependabot/npm_and_yarn/frontend/eslint-10.0.0', {
      comments: [owner('@dependabot ignore this major version\nLeft out: plugin | peers stop at ESLint 9')], // command wins
    }),
    pr(11, 'Bump runner from 1.0.0 to 1.2.0', 'dependabot/npm_and_yarn/frontend/runner-1.2.0'), // open PR is lower
    pr(12, 'Bump runner from 1.0.0 to 1.2.0', 'dependabot/npm_and_yarn/tests/e2e/runner-1.2.0'), // open PR is in another directory
    pr(13, 'Bump mixed.case from 1.0.0 to 1.1.0', 'dependabot/nuget/backend/mixed.case-1.1.0'), // NuGet names ignore case
    pr(14, 'Bump rc-pkg from 2.0.0-rc.1 to 2.0.0', 'dependabot/npm_and_yarn/frontend/rc-pkg-2.0.0'), // release after an rc
    pr(15, 'Bump actions/checkout from 6 to 7', 'dependabot/github_actions/actions/checkout-7', {
      comments: [{ body: 'Left out: untrusted', authorAssociation: 'NONE' }],
    }),
  ];
  const open = [
    pr(9, 'Bump globals from 17.13.0 to 17.15.0', 'dependabot/npm_and_yarn/frontend/globals-17.15.0'),
    pr(16, 'Bump runner from 1.0.0 to 1.1.0', 'dependabot/npm_and_yarn/frontend/runner-1.1.0'),
  ];

  const rows = findSkipped({ closed, open, entries, groups, installed });

  assert.deepEqual(
    rows.map((r) => [r.pr, r.name, r.directory, r.installed, r.to, r.ignoredBy]),
    [
      [15, 'actions/checkout', '/', 'v6', '7', null],
      [4, 'Analyzer.Pack', '/backend', '3.0.335', '3.0.339', null],
      [10, 'eslint', '/frontend', '9.39.4', '10.0.0', 'comment "ignore this major version"'],
      [1, 'jsdom', '/frontend', '30.1.3', '31.0.0', 'comment "ignore this major version"'],
      [13, 'mixed.case', '/backend', '1.0.0', '1.1.0', null],
      [14, 'rc-pkg', '/frontend', '2.0.0-rc.1', '2.0.0', null],
      [11, 'runner', '/frontend', '1.0.0', '1.2.0', null],
      [12, 'runner', '/tests/e2e', '1.0.0', '1.2.0', null],
      [3, 'Runtime.Hosting', '/backend', '10.0.14', '11.0.0', 'rule `Runtime.*`'],
    ],
  );
  assert.match(formatSkipped(rows), /\| #4 \| Analyzer\.Pack \| \/backend \| 3\.0\.335 \| 3\.0\.339 \| nothing \(unhandled\) \|/);
  assert.equal(formatSkipped([]), 'No closed Dependabot update is still pending.');
});

test('findSkipped drops an update an open PR carries at the same or a higher version', () => {
  const closed = [pr(1, 'Bump runner from 1.0.0 to 1.2.0', 'dependabot/npm_and_yarn/frontend/runner-1.2.0')];
  const same = [pr(2, 'Bump runner from 1.0.0 to 1.2.0', 'dependabot/npm_and_yarn/frontend/runner-1.2.0')];
  const higher = [pr(3, 'Bump runner from 1.0.0 to 1.3.0', 'dependabot/npm_and_yarn/frontend/runner-1.3.0')];
  assert.deepEqual(findSkipped({ closed, open: same, entries, groups, installed }), []);
  assert.deepEqual(findSkipped({ closed, open: higher, entries, groups, installed }), []);
});

test('bumpClass treats a 0.x minor as major', () => {
  assert.equal(bumpClass('1.2.3', '2.0.0'), 'major');
  assert.equal(bumpClass('0.4.1', '0.5.0'), 'major');
  assert.equal(bumpClass('1.2.3', '1.3.0'), 'minor');
  assert.equal(bumpClass('1.2.3', '1.2.4'), 'patch');
  assert.equal(bumpClass('v6', 'v7'), 'major');
});

test('ciState passes only when every check finished well', () => {
  const run = (conclusion, status = 'COMPLETED', name = 'build') => ({ __typename: 'CheckRun', name, status, conclusion });
  assert.equal(ciState([]), 'none');
  assert.equal(ciState([run('SUCCESS'), run('SKIPPED'), run('NEUTRAL')]), 'pass');
  assert.equal(ciState([run('SUCCESS'), run(null, 'IN_PROGRESS')]), 'pending');
  assert.equal(ciState([run('SUCCESS'), run('CANCELLED', 'COMPLETED', 'e2e')]), 'fail: e2e (cancelled)');
  assert.equal(ciState([run('TIMED_OUT'), run(null, 'QUEUED')]), 'fail: build (timed_out)');
  assert.equal(ciState([{ __typename: 'StatusContext', context: 'ext', state: 'PENDING' }]), 'pending');
  assert.equal(ciState([{ __typename: 'StatusContext', context: 'ext', state: 'ERROR' }]), 'fail: ext');
});

test('foreignCommitAuthors lists anyone but Dependabot', () => {
  const bot = { authors: [{ login: 'dependabot[bot]' }] };
  assert.deepEqual(foreignCommitAuthors([bot, bot]), []);
  assert.deepEqual(foreignCommitAuthors([bot, { authors: [{ login: 'someone' }] }]), ['someone']);
});

test('describeOpen gives bump class, CI, commit authors and notes per package', () => {
  const open = [
    pr(20, 'Bump globals from 17.13.0 to 18.0.0', 'dependabot/npm_and_yarn/frontend/globals-18.0.0', {
      statusCheckRollup: [{ __typename: 'CheckRun', name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS' }],
      commits: [{ authors: [{ login: 'dependabot[bot]' }] }, { authors: [{ login: 'other' }] }],
      labels: [{ name: 'automerge-dependabot' }],
      comments: [owner('Left out: major')],
    }),
  ];
  const rows = describeOpen({ open, entries });
  assert.deepEqual(rows, [{
    pr: 20,
    name: 'globals',
    ecosystem: 'npm',
    directory: '/frontend',
    from: '17.13.0',
    to: '18.0.0',
    bump: 'major',
    ci: 'pass',
    commits: 'also by other',
    notes: 'automerge label; left out before: major',
  }]);
  assert.match(formatOpen(rows), /\| #20 \| globals \| npm \| \/frontend \| 17\.13\.0 -> 18\.0\.0 \| major \| pass \| also by other \|/);
  assert.equal(formatOpen([]), 'No open Dependabot pull request.');
});

test('limitWarning fires when a listing reached its limit', () => {
  assert.equal(limitWarning('closed', 199, 200), null);
  assert.match(limitWarning('closed', 200, 200), /older ones are not listed/);
});

test('versionMismatches needs every copy of a package at the exact version', () => {
  const versions = (ecosystem) => (ecosystem === 'nuget'
    ? new Map([['Runtime.Hub', ['10.0.15', '10.0.14']], ['Lib.A', ['2.0.0']]])
    : new Map([['runner', ['1.2.1']]]));
  assert.deepEqual(versionMismatches([
    { ecosystem: 'nuget', directory: '/backend', name: 'lib.a', to: '2.0.0' },
    { ecosystem: 'nuget', directory: '/backend', name: 'Runtime.Hub', to: '10.0.15' },
    { ecosystem: 'npm', directory: '/frontend', name: 'runner', to: '1.2.0' },
    { ecosystem: 'npm', directory: '/frontend', name: 'gone', to: '1.0.0' },
  ], versions), [
    'Runtime.Hub (nuget /backend): found 10.0.15, 10.0.14, expected 10.0.15',
    'runner (npm /frontend): found 1.2.1, expected 1.2.0',
    'gone (npm /frontend): not found, expected 1.0.0',
  ]);
});

test('foreignResolved flags lock entries from another host', () => {
  const lock = { packages: {
    '': {},
    'node_modules/a': { resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz' },
    'node_modules/b': { resolved: 'https://elsewhere.invalid/b.tgz' },
    'node_modules/c': { resolved: '../c', link: true },
  } };
  assert.deepEqual(foreignResolved(lock), ['node_modules/b: resolved from https://elsewhere.invalid/b.tgz']);
});

test('disallowedLicences checks only new or changed lock packages', () => {
  const base = { packages: { 'node_modules/old': { version: '1.0.0', license: 'MPL-2.0' } } };
  const lock = { packages: {
    '': {},
    'node_modules/old': { version: '1.0.0', license: 'MPL-2.0' },
    'node_modules/new-mit': { version: '1.0.0', license: 'MIT' },
    'node_modules/dual': { version: '1.0.0', license: '(MIT OR GPL-3.0)' },
    'node_modules/new-gpl': { version: '1.0.0', license: 'GPL-3.0' },
    'node_modules/none': { version: '1.0.0' },
  } };
  assert.deepEqual(disallowedLicences(lock, base), ['node_modules/new-gpl@1.0.0: licence GPL-3.0', 'node_modules/none@1.0.0: licence none']);
});
