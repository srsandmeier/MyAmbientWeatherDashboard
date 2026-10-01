import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AREA_TABLE_HEADING, MAX_BYTES, ROOT_FILE, ROOT_RULE_HEADINGS, findProblems } from './check-claude-md.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AREA_FILE = 'area/CLAUDE.md';

function rootText({ tableFiles = [AREA_FILE], headings = ROOT_RULE_HEADINGS, tableHeading = AREA_TABLE_HEADING } = {}) {
  return [
    '# CLAUDE.md',
    '',
    tableHeading,
    '',
    '| Folder | Contents | Rules |',
    '|---|---|---|',
    ...tableFiles.map((file) => `| \`${dirname(file)}/\` | things | \`${file}\` — the rules for it |`),
    '',
    '## Non-negotiable rules (apply everywhere)',
    '',
    ...headings.flatMap((heading) => [`### ${heading}`, 'A rule.', '']),
  ].join('\n');
}

function split(overrides = {}) {
  return new Map(Object.entries({ [ROOT_FILE]: rootText(), [AREA_FILE]: '# Area\n\n### Area rule\nA rule.\n', ...overrides }));
}

test('a root with its area table, its repo-wide headings and one listed folder file has no problems', () => {
  assert.deepEqual(findProblems(split()), []);
});

test('a missing root is reported', () => {
  assert.deepEqual(findProblems(new Map([[AREA_FILE, '# Area\n']])), [`${ROOT_FILE} not found at the repo root`]);
});

test('a file over the size limit is reported; a file exactly at the limit is not', () => {
  const atLimit = 'a'.repeat(MAX_BYTES);
  assert.deepEqual(findProblems(split({ [AREA_FILE]: atLimit })), []);

  const problems = findProblems(split({ [AREA_FILE]: `${atLimit}a` }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(`^area/CLAUDE\\.md is ${String(MAX_BYTES + 1)} bytes; the limit is ${String(MAX_BYTES)}`));
});

test('the size limit counts bytes, not characters', () => {
  const problems = findProblems(split({ [AREA_FILE]: '—'.repeat(MAX_BYTES / 2) }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /bytes; the limit is/);
});

test('a folder file with no row in the area table is reported', () => {
  const problems = findProblems(split({ 'other/CLAUDE.md': '# Other\n' }));
  assert.deepEqual(problems, [`other/CLAUDE.md exists but is not in the area table in ${ROOT_FILE}`]);
});

test('an area table row for a file that does not exist is reported', () => {
  const problems = findProblems(split({ [ROOT_FILE]: rootText({ tableFiles: [AREA_FILE, 'gone/CLAUDE.md'] }) }));
  assert.deepEqual(problems, [`${ROOT_FILE} area table lists gone/CLAUDE.md, which does not exist`]);
});

test('a root with no area table section is reported', () => {
  const problems = findProblems(split({ [ROOT_FILE]: rootText({ tableHeading: '## Somewhere else' }) }));
  assert.deepEqual(problems, [`${ROOT_FILE} has no "${AREA_TABLE_HEADING}" section`]);
});

test('each repo-wide heading missing from the root is reported', () => {
  const [renamed, ...kept] = ROOT_RULE_HEADINGS;
  const problems = findProblems(split({ [ROOT_FILE]: rootText({ headings: [`${renamed} (renamed)`, ...kept] }) }));
  assert.deepEqual(problems, [`${ROOT_FILE} is missing the repo-wide rule heading "### ${renamed}"`]);
});

test('a rule heading in two files is reported with both files', () => {
  const problems = findProblems(split({ [AREA_FILE]: `# Area\n\n### ${ROOT_RULE_HEADINGS[0]}\nA copy.\n` }));
  assert.deepEqual(problems, [
    `"### ${ROOT_RULE_HEADINGS[0]}" appears more than once: ${ROOT_FILE}, ${AREA_FILE}. Keep each rule in one file.`,
  ]);
});

test('headings and table rows inside a fenced code block are ignored', () => {
  const fenced = ['# Area', '', '```bash', `### ${ROOT_RULE_HEADINGS[0]}`, '```', ''].join('\n');
  assert.deepEqual(findProblems(split({ [AREA_FILE]: fenced })), []);

  const root = `${rootText()}\n\`\`\`\n${AREA_TABLE_HEADING}\n| \`x/\` | things | \`gone/CLAUDE.md\` |\n\`\`\`\n`;
  assert.deepEqual(findProblems(split({ [ROOT_FILE]: root })), []);
});

test('the script passes on this repository', () => {
  const result = spawnSync(process.execPath, [join(HERE, 'check-claude-md.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^CLAUDE\.md check passed: \d+ files within/);
});
