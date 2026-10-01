// Claude Code PreToolUse hook (Bash, PowerShell): before a rebase, pull or force-push, tell Claude whether
// the branch is already on GitHub and has a pull request (docs/CONTEXT_COST_PLAN.md, C6). A pull after a
// rebase merges the old, already-pushed commits back in, and the cleanup costs more than this check.
//
// Reads the hook's JSON on stdin; prints hookSpecificOutput.additionalContext for git rebase, git pull and
// git push --force / -f; prints nothing otherwise. Never blocks the command and never fails it.
// A command that only mentions one of these in text (a commit message, a pull request body, a search
// pattern) gets no note.

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import { COMMAND_START, withoutText } from './command-text.mjs';

// git as a command (after any VAR=value prefixes), not as a word in an argument.
const RISKY = new RegExp(
  String.raw`${COMMAND_START}(?:\w+=\S*\s+)*git(?:\.exe)?\s+(?:rebase\b|pull\b|push\b[^;&|\n]*\s(?:--force(?:-with-lease)?|-f)\b)`,
  'm',
);

export function isRisky(command) {
  return RISKY.test(withoutText(command));
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 8000 });
  return r.status === 0 ? r.stdout.trim() : '';
};

/** Builds the note, given the git and gh answers (so it can be tested without a network). */
export function note({ branch, local, remote, prs }) {
  if (!branch || branch === 'HEAD') return '';
  const lines = [`Before this command: branch ${branch} is at ${local || '?'} locally.`];
  lines.push(remote ? `It is on origin at ${remote}${remote === local ? ' (same commit)' : ' (different from local)'}.` : 'It is not on origin.');
  if (prs.length) {
    for (const p of prs) lines.push(`PR #${String(p.number)} is ${p.state}${p.state === 'MERGED' ? " — this branch's work is already on main; start a new branch instead" : ''}.`);
    if (prs.some((p) => p.state === 'OPEN')) lines.push('After a rebase, update the PR with git push --force-with-lease; do not pull, which merges the old commits back in.');
  } else {
    lines.push('No pull request uses this branch.');
  }
  return lines.join(' ');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = '';
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    try {
      const command = JSON.parse(input).tool_input?.command;
      if (!isRisky(command)) return;
      const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
      const local = run('git', ['rev-parse', '--short', 'HEAD']);
      const remoteLine = run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]);
      const remote = remoteLine ? remoteLine.slice(0, local.length || 7) : '';
      let prs = [];
      try {
        prs = JSON.parse(run('gh', ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state']) || '[]');
      } catch {
        prs = [];
      }
      const text = note({ branch, local, remote, prs });
      if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text } }));
    } catch {
      // A hook problem must never stop the command.
    }
  });
}
