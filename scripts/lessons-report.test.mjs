import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CHECKLIST_END,
  CHECKLIST_START,
  ENTRY_MAX_BYTES,
  ITEM_MAX_CHARS,
  LOOP_ITEM,
  MAX_BYTES,
  MAX_ITEMS,
  SECTION_MAX_BYTES,
  checklistFor,
  findProblems,
  formatReport,
  lessonsReport,
} from './lessons-report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const ITEMS = [`- [ ] **Alpha.** [backend] Is a done?`, `- [ ] **Beta.** [frontend, e2e] Is b done?`, `- [ ] **${LOOP_ITEM}.** [all] Logged?`];
const ENTRIES = [
  '- **Miss:** one. **Cause:** c. **Prevention:** checklist item "Beta" (manual).',
  '- **Miss:** two. **Cause:** c. **Prevention:** checklist item "Beta"; a guard (enforced: x; manual in general).',
  '- **Miss:** three. **Cause:** c. **Prevention:** checklist item "Alpha" (enforced: y).',
];
// An entry that cites no item, for files whose checklist is the thing under test.
const UNCITED = ['- **Miss:** four. **Cause:** c. **Prevention:** p (enforced: z).'];

function lessons({ items = ITEMS, entries = ENTRIES, start = CHECKLIST_START, end = CHECKLIST_END, padding = '' } = {}) {
  return ['# Lessons', padding, '## Process checklist', '', start, ...items, end, '', '## Area', '', ...entries, ''].join('\n');
}

test('a file with its markers, a tagged checklist and well-formed entries has no problems', () => {
  assert.deepEqual(findProblems(lessons()), []);
});

test('an entry without a cause, a prevention or an enforced/manual ending is reported', () => {
  const noCause = '- **Miss:** no cause. **Prevention:** p (manual).';
  const noPrevention = '- **Miss:** no prevention. **Cause:** c (manual).';
  const noEnding = '- **Miss:** no ending. **Cause:** c. **Prevention:** it is enforced somewhere.';
  const problems = findProblems(lessons({ entries: [...ENTRIES, noCause, noPrevention, noEnding] }));

  assert.deepEqual(problems, [
    'entry lacks a **Cause:**: no cause.',
    'entry lacks a **Prevention:**: no prevention.',
    'entry lacks an ending "(enforced: …)" or "(manual)": no ending.',
  ]);
});

test('an entry that wraps over several lines is read as one entry', () => {
  const wrapped = '- **Miss:** wrapped\n  over lines.\n  **Cause:** c.\n  **Prevention:** checklist item "Alpha"\n  (enforced: a test).';
  const text = lessons({ entries: [wrapped] });

  assert.deepEqual(findProblems(text), []);
  assert.deepEqual(lessonsReport(text).entries, [{ miss: 'wrapped over lines.', cites: ['Alpha'], kind: 'enforced' }]);
});

test('a cited item that is not in the checklist is reported, by either citation form', () => {
  const quoted = '- **Miss:** quoted. **Cause:** c. **Prevention:** checklist item "Gamma" (manual).';
  const tagged = '- **Miss:** tagged. **Cause:** c (review; Lesson: Delta). **Prevention:** p (manual).';
  const problems = findProblems(lessons({ entries: [...ENTRIES, quoted, tagged] }));

  assert.deepEqual(problems, [
    'cited item is not in the checklist: "Gamma" in: quoted.',
    'cited item is not in the checklist: "Delta" in: tagged.',
  ]);
});

test('"Lesson: new" is counted and is not an unknown citation', () => {
  const tagged = '- **Miss:** fresh. **Cause:** c (review; Lesson: new). **Prevention:** p (manual).';
  const text = lessons({ entries: [...ENTRIES, tagged] });

  assert.deepEqual(findProblems(text), []);
  assert.equal(lessonsReport(text).isNew.length, 1);
});

test('a file over the size cap is reported; a file exactly at the cap is not', () => {
  const room = MAX_BYTES - Buffer.byteLength(lessons(), 'utf8');
  assert.deepEqual(findProblems(lessons({ padding: 'a'.repeat(room) })), []);

  const problems = findProblems(lessons({ padding: 'a'.repeat(room + 1) }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(`^docs/LESSONS_LEARNED.md is ${String(MAX_BYTES + 1)} bytes; the limit is ${String(MAX_BYTES)}`));
});

test('the size caps count bytes, not characters', () => {
  // Two bytes each in UTF-8: half the cap in characters is over the cap once the rest is added.
  const problems = findProblems(lessons({ padding: 'é'.repeat(MAX_BYTES / 2) }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^docs\/LESSONS_LEARNED.md is \d+ bytes; the limit is/);
});

test('a section over its cap is reported, so one section stays cheap to read', () => {
  const filler = Array.from({ length: 20 }, (_, i) => `- **Miss:** m${String(i)} ${'x'.repeat(250)}. **Cause:** c. **Prevention:** p (enforced: z).`);
  const problems = findProblems(lessons({ entries: filler }));

  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(`^section "## Area" is \\d+ bytes; the limit is ${String(SECTION_MAX_BYTES)}`));
});

test('an entry over its cap is reported; an entry exactly at the cap is not', () => {
  const entry = (bytes) => {
    const shell = '- **Miss:** . **Cause:** c. **Prevention:** p (enforced: z).';
    return shell.replace('** .', `** ${'x'.repeat(bytes - shell.length)}.`);
  };
  assert.deepEqual(findProblems(lessons({ entries: [entry(ENTRY_MAX_BYTES)] })), []);

  const problems = findProblems(lessons({ entries: [entry(ENTRY_MAX_BYTES + 1)] }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(`^entry is ${String(ENTRY_MAX_BYTES + 1)} bytes; the limit is ${String(ENTRY_MAX_BYTES)}: xxx`));
});

test('missing or reversed checklist markers are reported', () => {
  const expected = `docs/LESSONS_LEARNED.md needs the process checklist between ${CHECKLIST_START} and ${CHECKLIST_END}`;

  assert.equal(findProblems(lessons({ start: '', entries: UNCITED }))[0], expected);
  assert.equal(findProblems(lessons({ end: '', entries: UNCITED }))[0], expected);
  assert.equal(findProblems(lessons({ start: CHECKLIST_END, end: CHECKLIST_START, entries: UNCITED }))[0], expected);
});

test('an empty checklist, or one without the loop item, is reported', () => {
  assert.deepEqual(findProblems(lessons({ items: [], entries: UNCITED })), ['the process checklist has no item of the form "- [ ] **Name.** [area] …"']);
  assert.deepEqual(findProblems(lessons({ items: ITEMS.slice(0, 2), entries: UNCITED })), [`the process checklist has no "${LOOP_ITEM}" item`]);
});

test('a checklist item without a name, without an area or with an unknown area is reported', () => {
  const areas = 'the areas are all, backend, frontend, e2e, docs';
  const problems = findProblems(
    lessons({ items: [...ITEMS, '- [ ] [all] No name?', '- [ ] **Untagged.** No area?', '- [ ] **Mistagged.** [backend, nowhere] Wrong area?'], entries: UNCITED }),
  );

  assert.deepEqual(problems, [
    'checklist item has no bold name: [all] No name?',
    `checklist item "[all] No name?" needs an area tag after its name, such as [backend] or [all]; ${areas}`,
    `checklist item "Untagged" needs an area tag after its name, such as [backend] or [all]; ${areas}`,
    `checklist item "Mistagged" needs an area tag after its name, such as [backend] or [all]; ${areas}`,
  ]);
});

test('a checklist that is too long, or an item too long to print on one line, is reported', () => {
  const extra = Array.from({ length: MAX_ITEMS - ITEMS.length + 1 }, (_, i) => `- [ ] **Item ${String(i)}.** [all] Done?`);
  assert.deepEqual(findProblems(lessons({ items: [...ITEMS, ...extra], entries: UNCITED })), [
    `the process checklist has ${String(MAX_ITEMS + 1)} items; the limit is ${String(MAX_ITEMS)}. Automate one or merge two.`,
  ]);

  const long = `- [ ] **Long.** [all] ${'word '.repeat(ITEM_MAX_CHARS / 5)}?`;
  const problems = findProblems(lessons({ items: [...ITEMS, long], entries: UNCITED }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(`^checklist item "Long" is \\d+ characters; the limit is ${String(ITEM_MAX_CHARS)}`));
});

test('the checklist for an area holds its items and the items for every area, one line each, without tags', () => {
  const wrapped = '- [ ] **Docs.** [docs] Is the\n      doc current?';
  const text = lessons({ items: [...ITEMS, wrapped] });

  assert.deepEqual(checklistFor(text, ['backend']), ['**Alpha.** Is a done?', `**${LOOP_ITEM}.** Logged?`]);
  assert.deepEqual(checklistFor(text, ['e2e', 'docs']), ['**Beta.** Is b done?', `**${LOOP_ITEM}.** Logged?`, '**Docs.** Is the doc current?']);
  assert.deepEqual(checklistFor(text, []), [`**${LOOP_ITEM}.** Logged?`]);
});

test('items are ranked by entries not fully enforced, then by entries', () => {
  const unguarded = '- **Miss:** five. **Cause:** c. **Prevention:** w (manual).';
  const report = lessonsReport(lessons({ entries: [...ENTRIES, unguarded, ...UNCITED] }));

  assert.deepEqual(report.counts, [
    { name: 'Beta', total: 2, manual: 1, partly: 1, enforced: 0 },
    { name: 'Alpha', total: 1, manual: 0, partly: 0, enforced: 1 },
    { name: LOOP_ITEM, total: 0, manual: 0, partly: 0, enforced: 0 },
  ]);
  assert.equal(report.unlinked.length, 2);
  assert.deepEqual(report.unguarded.map((entry) => entry.miss), ['five.']);
});

test('the formatted report lists every item, or only the top items still failing', () => {
  const report = lessonsReport(lessons());

  assert.equal(formatReport(report).split('\n').length, 3);
  assert.equal(formatReport(report, 3), ' 2 entries  (1 manual, 1 partly, 0 enforced)  Beta');
});

test('the lessons file in this repo passes its own check', () => {
  const result = spawnSync(process.execPath, [join(HERE, 'lessons-report.mjs'), '--check'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Lessons check passed: \d+ entries, \d+ checklist items, \d+ of 24576 bytes\.\n$/);
});
