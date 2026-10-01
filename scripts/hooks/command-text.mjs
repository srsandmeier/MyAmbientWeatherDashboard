// Shared by the PreToolUse hooks: where a command can start in a command line, and which parts of the
// line are text (a commit message, a pull request body) and not commands.

// A command name counts only where a command can start: line start, after ; & | (, or run by xargs / -exec.
export const COMMAND_START = String.raw`(?:^|[;&|(]|\bxargs\s+(?:-\S+\s+)*|\s-exec\s)\s*`;
export const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g;

// A here-document body, up to its closing tag; the rest of the opening line is kept.
const HERE_DOC = /(?<!<)<<(?!<)-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2(?=[ \t]*(?:\n|$))/g;
const POWERSHELL_HERE_STRING = /@(['"])[ \t]*\r?\n[\s\S]*?\n\1@/g;

/** The command line with here-document bodies, PowerShell here-strings and quoted arguments emptied. */
export function withoutText(command) {
  return (command ?? '').replace(HERE_DOC, '$3').replace(POWERSHELL_HERE_STRING, "''").replace(QUOTED, "''");
}
