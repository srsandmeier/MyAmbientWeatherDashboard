// Turns each suite's full test output into a short summary for `npm run test:quiet`
// (docs/CONTEXT_COST_PLAN.md, C4) and `npm run pre-pr` (docs/QUALITY_PROCESS_PLAN.md, P4): one totals
// string per suite, and for a failing suite the name and message of each failing test. Pure functions
// over text, so they are tested without running a suite.

const MESSAGE_LINES = 3;
const LINE_WIDTH = 200;
const MAX_FAILURES_LISTED = 40;
const KEY_WIDTH = 11;

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

/** `scripts/self-review.mjs --quiet` output. A `WARN` does not fail the run, so it is a note. */
export function summarizeSelfReview(log) {
  const lines = toLines(log);
  const counts = lines.map((line) => /^Self-review: (\d+ passed, .+)\.$/.exec(line)).find(Boolean);
  const starting = (prefix) => lines.filter((line) => line.startsWith(prefix)).map((line) => clip(line.slice(prefix.length).trim()));
  return {
    totals: counts ? counts[1] : '',
    failures: starting('FAIL ').map((name) => ({ name, message: '' })),
    // Without the counts line the script stopped early and said why on a `Self-review:` line.
    errors: counts ? [] : starting('Self-review:'),
    notes: starting('WARN ').map((warning) => `WARN ${warning}`),
  };
}

/**
 * `npm run lint` output: the CLAUDE.md check, `dotnet format` and ESLint's default formatter. The
 * three stop at the first that fails, so the problems are from one tool.
 */
export function summarizeLint(log, relativePath = (file) => file) {
  const problems = [];
  let eslintFile = '';
  let claudeMdFailed = false;
  for (const line of toLines(log)) {
    const eslint = /^\s+(\d+:\d+)\s+(?:error|warning)\s+(.+)$/.exec(line);
    if (eslint) problems.push(`${eslintFile}:${eslint[1]} ${eslint[2].trim().replace(/\s{2,}/g, '  ')}`);
    else if (/\(\d+,\d+\): (?:error|warning) /.test(line)) problems.push(line.trim().replace(/^.+?(?=\(\d+,\d+\): )/, relativePath).replace(/ \[[^\]]+proj\]$/, ''));
    else if (claudeMdFailed && line.startsWith(' - ')) problems.push(line.slice(3));
    else if (line.startsWith('CLAUDE.md check failed')) claudeMdFailed = true;
    else if (/^\S.*\.\w+$/.test(line)) eslintFile = relativePath(line);
  }
  const errors = problems.slice(0, MAX_FAILURES_LISTED).map(clip);
  if (problems.length > MAX_FAILURES_LISTED) errors.push(`... and ${String(problems.length - MAX_FAILURES_LISTED)} more problems`);
  return { totals: problems.length === 0 ? 'no problems reported' : `${String(problems.length)} problem${problems.length === 1 ? '' : 's'}`, failures: [], errors };
}

/** Playwright JSON reporter output (`--reporter=json`). */
export function summarizePlaywright(report) {
  if (!report || !report.stats) {
    return { totals: 'no results file', failures: [], errors: ['Playwright wrote no JSON report; see the log.'] };
  }
  const failures = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (spec.ok) continue;
      const results = spec.tests.flatMap((run) => run.results ?? []);
      failures.push({ name: `${spec.file}:${String(spec.line)} › ${spec.title}`, message: firstLines(results.find((result) => result.error)?.error.message) });
    }
    (suite.suites ?? []).forEach(visit);
  };
  (report.suites ?? []).forEach(visit);
  const { expected, unexpected, flaky, skipped } = report.stats;
  return {
    totals: `${String(expected)} passed, ${String(unexpected)} failed, ${String(flaky)} flaky, ${String(skipped)} skipped`,
    failures,
    // An error outside any test: the dev server did not start, or a spec file did not load.
    errors: (report.errors ?? []).map((error) => firstLines(error.message).split('\n')[0]),
  };
}

/**
 * Lines for one suite. A passing suite is one line plus its notes. A failing suite names every failing
 * test, with tests that share a message (a fixture that could not start, say) grouped under that
 * message once.
 */
export function formatSuite({ key, exitCode, logPath, summary }) {
  const status = exitCode === 0 ? 'PASSED' : `FAILED (code ${String(exitCode)})`;
  const lines = [`${key.padEnd(KEY_WIDTH)} ${status}  ${summary.totals || 'no totals found'}`];
  for (const note of summary.notes ?? []) lines.push(`  ${note}`);
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
