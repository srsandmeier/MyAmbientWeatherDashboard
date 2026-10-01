// Cross-platform replacement for test-all.sh
// Runs the backend, frontend and repo-script test suites sequentially.
// Every suite always runs regardless of the others' results.
//
//   node scripts/test-all.mjs            # npm test — full output of every suite
//   node scripts/test-all.mjs --quiet    # npm run test:quiet — totals only; failing tests named
//
// Quiet mode (docs/CONTEXT_COST_PLAN.md, C4) sends each suite's full output to test-results/<suite>.log
// and always writes test-results/summary.txt, which holds exactly what it prints.

import { spawnSync } from 'child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

import { formatSuite, summarizeDotnet, summarizeNodeTest, summarizeVitest } from './lib/test-summary.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS_DIR = join(REPO, 'test-results');
const VITEST_REPORT = join(RESULTS_DIR, 'frontend.json');
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
    summarize: () => summarizeVitest(existsSync(VITEST_REPORT) ? JSON.parse(readFileSync(VITEST_REPORT, 'utf8')) : null, toRepoPath),
  },
  {
    key: 'scripts',
    label: 'Repo scripts (node --test)',
    npmScript: 'test:scripts',
    summarize: (log) => summarizeNodeTest(log),
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
    ? spawnSync(process.execPath, suite.quietCommand.args, { cwd: suite.quietCommand.cwd, stdio })
    : spawnSync(`npm run ${suite.npmScript}`, { cwd: REPO, stdio, shell: true });
  closeSync(log);
  const exitCode = result.status ?? 1;
  return { exitCode, lines: formatSuite({ key: suite.key, exitCode, logPath: toRepoPath(logPath), summary: suite.summarize(readFileSync(logPath, 'utf8')) }) };
}

if (process.argv.includes('--quiet')) {
  rmSync(RESULTS_DIR, { recursive: true, force: true });
  mkdirSync(RESULTS_DIR, { recursive: true });
  const results = SUITES.map(runSuiteQuiet);
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
