// Claude Code PreToolUse hook (Bash, PowerShell): denies the two commands that CLAUDE.md prohibits under
// "Shell commands — platform safety" (docs/CONTEXT_COST_PLAN.md, C1):
//   - `sed -i`, which silently truncates files on Windows/Git Bash;
//   - `python3` on Windows, which opens the Microsoft Store instead of the installed interpreter.
//
// Reads the hook's JSON on stdin; prints a deny decision for a prohibited command and nothing otherwise.
// A problem in the hook itself never blocks or fails the command.

import { fileURLToPath } from 'url';

// A command name counts only where a command can start: line start, after ; & | (, or run by xargs / -exec.
const COMMAND_START = String.raw`(?:^|[;&|(]|\bxargs\s+(?:-\S+\s+)*|\s-exec\s)\s*`;
const SED_CALL = new RegExp(String.raw`${COMMAND_START}sed\s+([^;&|\n]*)`, 'gm');
const IN_PLACE_FLAG = /(?:^|\s)(?:-[a-zA-Z]*i[a-zA-Z.~]*|--in-place(?:=\S*)?)(?=\s|$)/;
const PYTHON3_CALL = new RegExp(String.raw`${COMMAND_START}python3(?:\.exe)?(?=\s|$)`, 'm');
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g;

export function usesSedInPlace(command) {
  // Quoted arguments are the sed script or file names, not flags.
  return [...(command ?? '').matchAll(SED_CALL)].some((call) => IN_PLACE_FLAG.test(call[1].replace(QUOTED, "''")));
}

export function usesPython3(command) {
  return PYTHON3_CALL.test(command ?? '');
}

/** The reason a command is prohibited, or an empty string when it is allowed. */
export function denyReason(command, platform = process.platform) {
  if (usesSedInPlace(command)) {
    return 'sed -i is prohibited: it silently truncates files on Windows/Git Bash. Use the Edit tool (replace_all for bulk substitutions) instead.';
  }
  if (platform === 'win32' && usesPython3(command)) {
    return 'python3 is prohibited on Windows: the command opens the Microsoft Store instead of the installed interpreter. Use python instead.';
  }
  return '';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = '';
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    try {
      const reason = denyReason(JSON.parse(input).tool_input?.command);
      if (reason) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
        }));
      }
    } catch {
      // A hook problem must never stop the command.
    }
  });
}
