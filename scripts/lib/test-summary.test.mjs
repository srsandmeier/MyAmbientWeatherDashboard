import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatSuite, summarizeDotnet, summarizeNodeTest, summarizeVitest } from './test-summary.mjs';

const DOTNET_PASS = [
  '  Sample.UnitTests -> /repo/bin/Release/net10.0/Sample.UnitTests.dll',
  'Test run for /repo/bin/Release/net10.0/Sample.UnitTests.dll (.NETCoreApp,Version=v10.0)',
  '',
  'Passed!  - Failed:     0, Passed:   611, Skipped:     0, Total:   611, Duration: 1 s - Sample.UnitTests.dll (net10.0)',
  'Passed!  - Failed:     0, Passed:   166, Skipped:     2, Total:   168, Duration: 42 s - Sample.IntegrationTests.dll (net10.0)',
].join('\r\n');

const DOTNET_FAIL = [
  '[xUnit.net 00:00:10.75]     Sample.IntegrationTests.RepoTests.FirstTest [FAIL]',
  '  Failed Sample.IntegrationTests.RepoTests.FirstTest [1 ms]',
  '  Error Message:',
  "   Class fixture type 'Sample.IntegrationTests.RepoFixture' threw in its constructor",
  '---- Docker is either not running or misconfigured.',
  'You can customize your configuration.',
  'For more information, see the documentation.',
  '  Stack Trace:',
  '   at Sample.IntegrationTests.RepoFixture..ctor() in /repo/RepoTests.cs:line 1',
  '',
  '  Failed Sample.IntegrationTests.RepoTests.SecondTest [1 ms]',
  '  Error Message:',
  "   Class fixture type 'Sample.IntegrationTests.RepoFixture' threw in its constructor",
  '---- Docker is either not running or misconfigured.',
  'You can customize your configuration.',
  '  Stack Trace:',
  '   at Sample.IntegrationTests.RepoFixture..ctor() in /repo/RepoTests.cs:line 1',
  '',
  '  Failed Sample.IntegrationTests.MathTests.AddsNumbers [3 ms]',
  '  Error Message:',
  '   Shouldly.ShouldAssertException : result',
  '    should be',
  '4',
  '    but was',
  '5',
  '  Stack Trace:',
  '   at Sample.IntegrationTests.MathTests.AddsNumbers() in /repo/MathTests.cs:line 9',
  '',
  'Failed!  - Failed:     3, Passed:   140, Skipped:     0, Total:   143, Duration: 42 s - Sample.IntegrationTests.dll (net10.0)',
].join('\n');

test('dotnet: one totals entry per test project', () => {
  const summary = summarizeDotnet(DOTNET_PASS);
  assert.equal(summary.totals, 'Sample.UnitTests 611 passed, 0 failed, 0 skipped · Sample.IntegrationTests 166 passed, 0 failed, 2 skipped');
  assert.deepEqual(summary.failures, []);
  assert.deepEqual(summary.errors, []);
});

test('dotnet: every failing test is named with the first lines of its message, not the stack trace', () => {
  const summary = summarizeDotnet(DOTNET_FAIL);
  assert.deepEqual(summary.failures.map((failure) => failure.name), [
    'Sample.IntegrationTests.RepoTests.FirstTest',
    'Sample.IntegrationTests.RepoTests.SecondTest',
    'Sample.IntegrationTests.MathTests.AddsNumbers',
  ]);
  assert.equal(summary.failures[2].message, 'Shouldly.ShouldAssertException : result\nshould be\n4');
  assert.doesNotMatch(summary.failures.map((failure) => failure.message).join('\n'), /Stack Trace|line 9|For more information/);
  assert.equal(summary.totals, 'Sample.IntegrationTests 140 passed, 3 failed, 0 skipped');
});

test('dotnet: a build error is reported once although MSBuild prints it twice', () => {
  const error = '/repo/src/Thing.cs(12,5): error CS0103: The name x does not exist in the current context [/repo/src/Sample.csproj]';
  const summary = summarizeDotnet([error, '/repo/src/Thing.cs(3,1): warning MA0002: Use an overload', 'Build FAILED.', error].join('\n'));
  assert.deepEqual(summary.errors, [error]);
  assert.equal(summary.totals, '');
});

test('vitest: totals, failed assertions and a file that failed to load', () => {
  const report = {
    numTotalTests: 5,
    numPassedTests: 3,
    testResults: [
      { name: '/repo/frontend/src/a.test.tsx', status: 'passed', assertionResults: [{ fullName: 'A renders', status: 'passed', failureMessages: [] }] },
      {
        name: '/repo/frontend/src/b.test.tsx',
        status: 'failed',
        assertionResults: [
          { fullName: 'B shows the value', status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2\n    at /repo/frontend/src/b.test.tsx:9:3\n    at more\n    at even more'] },
          { fullName: 'B renders', status: 'passed', failureMessages: [] },
        ],
      },
      { name: '/repo/frontend/src/c.test.tsx', status: 'failed', message: 'Error: Failed to resolve import "./missing"', assertionResults: [] },
    ],
  };
  const summary = summarizeVitest(report, (file) => file.replace('/repo/', ''));
  assert.equal(summary.totals, '1/3 files, 3/5 tests passed');
  assert.deepEqual(summary.failures, [
    { name: 'frontend/src/b.test.tsx > B shows the value', message: 'AssertionError: expected 1 to be 2\nat /repo/frontend/src/b.test.tsx:9:3\nat more' },
    { name: 'frontend/src/c.test.tsx', message: 'Error: Failed to resolve import "./missing"' },
  ]);
});

test('vitest: a missing report is an error, not a pass', () => {
  const summary = summarizeVitest(null);
  assert.equal(summary.failures.length, 0);
  assert.equal(summary.errors.length, 1);
});

test('node --test: totals and failing test names from the spec and TAP reporters', () => {
  const spec = ['✔ first (1.2ms)', '✖ second fails (3.4ms)', 'ℹ tests 2', 'ℹ pass 1', 'ℹ fail 1', '', '✖ failing tests:', '', '✖ second fails (3.4ms)'].join('\n');
  assert.deepEqual(summarizeNodeTest(spec), { totals: '1/2 tests passed', failures: [{ name: 'second fails', message: '' }], errors: [] });

  const tap = ['ok 1 - first', 'not ok 2 - second fails', '# tests 2', '# pass 1', '# fail 1'].join('\n');
  assert.deepEqual(summarizeNodeTest(tap), { totals: '1/2 tests passed', failures: [{ name: 'second fails', message: '' }], errors: [] });
});

test('format: a passing suite is one line', () => {
  const lines = formatSuite({ key: 'backend', exitCode: 0, logPath: 'test-results/backend.log', summary: summarizeDotnet(DOTNET_PASS) });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^backend\s+PASSED {2}Sample\.UnitTests 611 passed/);
});

test('format: a failing suite names each failing test and prints a shared message once', () => {
  const lines = formatSuite({ key: 'backend', exitCode: 1, logPath: 'test-results/backend.log', summary: summarizeDotnet(DOTNET_FAIL) });
  assert.match(lines[0], /^backend\s+FAILED \(code 1\)/);
  assert.equal(lines.filter((line) => line.startsWith('  FAIL ')).length, 3);
  assert.equal(lines.filter((line) => line.includes('threw in its constructor')).length, 1);
  assert.equal(lines.at(-1), '  Full log: test-results/backend.log');
});

test('format: a failure with nothing recognised still says so and points at the log', () => {
  const lines = formatSuite({ key: 'backend', exitCode: 1, logPath: 'test-results/backend.log', summary: summarizeDotnet('MSBUILD : unexpected crash') });
  assert.deepEqual(lines.slice(1), ['  No failing test was recognised in the output.', '  Full log: test-results/backend.log']);
});

test('format: a long failure list is capped and the remainder counted', () => {
  const failures = Array.from({ length: 45 }, (_, i) => ({ name: `Test${String(i)}`, message: 'same' }));
  const lines = formatSuite({ key: 'frontend', exitCode: 1, logPath: 'test-results/frontend.log', summary: { totals: 't', failures, errors: [] } });
  assert.equal(lines.filter((line) => line.startsWith('  FAIL ')).length, 40);
  assert.ok(lines.includes('  ... and 5 more failing tests'));
});
