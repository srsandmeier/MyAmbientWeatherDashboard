// Cross-platform replacement for test-all.sh
// Runs the backend, frontend and repo-script test suites sequentially.
// Every suite always runs regardless of the others' results.
//
//   node scripts/test-all.mjs            # npm test — full output of every suite
//   node scripts/test-all.mjs --quiet    # npm run test:quiet — totals only; failing tests named
//   node scripts/test-all.mjs --pre-pr   # npm run pre-pr — self-review and lint, the suites, then E2E P0
//
// Quiet mode (docs/CONTEXT_COST_PLAN.md, C4) sends each suite's full output to test-results/<suite>.log
// and always writes test-results/summary.txt, which holds exactly what it prints. The pre-PR gate
// (docs/QUALITY_PROCESS_PLAN.md, P4) is quiet mode with more suites, not a second runner.

import { spawnSync } from 'child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

import { formatSuite, summarizeDotnet, summarizeLint, summarizeNodeTest, summarizePlaywright, summarizeSelfReview, summarizeVitest } from './lib/test-summary.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS_DIR = join(REPO, 'test-results');
const VITEST_REPORT = join(RESULTS_DIR, 'frontend.json');
const PLAYWRIGHT_REPORT = join(RESULTS_DIR, 'e2e.json');
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
const toRepoPath = (file) => relative(REPO, file).split(sep).join('/');

const SUITES = [
  {
    key: 'backend',
    label: 'Backend (dotnet test)',
    npmScript: 'test:backend',
    summarize: (log) => summarizeDotnet(log),
  },
  {
    key: 'frontend',
    label: 'Frontend (Vitest)',
    npmScript: 'test:frontend',
    // Same runner as frontend's `npm test`, called directly so the reporter flags reach Vitest.
    quietCommand: {
      cwd: join(REPO, 'frontend'),
      args: ['scripts/run-vitest.mjs', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${VITEST_REPORT}`],
    },
    summarize: () => summarizeVitest(readJson(VITEST_REPORT), toRepoPath),
  },
  {
    key: 'scripts',
    label: 'Repo scripts (node --test)',
    npmScript: 'test:scripts',
    summarize: (log) => summarizeNodeTest(log),
  },
];

// The checks that take seconds run first, so their result is in the summary before the suites start.
const BEFORE_SUITES = [
  {
    key: 'self-review',
    quietCommand: { cwd: REPO, args: ['scripts/self-review.mjs', '--quiet'] },
    summarize: (log) => summarizeSelfReview(log),
  },
  {
    key: 'lint',
    npmScript: 'lint',
    summarize: (log) => summarizeLint(log, (file) => (file.startsWith(REPO) ? toRepoPath(file) : file)),
  },
];

const AFTER_SUITES = [
  {
    key: 'e2e',
    // Same runner as tests/e2e's `npm run test:p0`, called directly so the reporter flags reach Playwright.
    // The HTML report keeps the folder playwright.config.ts gives it. One retry, as in CI: a test that
    // passes on its retry is counted as flaky in the summary and does not fail the gate.
    quietCommand: {
      cwd: join(REPO, 'tests', 'e2e'),
      args: ['--no-warnings', './node_modules/@playwright/test/cli.js', 'test', '--grep', '@p0', '--retries=1', '--reporter=line,json,html'],
      env: { PLAYWRIGHT_JSON_OUTPUT_FILE: PLAYWRIGHT_REPORT, PLAYWRIGHT_HTML_OUTPUT_DIR: join(REPO, 'playwright-report'), PLAYWRIGHT_HTML_OPEN: 'never' },
    },
    summarize: () => summarizePlaywright(readJson(PLAYWRIGHT_REPORT)),
  },
];

function runSuite(suite) {
  console.log(`\n=== ${suite.label} ===`);
  // Pass as a single shell string to avoid cmd.exe argument-splitting issues on Windows.
  const result = spawnSync(`npm run ${suite.npmScript}`, { cwd: REPO, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

function runSuiteQuiet(suite) {
  const logPath = join(RESULTS_DIR, `${suite.key}.log`);
  const log = openSync(logPath, 'w');
  const stdio = ['ignore', log, log];
  const result = suite.quietCommand
    ? spawnSync(process.execPath, suite.quietCommand.args, { cwd: suite.quietCommand.cwd, stdio, env: { ...process.env, ...suite.quietCommand.env } })
    : spawnSync(`npm run ${suite.npmScript}`, { cwd: REPO, stdio, shell: true });
  closeSync(log);
  const exitCode = result.status ?? 1;
  return { exitCode, lines: formatSuite({ key: suite.key, exitCode, logPath: toRepoPath(logPath), summary: suite.summarize(readFileSync(logPath, 'utf8')) }) };
}

const prePr = process.argv.includes('--pre-pr');
if (prePr || process.argv.includes('--quiet')) {
  rmSync(RESULTS_DIR, { recursive: true, force: true });
  mkdirSync(RESULTS_DIR, { recursive: true });
  const results = (prePr ? [...BEFORE_SUITES, ...SUITES, ...AFTER_SUITES] : SUITES).map(runSuiteQuiet);
  const lines = results.flatMap((result) => result.lines);
  lines.push(`Full logs: ${toRepoPath(RESULTS_DIR)}/<suite>.log · this summary: ${toRepoPath(RESULTS_DIR)}/summary.txt`);
  writeFileSync(join(RESULTS_DIR, 'summary.txt'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  process.exit(results.every((result) => result.exitCode === 0) ? 0 : 1);
}

const exits = SUITES.map((suite) => ({ key: suite.key, exitCode: runSuite(suite) }));

const sep2 = '==========================================';
console.log(`\n${sep2}`);
console.log(' Test session summary');
console.log(sep2);
for (const { key, exitCode } of exits) {
  console.log(` ${key.padEnd(9)} ${exitCode === 0 ? 'PASSED' : `FAILED (code ${String(exitCode)})`}`);
}
console.log(sep2);

process.exit(exits.every(({ exitCode }) => exitCode === 0) ? 0 : 1);
