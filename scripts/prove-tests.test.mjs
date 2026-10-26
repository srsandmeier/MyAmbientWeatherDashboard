import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { proveOne, vitestResult } from './prove-tests.mjs';

const node = JSON.stringify(process.execPath);

function withRepo(text, run) {
  const repo = mkdtempSync(join(tmpdir(), 'prove-tests-'));
  try {
    writeFileSync(join(repo, 'code.txt'), text);
    return run(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test('Vitest totals are read as fail, pass or nothing run', () => {
  assert.deepEqual(vitestResult(' Test Files  1 failed (1)\n      Tests  1 failed | 4 passed (5)\n'), { outcome: 'fail' });
  assert.deepEqual(vitestResult('      Tests  5 passed (5)\n'), { outcome: 'pass' });
  assert.equal(vitestResult('No test files found, exiting with code 1\n').outcome, 'none');
});

test('a command that cannot run, or fails on the unchanged code, is a setup problem, never caught', () => {
  withRepo('const limit = 1;\n', (repo) => {
    for (const cmd of ['no-such-command-for-prove-tests --run', `${node} -e "process.exit(3)"`]) {
      const result = proveOne({ what: 'limit', file: 'code.txt', find: 'limit = 1', replace: 'limit = 2', cmd }, repo);
      assert.equal(result.status, 'SETUP', cmd);
      assert.match(result.detail, /does not pass on the unchanged code \(exit /);
    }
    assert.equal(readFileSync(join(repo, 'code.txt'), 'utf8'), 'const limit = 1;\n');
  });
});

test('the unchanged-code run is made once per test and reused', () => {
  withRepo('a = 1;\nb = 1;\n', (repo) => {
    const counter = join(repo, 'runs.txt');
    writeFileSync(counter, '');
    const cmd = `${node} -e "const fs=require('fs');fs.appendFileSync('runs.txt','x');process.exit(fs.readFileSync('code.txt','utf8').includes('= 2')?1:0)"`;
    const baselines = new Map();
    assert.equal(proveOne({ what: 'a', file: 'code.txt', find: 'a = 1', replace: 'a = 2', cmd }, repo, baselines).status, 'CAUGHT');
    assert.equal(proveOne({ what: 'b', file: 'code.txt', find: 'b = 1', replace: 'b = 2', cmd }, repo, baselines).status, 'CAUGHT');
    assert.equal(readFileSync(counter, 'utf8'), 'xxx');
  });
});

test('a command that fails on the mutated file is caught, and the file is restored', () => {
  withRepo('const limit = 1;\n', (repo) => {
    const cmd = `${node} -e "process.exit(require('fs').readFileSync('code.txt','utf8').includes('limit = 2') ? 1 : 0)"`;
    const result = proveOne({ what: 'limit', file: 'code.txt', find: 'limit = 1', replace: 'limit = 2', cmd }, repo);
    assert.deepEqual(result, { status: 'CAUGHT' });
    assert.equal(readFileSync(join(repo, 'code.txt'), 'utf8'), 'const limit = 1;\n');
  });
});

test('a command that still passes is a miss', () => {
  withRepo('const limit = 1;\n', (repo) => {
    const result = proveOne({ what: 'limit', file: 'code.txt', find: 'limit = 1', replace: 'limit = 2', cmd: `${node} -e "0"` }, repo);
    assert.deepEqual(result, { status: 'MISSED' });
  });
});

test('find text that is missing or appears twice is a setup problem, and nothing is changed', () => {
  withRepo('a a\n', (repo) => {
    assert.match(proveOne({ what: 'x', file: 'code.txt', find: 'a', replace: 'b', cmd: 'exit 1' }, repo).detail, /appears 2 times/);
    assert.match(proveOne({ what: 'x', file: 'code.txt', find: 'zzz', replace: 'b', cmd: 'exit 1' }, repo).detail, /appears 0 times/);
    assert.equal(proveOne({ what: 'x', file: 'gone.txt', find: 'a', replace: 'b', cmd: 'exit 1' }, repo).status, 'SETUP');
    assert.equal(readFileSync(join(repo, 'code.txt'), 'utf8'), 'a a\n');
  });
});
