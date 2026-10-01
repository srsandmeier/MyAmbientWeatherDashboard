// Live check that the per-folder CLAUDE.md split loads what it should (docs/CONTEXT_COST_PLAN.md, C3).
// For each task in scripts/claude-md-tasks.json, runs Claude Code headless (Haiku, read-only) on one file
// read, records every instruction file it loads through the InstructionsLoaded hook, and compares that
// with the expected list: the root CLAUDE.md plus the area files for that folder, and nothing else.
//
//   node scripts/check-instructions-loading.mjs        # first three tasks (handler, component, controller)
//   node scripts/check-instructions-loading.mjs --all  # every task (one small Haiku call each)
//
// It makes real model calls, so it is not part of lint, tests or CI; scripts/check-claude-md.mjs checks
// the split offline. Run it after changing which CLAUDE.md files exist or where they live.

import { spawnSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tasks = JSON.parse(readFileSync(join(REPO, 'scripts', 'claude-md-tasks.json'), 'utf8'));
const chosen = process.argv.includes('--all') ? tasks : tasks.slice(0, 3);
const rel = (p) => relative(REPO, p).split(sep).join('/');

let failed = 0;
for (const t of chosen) {
  const log = join(tmpdir(), `instructions-loaded-${String(process.pid)}-${String(Date.now())}.log`);
  const logArg = log.split(sep).join('/');
  const settings = JSON.stringify({
    hooks: { InstructionsLoaded: [{ hooks: [{ type: 'command', command: `cat >> '${logArg}'; echo >> '${logArg}'` }] }] },
  });
  const prompt = `Use the Read tool to read the first 3 lines of ${t.read}, then reply with only the word OK.`;
  // No shell: arguments (the prompt and the settings JSON) pass through unchanged. On Windows the native
  // installer's claude.exe is found on PATH; an npm-installed claude.cmd would need CLAUDE_BIN set to its path.
  const r = spawnSync(process.env.CLAUDE_BIN || 'claude', ['-p', prompt, '--model', 'haiku', '--allowedTools', 'Read', '--settings', settings], {
    cwd: REPO, encoding: 'utf8', input: '', timeout: 240_000,
  });
  const events = existsSync(log)
    ? readFileSync(log, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
    : [];
  rmSync(log, { force: true });
  // Instruction files inside the repo (user-level memory and CLAUDE.md outside the project are not part of the split).
  const loaded = [...new Set(events.map((e) => e.file_path).filter((p) => p && !rel(p).startsWith('..')).map(rel))];
  const missing = t.loads.filter((f) => !loaded.includes(f));
  const extra = loaded.filter((f) => !t.loads.includes(f));
  const ok = r.status === 0 && !missing.length && !extra.length;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t.task}: loaded ${loaded.join(', ') || 'nothing'}` +
    (missing.length ? `; missing ${missing.join(', ')}` : '') + (extra.length ? `; extra ${extra.join(', ')}` : '') +
    (r.status !== 0 ? `; claude exited ${String(r.status)}` : ''));
}
console.log(failed
  ? `\n${String(failed)} of ${String(chosen.length)} tasks loaded the wrong instructions.`
  : `\nAll ${String(chosen.length)} tasks loaded exactly the expected instructions.`);
process.exitCode = failed ? 1 : 0;
