// Turns each suite's full test output into a short summary for `npm run test:quiet`
// (docs/CONTEXT_COST_PLAN.md, C4): one totals string per suite, and for a failing suite the name and
// message of each failing test. Pure functions over text, so they are tested without running a suite.

const MESSAGE_LINES = 3;
const LINE_WIDTH = 200;
const MAX_FAILURES_LISTED = 40;

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const clip = (line) => (line.length > LINE_WIDTH ? `${line.slice(0, LINE_WIDTH)}...` : line);
const toLines = (text) => text.replace(ANSI, '').split(/\r?\n/);

function firstLines(text) {
  return toLines(text ?? '').map((line) => line.trim()).filter(Boolean).slice(0, MESSAGE_LINES).map(clip).join('\n');
}

/** `dotnet test` console output: one totals line per test project, failed tests, and build errors. */
export function summarizeDotnet(log) {
  const lines = toLines(log);
  const totals = [];
  const failures = [];
  const errors = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const total = /^(?:Passed|Failed)!\s+- Failed:\s*(\d+), Passed:\s*(\d+), Skipped:\s*(\d+), Total:\s*(\d+),.* - (\S+?)(?:\.dll)? \(/.exec(line);
    if (total) {
      const [, failed, passed, skipped, , project] = total;
      totals.push(`${project} ${passed} passed, ${failed} failed, ${skipped} skipped`);
      continue;
    }

    const failed = /^\s{2}Failed (\S.*?) \[[^\]]*\]\s*$/.exec(line);
    if (failed) {
      const message = [];
      if (/^\s*Error Message:\s*$/.test(lines[i + 1] ?? '')) {
        for (let j = i + 2; j < lines.length && !/^\s*Stack Trace:\s*$/.test(lines[j]) && lines[j].trim() !== ''; j++) {
          message.push(lines[j]);
        }
      }
      failures.push({ name: failed[1], message: firstLines(message.join('\n')) });
      continue;
    }

    if (/: error [A-Z]+\d+: /.test(line)) errors.add(clip(line.trim()));
  }

  return { totals: totals.join(' · '), failures, errors: [...errors] };
}

/** Vitest JSON reporter output (`--reporter=json`); `relativePath` shortens the absolute test file path. */
export function summarizeVitest(report, relativePath = (file) => file) {
  if (!report || !Array.isArray(report.testResults)) {
    return { totals: 'no results file', failures: [], errors: ['Vitest wrote no JSON report; see the log.'] };
  }
  const files = report.testResults;
  const passedFiles = files.filter((file) => file.status === 'passed').length;
  const failures = [];
  for (const file of files) {
    const failedTests = (file.assertionResults ?? []).filter((result) => result.status === 'failed');
    for (const result of failedTests) {
      failures.push({ name: `${relativePath(file.name)} > ${result.fullName}`, message: firstLines(result.failureMessages?.[0]) });
    }
    // A file that fails to load has no failed assertion to name.
    if (file.status === 'failed' && failedTests.length === 0) {
      failures.push({ name: relativePath(file.name), message: firstLines(file.message) });
    }
  }
  return {
    totals: `${String(passedFiles)}/${String(files.length)} files, ${String(report.numPassedTests)}/${String(report.numTotalTests)} tests passed`,
    failures,
    errors: [],
  };
}

/** `node --test` output from the spec or the TAP reporter. */
export function summarizeNodeTest(log) {
  const lines = toLines(log);
  const count = (label) => {
    const found = lines.map((line) => new RegExp(String.raw`^(?:ℹ|#) ${label} (\d+)`).exec(line)).find(Boolean);
    return found ? found[1] : '?';
  };
  const names = new Set();
  for (const line of lines) {
    const failed = /^\s*(?:✖|not ok \d+ -) (.+?)(?: \([\d.]+ms\))?\s*$/.exec(line);
    if (failed && failed[1] !== 'failing tests:') names.add(failed[1]);
  }
  return {
    totals: `${count('pass')}/${count('tests')} tests passed`,
    failures: [...names].map((name) => ({ name, message: '' })),
    errors: [],
  };
}

/**
 * Lines for one suite. A passing suite is one line. A failing suite names every failing test, with
 * tests that share a message (a fixture that could not start, say) grouped under that message once.
 */
export function formatSuite({ key, exitCode, logPath, summary }) {
  const status = exitCode === 0 ? 'PASSED' : `FAILED (code ${String(exitCode)})`;
  const lines = [`${key.padEnd(9)} ${status}  ${summary.totals || 'no totals found'}`];
  if (exitCode === 0) return lines;

  for (const error of summary.errors) lines.push(`  ${error}`);

  const byMessage = new Map();
  for (const failure of summary.failures) {
    byMessage.set(failure.message, [...(byMessage.get(failure.message) ?? []), failure.name]);
  }
  let listed = 0;
  for (const [message, names] of byMessage) {
    for (const name of names) {
      if (listed < MAX_FAILURES_LISTED) lines.push(`  FAIL ${name}`);
      listed++;
    }
    if (message) lines.push(...message.split('\n').map((line) => `       ${line}`));
  }
  if (listed > MAX_FAILURES_LISTED) lines.push(`  ... and ${String(listed - MAX_FAILURES_LISTED)} more failing tests`);
  if (summary.failures.length === 0 && summary.errors.length === 0) lines.push('  No failing test was recognised in the output.');
  lines.push(`  Full log: ${logPath}`);
  return lines;
}
