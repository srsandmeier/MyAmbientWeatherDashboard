// Proves that new tests catch the bugs they guard against: puts each old bug back, runs the test that
// should catch it, and restores the file (.claude/agents/qa-engineer.md, "Prove new tests").
//
//   node scripts/prove-tests.mjs mutations.json
//
// mutations.json (keep it in your scratchpad) is a list of { what, file, find, replace, test, name?, cmd? }:
//   file     path from the repo root, edited in place and always restored (also on Ctrl+C)
//   find     exact text that must appear exactly once; replaced by `replace`
//   test     a Vitest file under frontend/ (e.g. src/lib/units.test.ts), optionally narrowed by `name` (-t)
//   cmd      instead of Vitest, any command run from the repo root; a non-zero exit counts as caught
//            (dotnet test --filter ..., node --test scripts/x.test.mjs, one Playwright spec)
// Prints one line per mutation (CAUGHT, MISSED, NO-RUN, SETUP) and exits 1 unless all were caught.

import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND = join(REPO, 'frontend');

// Windows briefly locks a file just written (antivirus, indexers), so file access retries for a few seconds.
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN']);
function withRetry(action) {
  for (let attempt = 1; ; attempt++) {
    try {
      return action();
    } catch (err) {
      if (attempt >= 20 || !LOCK_CODES.has(err.code)) throw err;
      sleep(250);
    }
  }
}
const readText = (file) => withRetry(() => readFileSync(file, 'utf8'));
const writeText = (file, text) => withRetry(() => writeFileSync(file, text));

let pending = null; // { file, original } while a mutation is applied
function restore() {
  if (!pending) return;
  const { file, original } = pending;
  try {
    writeText(file, original);
    if (readText(file) !== original) throw new Error('content differs after the write');
  } catch (err) {
    console.error(`\nRESTORE FAILED for ${relative(REPO, file)}: ${err.message}. Restore it with git before committing.`);
    process.exitCode = 3;
  }
  pending = null;
}
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

/** Reads the Vitest totals line ("Tests  1 failed | 4 passed (5)") into a result. */
export function vitestResult(output) {
  const summary = /^\s*Tests\s+(.*)$/m.exec(output)?.[1] ?? '';
  if (/\d+ failed/.test(summary)) return { status: 'CAUGHT' };
  if (!/\d+ passed/.test(summary)) return { status: 'NO-RUN', detail: summary || 'no Vitest summary (did the file or name match a test?)' };
  return { status: 'MISSED' };
}

export function proveOne(m, repo = REPO) {
  const file = join(repo, m.file);
  if (!existsSync(file)) return { status: 'SETUP', detail: `no file ${m.file}` };
  const original = readText(file);
  const count = original.split(m.find).length - 1;
  if (count !== 1) return { status: 'SETUP', detail: `"find" text appears ${String(count)} times in ${m.file}` };
  pending = { file, original };
  try {
    writeText(file, original.replace(m.find, () => m.replace));
    if (m.cmd) {
      const r = spawnSync(m.cmd, { cwd: repo, shell: true, encoding: 'utf8' });
      return { status: r.status !== 0 ? 'CAUGHT' : 'MISSED' };
    }
    const args = ['scripts/run-vitest.mjs', 'run', m.test, ...(m.name ? ['-t', String(m.name)] : [])];
    const r = spawnSync(process.execPath, args, { cwd: FRONTEND, encoding: 'utf8' });
    return vitestResult(`${r.stdout}${r.stderr}`);
  } finally {
    restore();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = process.argv[2];
  if (!list) {
    console.error('Usage: node scripts/prove-tests.mjs mutations.json');
    process.exit(2);
  }
  const mutations = JSON.parse(readFileSync(list, 'utf8'));
  let failed = 0;
  for (const m of mutations) {
    const r = proveOne(m);
    if (r.status !== 'CAUGHT') failed++;
    console.log(`${r.status.padEnd(6)} ${m.what}${r.detail ? ` (${r.detail})` : ''}`);
    // A file left mutated would make every later result meaningless: stop.
    if (process.exitCode === 3) {
      console.error('Stopped: a file could not be restored.');
      process.exit(3);
    }
  }
  console.log(failed ? `\n${String(failed)} of ${String(mutations.length)} not caught.` : `\nAll ${String(mutations.length)} caught.`);
  process.exitCode = failed ? 1 : 0;
}
