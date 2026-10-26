import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isRisky, note } from './before-rebase.mjs';
import { backslashWrite, denyReason, pipelines, readsStandardInput, usesPython3, usesSedInPlace } from './block-unsafe-shell.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function runHook(script, command) {
  const result = spawnSync(process.execPath, [join(HERE, script)], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout };
}

test('sed in-place edits are detected in every spelling', () => {
  for (const command of [
    'sed -i s/a/b/ file.txt',
    "sed -i.bak 's/a/b/' file.txt",
    "sed -E -i 's/a/b/' file.txt",
    "sed -ni '/x/p' file.txt",
    "sed --in-place 's/a/b/' file.txt",
    "sed --in-place=.bak 's/a/b/' file.txt",
    "cd frontend && sed -i 's/a/b/' file.txt",
    "git ls-files | xargs sed -i 's/a/b/'",
    "git ls-files -z | xargs -0 sed -i 's/a/b/'",
    "find . -name '*.md' -exec sed -i 's/a/b/' {} +",
    "echo start\nsed -i 's/a/b/' file.txt",
  ]) {
    assert.equal(usesSedInPlace(command), true, command);
  }
});

test('other sed calls and mentions of sed -i are allowed', () => {
  for (const command of [
    "sed -n '20,60p' out.txt",
    "sed -E 's/-i //' file.txt",
    "sed 's/a/ -i /' file.txt",
    "cat file.txt | sed 's/a/b/' > other.txt",
    'git commit -m "docs: explain why sed -i is prohibited"',
    'grep -rn "sed -i" docs/',
    'git log --oneline -i --grep based',
    '',
    undefined,
  ]) {
    assert.equal(usesSedInPlace(command), false, String(command));
  }
});

test('python3 is detected only as a command', () => {
  assert.equal(usesPython3('python3 script.py'), true);
  assert.equal(usesPython3('cd scripts && python3 -m http.server'), true);
  assert.equal(usesPython3('python3.exe --version'), true);
  assert.equal(usesPython3('python script.py'), false);
  assert.equal(usesPython3('grep -rn python3 docs/'), false);
  assert.equal(usesPython3('which python python3'), false);
});

test('python3 is denied on Windows only; sed -i is denied everywhere', () => {
  assert.match(denyReason('python3 script.py', 'win32'), /Use python instead/);
  assert.equal(denyReason('python3 script.py', 'linux'), '');
  assert.match(denyReason('sed -i s/a/b/ f', 'linux'), /Edit tool/);
  assert.equal(denyReason('npm run lint', 'win32'), '');
});

test('scripted file writes with a backslash in the command text are detected', () => {
  for (const [command, how] of [
    [String.raw`python -c "open('f.txt','w').write('a\\b')"`, /inline Python/],
    [String.raw`py -3 -c "import pathlib; pathlib.Path('f').write_text('\\d')"`, /inline Python/],
    [String.raw`node -e "require('fs').writeFileSync('f', '\\n')"`, /node -e/],
    ["node - <<'EOF'\nrequire('fs').writeFileSync('f', String.raw`\\d`)\nEOF", /node -e/],
    [String.raw`perl -pi -e 's/\\d/x/' f.txt`, /perl/],
    ["cat > f.txt <<'EOF'\na\\b\nEOF", /heredoc/],
    [String.raw`echo "open('f', 'w').write('\\d')" | python -`, /inline Python/],
    ["@'\nrequire('fs').writeFileSync('f', '\\d')\n'@ | node", /node -e/],
    ["cat <<'EOF' | tee f.txt\na\\b\nEOF", /heredoc/],
    [String.raw`cd scripts && node -e "require('fs').writeFileSync('f', '\\n')"`, /node -e/],
  ]) {
    assert.match(backslashWrite(command), how, command);
    assert.match(denyReason(command, 'linux'), /Write tool/, command);
  }
});

test('reads, script files and backslash-free writes are allowed', () => {
  for (const command of [
    String.raw`node -e "console.log('a\\b')"`,
    String.raw`grep -n "\\bfoo" src/a.ts`,
    'python scratch/apply.py edits.json',
    String.raw`node scripts/prove-tests.mjs C:\\temp\\mutations.json`,
    `node -e "require('fs').writeFileSync('f', 'plain')"`,
    "cat > f.txt <<'EOF'\nplain\nEOF",
    String.raw`perl -Ilib -e 'print "\\n"'`,
    // Printing is not writing a file.
    String.raw`python -c "import sys; sys.stdout.write('a\\n')"`,
    String.raw`python -c "import sys; sys.stderr.write('a\\n')"`,
    // The write keyword and the backslash are in other commands than the interpreter's code.
    String.raw`grep -rn "writeFileSync" src | node -e "x" C:\temp`,
    "cat > f.txt <<'EOF'\nplain\nEOF\ngrep -n \"\\bfoo\" x",
    String.raw`node -e "require('fs').writeFileSync('out.txt', 'x')" C:\temp\in.txt`,
    "git commit -F - <<'EOF'\nfix: handle \\d in patterns\nEOF",
  ]) {
    assert.equal(backslashWrite(command), '', command);
  }
});

test('a command line is split into pipelines and stages outside quotes, keeping here-document bodies', () => {
  const lines = pipelines("a 'x;y' | b && c \"p|q\"\ncat > f <<'EOF'\nbody; with | marks\nEOF");
  assert.deepEqual(lines.map((p) => p.map((s) => s.text.trim())), [["a 'x;y'", 'b'], ['c "p|q"'], ['cat > f <<\u00000']]);
  assert.deepEqual(lines[2][0].bodies, ['body; with | marks']);
});

test('the block hook prints a deny decision for sed -i and nothing for an allowed command', () => {
  const denied = runHook('block-unsafe-shell.mjs', "sed -i 's/a/b/' file.txt");
  assert.equal(denied.status, 0);
  const output = JSON.parse(denied.stdout).hookSpecificOutput;
  assert.equal(output.hookEventName, 'PreToolUse');
  assert.equal(output.permissionDecision, 'deny');
  assert.match(output.permissionDecisionReason, /sed -i is prohibited/);

  assert.deepEqual(runHook('block-unsafe-shell.mjs', "sed -n '1,5p' file.txt"), { status: 0, stdout: '' });
});

test('the hooks stay silent and succeed on input that is not JSON', () => {
  for (const script of ['block-unsafe-shell.mjs', 'before-rebase.mjs']) {
    const result = spawnSync(process.execPath, [join(HERE, script)], { input: 'not json', encoding: 'utf8' });
    assert.deepEqual({ status: result.status, stdout: result.stdout }, { status: 0, stdout: '' }, script);
  }
});

test('rebase, pull and force-push are risky; other git commands are not', () => {
  for (const command of [
    'git rebase origin/main',
    'git pull',
    'git pull --rebase origin main',
    'git push --force',
    'git push --force-with-lease origin HEAD',
    'git push -f origin HEAD',
    'git fetch origin && git rebase origin/main',
    'MSYS_NO_PATHCONV=1 git pull',
    'echo $(git pull)',
    'git commit -m "wip: notes" && git pull',
    'git status\ngit rebase origin/main',
    "cat <<'EOF' > notes.txt\nnotes\nEOF\ngit pull",
  ]) {
    assert.equal(isRisky(command), true, command);
  }
  for (const command of ['git push', 'git push -u origin HEAD', 'git status', 'git log --oneline -5', 'npm run lint', '', undefined]) {
    assert.equal(isRisky(command), false, String(command));
  }
});

test('a command that only mentions rebase, pull or force-push is not risky', () => {
  for (const command of [
    'gh pr create --title "x" --body "Run git rebase origin/main; git pull is not needed"',
    "gh pr comment 7 --body 'after a rebase: git push --force-with-lease'",
    'git commit -m "docs: say when git pull is safe"',
    'grep -rn "git rebase" docs/',
    'echo git pull',
    "git commit -F - <<'EOF'\ndocs: rebase notes\n\ngit pull merges the old commits back in.\ngit push --force is not the fix.\nEOF",
    "gh pr create --body \"$(cat <<'EOF'\nIt's done.\ngit rebase origin/main\nEOF\n)\"",
    "gh pr create --body @'\nIt's done.\ngit rebase origin/main\n'@",
    'git push origin HEAD && echo "--force was not used"',
  ]) {
    assert.equal(isRisky(command), false, command);
  }
});

test('the rebase hook prints nothing for a command that is not risky', () => {
  assert.deepEqual(runHook('before-rebase.mjs', 'git status'), { status: 0, stdout: '' });
});

test('the note says where the branch is and what its pull requests are', () => {
  const open = note({ branch: 'chore/x', local: 'abc1234', remote: 'abc1234', prs: [{ number: 7, state: 'OPEN' }] });
  assert.match(open, /branch chore\/x is at abc1234 locally/);
  assert.match(open, /on origin at abc1234 \(same commit\)/);
  assert.match(open, /PR #7 is OPEN/);
  assert.match(open, /git push --force-with-lease; do not pull/);

  const diverged = note({ branch: 'chore/x', local: 'abc1234', remote: 'def5678', prs: [] });
  assert.match(diverged, /different from local/);
  assert.match(diverged, /No pull request uses this branch/);

  const merged = note({ branch: 'chore/x', local: 'abc1234', remote: '', prs: [{ number: 9, state: 'MERGED' }] });
  assert.match(merged, /It is not on origin/);
  assert.match(merged, /already on main; start a new branch/);
  assert.doesNotMatch(merged, /force-with-lease/);
});

test('no note on a detached HEAD or when the branch is unknown', () => {
  assert.equal(note({ branch: 'HEAD', local: 'abc1234', remote: '', prs: [] }), '');
  assert.equal(note({ branch: '', local: '', remote: '', prs: [] }), '');
});

test('an interpreter with only options reads its code from standard input', () => {
  for (const args of ['', ' -', ' -u -', ' -X utf8 -', ' -X dev']) assert.equal(readsStandardInput(args), true, args);
  for (const args of [' script.py', ' -u script.py', ' -X utf8 script.py']) assert.equal(readsStandardInput(args), false, args);
});

test('the standard-input check stays fast on the input CodeQL flagged', () => {
  const started = performance.now();
  assert.equal(readsStandardInput(` ${'-X - '.repeat(5000)}x`), false);
  assert.ok(performance.now() - started < 100);
});
