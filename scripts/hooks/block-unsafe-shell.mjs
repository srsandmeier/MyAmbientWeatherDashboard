// Claude Code PreToolUse hook (Bash, PowerShell): denies the commands that CLAUDE.md prohibits under
// "Shell commands — platform safety" (docs/CONTEXT_COST_PLAN.md, C1) and "Keep context lean":
//   - `sed -i`, which silently truncates files on Windows/Git Bash;
//   - `python3` on Windows, which opens the Microsoft Store instead of the installed interpreter;
//   - a file written by inline Python, `node -e`, `perl -i` or a heredoc whose text holds a backslash
//     ("Keep context lean", "No edit retry loops"): a shell or string layer can drop or double it.
//     Running a script file is allowed; the backslashes are then in a file the Write tool made.
//
// Reads the hook's JSON on stdin; prints a deny decision for a prohibited command and nothing otherwise.
// A problem in the hook itself never blocks or fails the command.

import { fileURLToPath } from 'url';

import { COMMAND_START, QUOTED } from './command-text.mjs';

const SED_CALL = new RegExp(String.raw`${COMMAND_START}sed\s+([^;&|\n]*)`, 'gm');
const IN_PLACE_FLAG = /(?:^|\s)(?:-[a-zA-Z]*i[a-zA-Z.~]*|--in-place(?:=\S*)?)(?=\s|$)/;
const PYTHON3_CALL = new RegExp(String.raw`${COMMAND_START}python3(?:\.exe)?(?=\s|$)`, 'm');

// Ported from the inclusive-travel-navigator hook (scripts/hooks/no-backslash-writes.mjs). Options may sit
// between the program and the inline code (`py -3 -c`, `node --input-type=module <<EOF`); code piped in
// (`echo ... | python -`, a PowerShell here-string `'@ | node`) counts too.
const OPTS = String.raw`(\s+(-X\s+\S+|-[^\s|;&]*))*\s*(?=$|[\n;&|])`;
const INLINE_PYTHON = new RegExp(String.raw`\b(python3?|py)(\.exe)?\b[^|;&\n]*?\s(-c\b|-\s*<<|<<)|\|\s*(python3?|py)(\.exe)?` + OPTS);
const PYTHON_WRITE = /\.write_(text|bytes)\(|\.write\(|\bjson\.dump\(|\bopen\([^)]*,\s*["'](w|a|r\+)/;
const INLINE_NODE = new RegExp(String.raw`\bnode(\.exe)?\b[^|;&\n]*?\s(-[a-zA-Z]*[ep]|--eval|--print)\b|\bnode(\.exe)?\b[^|;&\n]*?\s(-\s*)?<<|\|\s*node(\.exe)?` + OPTS);
const NODE_WRITE = /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\b/;
const PERL_IN_PLACE = /\bperl\b[^|;&\n]*?\s(-[a-zA-Z]*i(\.[\w.]*|~)?|--in-place)(\s|=|$)/;
const HEREDOC_FILE = /\bcat\s*>>?\s*\S+\s*<<|\bcat\s*<<-?\s*['"]?\w+['"]?\s*>>?\s*\S|\btee\b[^|;&]*<<|<<[^|;&\n]*\|\s*tee\b/;

export function usesSedInPlace(command) {
  // Quoted arguments are the sed script or file names, not flags.
  return [...(command ?? '').matchAll(SED_CALL)].some((call) => IN_PLACE_FLAG.test(call[1].replace(QUOTED, "''")));
}

export function usesPython3(command) {
  return PYTHON3_CALL.test(command ?? '');
}

/** How a command writes a file with a backslash in its text, or an empty string when it does not. */
export function backslashWrite(command) {
  const cmd = command ?? '';
  if (!cmd.includes('\\')) return '';
  if (INLINE_PYTHON.test(cmd) && PYTHON_WRITE.test(cmd)) return 'inline Python that writes a file';
  if (INLINE_NODE.test(cmd) && NODE_WRITE.test(cmd)) return '`node -e` code that writes a file';
  if (PERL_IN_PLACE.test(cmd)) return 'an in-place `perl` edit';
  if (HEREDOC_FILE.test(cmd)) return 'a heredoc written to a file';
  return '';
}

/** The reason a command is prohibited, or an empty string when it is allowed. */
export function denyReason(command, platform = process.platform) {
  if (usesSedInPlace(command)) {
    return 'sed -i is prohibited: it silently truncates files on Windows/Git Bash. Use the Edit tool (replace_all for bulk substitutions) instead.';
  }
  if (platform === 'win32' && usesPython3(command)) {
    return 'python3 is prohibited on Windows: the command opens the Microsoft Store instead of the installed interpreter. Use python instead.';
  }
  const how = backslashWrite(command);
  if (how) {
    return `Blocked: ${how} with a backslash in the command; a shell or string layer can drop or double it. Use the Edit tool for changes and the Write tool for new files; for a scripted edit, write the script with the Write tool and run the file.`;
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
