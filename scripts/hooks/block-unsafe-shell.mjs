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

// Adapted from the inclusive-travel-navigator hook (scripts/hooks/no-backslash-writes.mjs). The command line
// is split into pipelines and stages, and each interpreter is judged on its own code only: the `-c`/`-e`
// argument, the here-document it reads, or the text piped into it. So a backslash in a grep pattern or a path
// argument elsewhere on the line does not count, and printing (`sys.stdout.write`) is not a file write.
const HERE_DOC = /<<-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n([\s\S]*?)\n[ \t]*\2(?=[ \t]*(?:\n|$))/g;
const POWERSHELL_HERE_STRING = /@(['"])[ \t]*\r?\n([\s\S]*?)\r?\n\1@/g;
const PROGRAM = /^\s*(?:[\w./\\:-]*[/\\])?(python3?|py|node|perl|cat|tee)(?:\.exe)?(?=\s|$)([\s\S]*)$/;
const ARG = String.raw`('([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+))`;
const INLINE_CODE = {
  python: new RegExp(String.raw`(?:^|\s)-c\s*` + ARG),
  node: new RegExp(String.raw`(?:^|\s)(?:-[a-zA-Z]*[ep]|--eval|--print)(?:=|\s+)` + ARG),
};
const PYTHON_WRITE = /\.write_(text|bytes)\(|(?<!std(?:out|err))\.write\(|\bjson\.dump\(|\bopen\([^)]*,\s*["'](w|a|x|r\+)/;
const NODE_WRITE = /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\b/;
const PERL_IN_PLACE = /(?:^|\s)(?:-[a-zA-Z]*i(?:\.[\w.]*|~)?|--in-place)(?=\s|=|$)/;

/**
 * The pipelines of a command line (split at `;`, `&&`, `||` and new lines outside quotes), each a list of
 * stages (split at `|`) with the here-document and here-string bodies that stage reads.
 */
export function pipelines(command) {
  const bodies = [];
  const keep = (body) => `\u0000${String(bodies.push(body) - 1)}`;
  const text = (command ?? '')
    .replace(HERE_DOC, (_all, _quote, _tag, rest, body) => `<<${keep(body)}${rest}`)
    .replace(POWERSHELL_HERE_STRING, (_all, _quote, body) => `@${keep(body)}`);
  const result = [];
  let stages = [];
  let current = '';
  let quote = '';
  const endStage = () => { stages.push(current); current = ''; };
  const endPipeline = () => { endStage(); result.push(stages); stages = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"' && i + 1 < text.length) current += text[++i];
      else if (ch === quote) quote = '';
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === '\n' || ch === ';') {
      endPipeline();
    } else if ((ch === '&' || ch === '|') && text[i + 1] === ch) {
      endPipeline();
      i++;
    } else if (ch === '|') {
      endStage();
    } else {
      current += ch;
    }
  }
  endPipeline();
  return result
    .map((pipeline) => pipeline
      .filter((stage) => stage.trim() !== '')
      .map((stage) => ({ text: stage, bodies: [...stage.matchAll(/\u0000(\d+)/g)].map((m) => bodies[Number(m[1])]) })))
    .filter((pipeline) => pipeline.length > 0);
}

/**
 * Whether the arguments are only options, so the program reads its code from standard input (`| python -`,
 * `| node`). Split into words rather than matched with one regex: `-X value` and `-\S*` overlap, and a
 * pattern that repeats both backtracks exponentially (CodeQL js/redos).
 */
export function readsStandardInput(args) {
  const words = args.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (words[i] === '-X') i++;
    else if (!words[i].startsWith('-')) return false;
  }
  return true;
}

/** The code an interpreter stage runs, or '' when it runs a script file. */
function inlineCode(language, args, stage, upstream) {
  const pattern = INLINE_CODE[language];
  const match = pattern?.exec(args);
  if (match) return match[2] ?? match[3] ?? match[4] ?? '';
  if (stage.bodies.length > 0) return stage.bodies.join('\n');
  return readsStandardInput(args) ? upstream : '';
}

export function usesSedInPlace(command) {
  // Quoted arguments are the sed script or file names, not flags.
  return [...(command ?? '').matchAll(SED_CALL)].some((call) => IN_PLACE_FLAG.test(call[1].replace(QUOTED, "''")));
}

export function usesPython3(command) {
  return PYTHON3_CALL.test(command ?? '');
}

/** How a command writes a file with a backslash in its code, or an empty string when it does not. */
export function backslashWrite(command) {
  if (!(command ?? '').includes('\\')) return '';
  for (const pipeline of pipelines(command)) {
    for (const [index, stage] of pipeline.entries()) {
      const program = PROGRAM.exec(stage.text);
      if (!program) continue;
      const [, name, args] = program;
      const before = pipeline.slice(0, index);
      const upstream = before.map((s) => [s.text, ...s.bodies].join('\n')).join('\n');
      if (name === 'python' || name === 'python3' || name === 'py') {
        const code = inlineCode('python', args, stage, upstream);
        if (code.includes('\\') && PYTHON_WRITE.test(code)) return 'inline Python that writes a file';
      } else if (name === 'node') {
        const code = inlineCode('node', args, stage, upstream);
        if (code.includes('\\') && NODE_WRITE.test(code)) return '`node -e` code that writes a file';
      } else if (name === 'perl') {
        if (PERL_IN_PLACE.test(args) && [stage.text, ...stage.bodies].join('\n').includes('\\')) return 'an in-place `perl` edit';
      } else if (name === 'cat') {
        if (/>/.test(args) && stage.bodies.some((body) => body.includes('\\'))) return 'a heredoc written to a file';
      } else if ([stage, ...before].some((s) => s.bodies.some((body) => body.includes('\\')))) {
        return 'a heredoc written to a file'; // tee
      }
    }
  }
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
