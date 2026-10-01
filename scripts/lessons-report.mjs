// Weak-item report for docs/LESSONS_LEARNED.md (docs/QUALITY_PROCESS_PLAN.md, P1).
// Each entry names the checklist item that should have caught it, as `checklist item "Name"` or
// `Lesson: Name` (the tag a reviewer gives a finding), or `Lesson: new`. Items cited by the most
// entries whose prevention is still manual come first, so they are automated first.
//
//   node scripts/lessons-report.mjs           print the report
//   node scripts/lessons-report.mjs --check   exit 1 if the file breaks a rail (format, citations, sizes, markers)
//   node scripts/lessons-report.mjs --json    the report as JSON
//   node scripts/lessons-report.mjs --checklist backend,docs
//                                             only the checklist items for those areas, one line each
//
// The file has to stay cheap to read and to print: it is capped as a whole, per section (a session
// reads one section) and per entry, and the checklist is short enough to print in full.
// Needs only Node. Tests: scripts/lessons-report.test.mjs (`npm run test:scripts`).

import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LESSONS_FILE = 'docs/LESSONS_LEARNED.md';
export const MAX_BYTES = 24 * 1024;
export const SECTION_MAX_BYTES = 6000;
export const ENTRY_MAX_BYTES = 600;
export const MAX_ITEMS = 12;
export const ITEM_MAX_CHARS = 200;
export const CHECKLIST_START = '<!-- process-checklist:start -->';
export const CHECKLIST_END = '<!-- process-checklist:end -->';
// The item that keeps the loop going; the checklist is not complete without it.
export const LOOP_ITEM = 'Misses logged';
// Where a checklist item applies. Self-review prints only the items for the areas a branch changed.
export const AREAS = ['all', 'backend', 'frontend', 'e2e', 'docs'];

function oneLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function checklistText(text) {
  return text.split(CHECKLIST_START)[1]?.split(CHECKLIST_END)[0] ?? '';
}

// Checklist items as { name, areas, text }: `- [ ] **Name.** [area, area] One question?`, wrapped or not.
function checklistItems(text) {
  return checklistText(text)
    .split(/\r?\n(?=- \[ \] )/)
    .map(oneLine)
    .filter((item) => item.startsWith('- [ ] '))
    .map((item) => ({
      name: /^- \[ \] \*\*(.+?)\.?\*\*/.exec(item)?.[1] ?? null,
      areas: /\*\* \[([^\]]*)\]/.exec(item)?.[1].split(',').map((area) => area.trim()) ?? [],
      text: item.replace(/^- \[ \] /, '').replace(/\*\* \[[^\]]*\]/, '**'),
    }));
}

// An entry runs from `- **Miss` to the next blank line or section heading.
function rawEntries(text) {
  return text
    .split(/\r?\n(?=- \*\*Miss)/)
    .filter((entry) => entry.startsWith('- **Miss'))
    .map((entry) => entry.split(/\r?\n\r?\n|\r?\n## /)[0].trimEnd());
}

function missLabel(entry) {
  return oneLine(entry)
    .replace(/^- \*\*Miss[^:]*:\*\* /, '')
    .split(/ \*\*(?:Cause|Prevention):\*\*/)[0]
    .slice(0, 90);
}

/** The checklist items that apply to the given areas (or to every area), one line each. */
export function checklistFor(text, areas) {
  return checklistItems(text)
    .filter((item) => item.areas.includes('all') || item.areas.some((area) => areas.includes(area)))
    .map((item) => item.text);
}

/** Parses the lessons file into checklist items, entries and per-item counts. */
export function lessonsReport(text) {
  const items = checklistItems(text)
    .map((item) => item.name)
    .filter((name) => name !== null);
  const entries = rawEntries(text).map((raw) => {
    const entry = oneLine(raw);
    const cites = [
      ...[...entry.matchAll(/checklist item "([^"]+)"/g)].map((match) => match[1]),
      ...[...entry.matchAll(/Lesson: ([^;)]+?)(?=[;)]|$)/g)].map((match) => match[1].trim()),
    ];
    const prevention = entry.split('**Prevention:**')[1] ?? '';
    const enforced = /\benforced\b/.test(prevention);
    const manual = /\bmanual\b/.test(prevention);
    return {
      miss: missLabel(entry),
      cites: [...new Set(cites)],
      kind: enforced && manual ? 'partly' : enforced ? 'enforced' : 'manual',
    };
  });
  const counts = items.map((name) => {
    const citing = entries.filter((entry) => entry.cites.includes(name));
    return {
      name,
      total: citing.length,
      manual: citing.filter((entry) => entry.kind === 'manual').length,
      partly: citing.filter((entry) => entry.kind === 'partly').length,
      enforced: citing.filter((entry) => entry.kind === 'enforced').length,
    };
  });
  // Weakest first: most entries not fully enforced, then most entries.
  counts.sort((a, b) => b.manual + b.partly - (a.manual + a.partly) || b.total - a.total);
  const unknown = entries.flatMap((entry) =>
    entry.cites.filter((cite) => cite !== 'new' && !items.includes(cite)).map((cite) => `"${cite}" in: ${entry.miss}`),
  );
  const isNew = entries.filter((entry) => entry.cites.includes('new'));
  const unlinked = entries.filter((entry) => entry.cites.length === 0);
  // Not fully enforced and no checklist item: nothing reminds anyone, so automate it or cite an item.
  const unguarded = unlinked.filter((entry) => entry.kind !== 'enforced');
  return { items, entries, counts, unknown, isNew, unlinked, unguarded };
}

/** One line per item, weakest first; `top` limits it to the items still failing. */
export function formatReport(report, top = Infinity) {
  const rows = report.counts.filter((count) => top === Infinity || count.manual + count.partly > 0).slice(0, top);
  return rows
    .map((count) => `${String(count.total).padStart(2)} entries  (${String(count.manual)} manual, ${String(count.partly)} partly, ${String(count.enforced)} enforced)  ${count.name}`)
    .join('\n');
}

/** The rails the lessons file breaks; empty when it is usable as a loop and cheap to read. */
export function findProblems(text) {
  const problems = [];

  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_BYTES) {
    problems.push(`${LESSONS_FILE} is ${String(bytes)} bytes; the limit is ${String(MAX_BYTES)}. Merge duplicate entries or retire ones whose enforced check has not fired.`);
  }
  for (const section of text.split(/\r?\n(?=## )/).filter((part) => part.startsWith('## '))) {
    const sectionBytes = Buffer.byteLength(section, 'utf8');
    if (sectionBytes > SECTION_MAX_BYTES) {
      problems.push(`section "${section.split(/\r?\n/)[0]}" is ${String(sectionBytes)} bytes; the limit is ${String(SECTION_MAX_BYTES)}, so one section stays cheap to read`);
    }
  }

  const start = text.indexOf(CHECKLIST_START);
  const end = text.indexOf(CHECKLIST_END);
  if (start === -1 || end === -1 || end < start) {
    problems.push(`${LESSONS_FILE} needs the process checklist between ${CHECKLIST_START} and ${CHECKLIST_END}`);
  }

  const report = lessonsReport(text);
  const checklist = checklistItems(text);
  if (start !== -1 && end > start) {
    if (checklist.length === 0) {
      problems.push('the process checklist has no item of the form "- [ ] **Name.** [area] …"');
    } else if (!report.items.includes(LOOP_ITEM)) {
      problems.push(`the process checklist has no "${LOOP_ITEM}" item`);
    }
  }
  if (checklist.length > MAX_ITEMS) {
    problems.push(`the process checklist has ${String(checklist.length)} items; the limit is ${String(MAX_ITEMS)}. Automate one or merge two.`);
  }
  for (const item of checklist) {
    const label = item.name ?? item.text.slice(0, 60);
    if (item.name === null) {
      problems.push(`checklist item has no bold name: ${label}`);
    }
    if (item.areas.length === 0 || item.areas.some((area) => !AREAS.includes(area))) {
      problems.push(`checklist item "${label}" needs an area tag after its name, such as [backend] or [all]; the areas are ${AREAS.join(', ')}`);
    }
    if (item.text.length > ITEM_MAX_CHARS) {
      problems.push(`checklist item "${label}" is ${String(item.text.length)} characters; the limit is ${String(ITEM_MAX_CHARS)}, so it prints on one line`);
    }
  }

  const entries = rawEntries(text);
  if (entries.length === 0) {
    problems.push(`${LESSONS_FILE} has no entry starting "- **Miss:**"`);
  }
  for (const raw of entries) {
    const entry = oneLine(raw);
    const missing = [];
    if (!entry.includes('**Cause:**')) missing.push('a **Cause:**');
    if (!entry.includes('**Prevention:**')) missing.push('a **Prevention:**');
    if (!/\((enforced|manual)\b[^)]*\)\.?$/.test(entry)) missing.push('an ending "(enforced: …)" or "(manual)"');
    if (missing.length > 0) problems.push(`entry lacks ${missing.join(' and ')}: ${missLabel(entry)}`);

    const entryBytes = Buffer.byteLength(raw, 'utf8');
    if (entryBytes > ENTRY_MAX_BYTES) {
      problems.push(`entry is ${String(entryBytes)} bytes; the limit is ${String(ENTRY_MAX_BYTES)}: ${missLabel(entry)}`);
    }
  }

  for (const cite of report.unknown) {
    problems.push(`cited item is not in the checklist: ${cite}`);
  }

  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = resolve(REPO, LESSONS_FILE);
  if (!existsSync(file)) {
    console.error(`${LESSONS_FILE} not found`);
    process.exit(1);
  }
  const text = readFileSync(file, 'utf8');
  const report = lessonsReport(text);
  const checklistFlag = process.argv.indexOf('--checklist');

  if (checklistFlag !== -1) {
    const areas = (process.argv[checklistFlag + 1] ?? '').split(',').map((area) => area.trim());
    for (const line of checklistFor(text, areas)) console.log(`- [ ] ${line}`);
  } else if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!process.argv.includes('--check')) {
    console.log(`Weak-item report: ${String(report.entries.length)} lessons, ${String(report.items.length)} checklist items (${LESSONS_FILE})\n`);
    console.log(formatReport(report));
    console.log(`\n${String(report.unlinked.length)} entries name no checklist item; ${String(report.isNew.length)} tagged "Lesson: new".`);
    console.log(`${String(report.unguarded.length)} of them are not fully enforced, so nothing reminds anyone (automate, or cite an item):`);
    for (const entry of report.unguarded) console.log(`  ${entry.kind.padEnd(7)}  ${entry.miss}`);
    console.log('Strengthen or automate the top items first (an enforced check, or a sharper checklist wording).');
  }

  const problems = findProblems(text);
  if (problems.length > 0) {
    console.error(`\nLessons check failed (${String(problems.length)}):`);
    for (const problem of problems) console.error(` - ${problem}`);
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    console.log(`Lessons check passed: ${String(report.entries.length)} entries, ${String(report.items.length)} checklist items, ${String(Buffer.byteLength(text, 'utf8'))} of ${String(MAX_BYTES)} bytes.`);
  }
}
