// Offline guard for the per-folder CLAUDE.md split (docs/CONTEXT_COST_PLAN.md, C3).
// Fails when the root grows back or the split drifts:
//   - a CLAUDE.md is over its size limit;
//   - the root's area table and the folder CLAUDE.md files that exist do not match;
//   - a repo-wide rule heading is missing from the root;
//   - a rule heading (###) appears in two files.
// Needs only Node and git. Run by `npm run lint` and the CI frontend job.

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT_FILE = 'CLAUDE.md';
export const MAX_BYTES = 14_000;
export const AREA_TABLE_HEADING = '## Where the rest of the rules live';

// Rules every task must see, whatever folder it works in. They stay in the root.
export const ROOT_RULE_HEADINGS = [
  'Privacy — never hardcode or persist any address, GPS coordinate, or station ID',
  'Keep it free',
  'No deprecated dependencies or APIs',
  'DRY — reuse before inventing',
  'Best practices',
  'Phase closeout documentation',
  'No plain-text secrets',
  'Shell commands — platform safety',
  'Keep context lean',
  'Test everything',
  'Line endings',
  'Commit message format',
];

// Tracked and untracked-but-not-ignored, so a new folder file is checked before it is committed.
function findClaudeMdFiles() {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.error?.message || 'unknown error'}`);
  }
  const files = result.stdout
    .split('\n')
    .filter((file) => (file === ROOT_FILE || file.endsWith(`/${ROOT_FILE}`)) && existsSync(resolve(REPO, file)));
  return [...new Set(files)].sort();
}

// Markdown lines outside fenced code blocks (a `# comment` in a bash block is not a heading).
function proseLines(text) {
  const lines = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) lines.push(line);
  }
  return lines;
}

function ruleHeadings(text) {
  return proseLines(text)
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice(4).trim());
}

// Folder files named in the last column of the root's area table.
function areaTableFiles(rootText) {
  const lines = proseLines(rootText);
  const start = lines.indexOf(AREA_TABLE_HEADING);
  if (start === -1) return null;
  const files = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    const match = /^`([^`]*CLAUDE\.md)`/.exec(cells.at(-1) ?? '');
    if (match) files.push(match[1]);
  }
  return files;
}

/** The problems in a set of CLAUDE.md files (a Map of repo-relative path to text); empty when the split holds. */
export function findProblems(texts) {
  const problems = [];
  const files = [...texts.keys()];

  if (!texts.has(ROOT_FILE)) {
    problems.push(`${ROOT_FILE} not found at the repo root`);
  }

  for (const [file, text] of texts) {
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_BYTES) {
      problems.push(`${file} is ${String(bytes)} bytes; the limit is ${String(MAX_BYTES)}. Move area rules to a folder CLAUDE.md or a doc under docs/.`);
    }
  }

  if (texts.has(ROOT_FILE)) {
    const rootText = texts.get(ROOT_FILE);
    const folderFiles = files.filter((file) => file !== ROOT_FILE);
    const listed = areaTableFiles(rootText);
    if (listed === null) {
      problems.push(`${ROOT_FILE} has no "${AREA_TABLE_HEADING}" section`);
    } else {
      for (const file of folderFiles.filter((f) => !listed.includes(f))) {
        problems.push(`${file} exists but is not in the area table in ${ROOT_FILE}`);
      }
      for (const file of listed.filter((f) => !folderFiles.includes(f))) {
        problems.push(`${ROOT_FILE} area table lists ${file}, which does not exist`);
      }
    }

    const rootHeadings = ruleHeadings(rootText);
    for (const heading of ROOT_RULE_HEADINGS.filter((h) => !rootHeadings.includes(h))) {
      problems.push(`${ROOT_FILE} is missing the repo-wide rule heading "### ${heading}"`);
    }
  }

  const headingOwners = new Map();
  for (const [file, text] of texts) {
    for (const heading of ruleHeadings(text)) {
      headingOwners.set(heading, [...(headingOwners.get(heading) ?? []), file]);
    }
  }
  for (const [heading, owners] of headingOwners) {
    if (owners.length > 1) {
      problems.push(`"### ${heading}" appears more than once: ${owners.join(', ')}. Keep each rule in one file.`);
    }
  }

  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = findClaudeMdFiles();
  const texts = new Map(files.map((file) => [file, readFileSync(resolve(REPO, file), 'utf8')]));
  const problems = findProblems(texts);

  if (problems.length > 0) {
    console.error(`CLAUDE.md check failed (${String(problems.length)}):`);
    for (const problem of problems) console.error(` - ${problem}`);
    process.exit(1);
  }

  const sizes = [...texts].map(([file, text]) => `${file} ${String(Buffer.byteLength(text, 'utf8'))}`).join(', ');
  console.log(`CLAUDE.md check passed: ${String(files.length)} files within ${String(MAX_BYTES)} bytes (${sizes}).`);
}
