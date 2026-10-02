// Branch rules for scripts/self-review.mjs (docs/QUALITY_PROCESS_PLAN.md, P2).
// Pure functions over file lists, `git diff --name-status` lines, commit subjects and file text, so
// scripts/lib/self-review-rules.test.mjs can run each one on synthetic input.

export const MAX_FILES = 25;
export const LESSONS_FILE = 'docs/LESSONS_LEARNED.md';
// Controllers that carry no rate-limit policy by design: liveness probes are anonymous and unmetered.
export const RATE_LIMIT_EXEMPT = ['HealthController'];
// Shared text has one home. A line this long in several agent files, or in a skill and an agent, is a copy.
export const COPY_MIN_CHARS = 60;
export const COPY_MIN_AGENTS = 3;

const AGENT_FILE = /^\.claude\/agents\/[^/]+\.md$/;
const SKILL_FILE = /^\.claude\/skills\/.+\.md$/;
const TEST_FILE = /(^backend\/tests\/|\.test\.[cm]?[jt]sx?$|^tests\/e2e\/)/;

/** `git diff --name-status` lines as { status, path }; a rename counts as its new path. */
export function parseNameStatus(lines) {
  return lines
    .filter((line) => /^[A-Z]\d*\t/.test(line))
    .map((line) => {
      const parts = line.split('\t');
      return { status: parts[0][0], path: parts.at(-1), from: parts.length > 2 ? parts[1] : null };
    });
}

/** The checklist areas (scripts/lessons-report.mjs, AREAS) that a list of changed files touches. */
export function areasFor(files) {
  const areas = new Set();
  for (const file of files) {
    if (file.startsWith('backend/')) areas.add('backend');
    if (file.startsWith('frontend/')) areas.add('frontend');
    if (file.startsWith('tests/e2e/')) areas.add('e2e');
    if (file.startsWith('docs/') || file.endsWith('.md')) areas.add('docs');
  }
  return [...areas];
}

/** The sections of the lessons file worth reading for a list of changed files. */
export function lessonSectionsFor(files) {
  const areas = areasFor(files);
  const sections = [];
  if (areas.includes('backend')) sections.push('Backend');
  if (areas.includes('frontend')) sections.push('Frontend');
  if (areas.includes('e2e') || files.some((file) => TEST_FILE.test(file))) sections.push('Tests and E2E');
  if (areas.includes('docs')) sections.push('Docs and drift');
  if (files.some((file) => /^(scripts\/|\.claude\/|\.github\/)/.test(file))) sections.push('Process');
  return sections;
}

/** True when text holds a control character other than tab, newline and carriage return. */
export function hasControlCharacters(text) {
  return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text);
}

/** Controller classes with no class-level [EnableRateLimiting]; `sources` maps a path to its text. */
export function controllersWithoutRateLimit(sources, exempt = RATE_LIMIT_EXEMPT) {
  const missing = [];
  for (const [file, text] of sources) {
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const name = /^\s*public\s+(?:sealed\s+|abstract\s+|partial\s+)*class\s+(\w+Controller)\b/.exec(line)?.[1];
      if (!name || exempt.includes(name)) return;
      // The attribute block: the lines straight above the class that are attributes or doc comments.
      let top = index;
      while (top > 0 && /^\s*(\[|\/\/\/)/.test(lines[top - 1])) top -= 1;
      if (!lines.slice(top, index).some((attribute) => attribute.includes('[EnableRateLimiting('))) {
        missing.push(`${name} (${file})`);
      }
    });
  }
  return missing;
}

/**
 * Why a branch is probably more than one change, or null. Only the file count is used: a change that
 * follows the rules (DTO, TypeScript type, tests and docs together) spans most top-level folders.
 */
export function scopeWarning(files) {
  return files.length > MAX_FILES ? `${String(files.length)} files (over ${String(MAX_FILES)}): consider splitting the branch` : null;
}

/** Entity or DbContext files changed while no migration was added. */
export function schemaChangesWithoutMigration(changes) {
  const schema = changes
    .filter((change) => /^backend\/src\/AmbientWeather\.(Domain\/Entities|Infrastructure\/Data)\//.test(change.path))
    .map((change) => change.path);
  const added = changes.some((change) => change.status === 'A' && change.path.startsWith('backend/src/AmbientWeather.Infrastructure/Migrations/'));
  return added ? [] : schema;
}

function isBffDto(file) {
  return (
    (file.startsWith('backend/src/AmbientWeather.Application/DTOs/') && !file.includes('/DTOs/AmbientApi/')) ||
    /^backend\/src\/AmbientWeather\.Api\/Controllers\/\w+(Request|Response)\.cs$/.test(file)
  );
}

/** BFF DTOs changed while neither the frontend types nor the OpenAPI snapshot did. */
export function dtoChangesWithoutContract(files) {
  const contract = files.some((file) => file.startsWith('frontend/src/types/') || file === 'docs/openapi.json');
  return contract ? [] : files.filter(isBffDto);
}

/** True when the generated OpenAPI snapshot changed with no backend change behind it. */
export function openApiEditedByHand(files) {
  return files.includes('docs/openapi.json') && !files.some((file) => file.startsWith('backend/src/'));
}

function testedUnitName(file) {
  if (TEST_FILE.test(file)) return null;
  const backend = /^backend\/src\/.+\/(\w+(?:Handler|Validator|Service))\.cs$/.exec(file)?.[1];
  // An interface (IFooService) is tested through its implementation.
  if (backend) return /^I[A-Z]/.test(backend) ? null : backend;
  // shadcn/ui primitives under components/ui are vendored, not tested one by one.
  if (file.startsWith('frontend/src/components/ui/')) return null;
  return /^frontend\/src\/(?:components\/.+\/|components\/|hooks\/)(\w+)\.tsx?$/.exec(file)?.[1] ?? null;
}

/** Added handlers, validators, services, components and hooks with no test file of the same name on the branch. */
export function addedUnitsWithoutTests(changes) {
  const tests = changes.filter((change) => TEST_FILE.test(change.path)).map((change) => change.path.split('/').at(-1));
  return changes
    .filter((change) => change.status === 'A')
    .filter((change) => {
      const name = testedUnitName(change.path);
      return name !== null && !tests.some((test) => test.startsWith(name));
    })
    .map((change) => change.path);
}

/** Commit subjects that say a review finding was fixed. */
export function reviewFixCommits(subjects) {
  return subjects.filter((subject) => /\b(review|reviewer|code-review|ultrareview)\b/i.test(subject) && /\b(fix|fixes|fixed|address|addresses|addressed|findings?)\b/i.test(subject));
}

/** Commit subjects that name a phase. */
export function phaseCommits(subjects) {
  return subjects.filter((subject) => /\bphase[ -]?\d+/i.test(subject));
}

/** CLAUDE.md files added, moved or deleted: what Claude Code loads has changed. */
export function movedInstructionFiles(changes) {
  return changes
    .filter((change) => ['A', 'D', 'R'].includes(change.status))
    .flatMap((change) => [change.from, change.path])
    .filter((file) => file !== null && /(^|\/)CLAUDE\.md$/.test(file));
}

/** Added lines, as { file, text }, from `git diff -U0` output. */
export function addedLines(diff) {
  const lines = [];
  let file = null;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? line.slice(6) : null;
    } else if (file !== null && line.startsWith('+')) {
      lines.push({ file, text: line.slice(1) });
    }
  }
  return lines;
}

/** Frontend files that add a query key built by hand instead of from `queryKeys`. */
export function handBuiltQueryKeys(added) {
  const files = added
    .filter((line) => line.file.startsWith('frontend/src/') && !TEST_FILE.test(line.file) && !line.file.endsWith('/queryKeys.ts'))
    .filter((line) => /queryKey:\s*\[(?!\s*\.\.\.queryKeys\.)/.test(line.text))
    .map((line) => line.file);
  return [...new Set(files)];
}

/** Files that add a coordinate- or postcode-shaped literal on a line about a location (root CLAUDE.md, "Privacy"). */
export function locationLiterals(added) {
  const files = added
    .filter((line) => !/(package-lock\.json|docs\/openapi\.json|\/Migrations\/)/.test(line.file))
    // An assertion tolerance is a small decimal on a latitude or longitude line, not a location.
    .map((line) => ({ ...line, text: line.text.replace(/tolerance:\s*[\d.]+/g, '') }))
    .filter(
      (line) =>
        (/lat|lon|coord/i.test(line.text) && /(?<![\w.])-?\d{1,3}\.\d{4,}(?![\w.])/.test(line.text)) ||
        (/zip|postal/i.test(line.text) && /(?<![\w.#-])\d{5}(?:-\d{4})?(?![\w.%-])/.test(line.text)),
    )
    .map((line) => line.file);
  return [...new Set(files)];
}

function sharedLines(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    // A line that points to a Markdown file is a pointer, the form shared text is meant to take.
    .filter((line) => line.length >= COPY_MIN_CHARS && !/`[^`]*\.md`/.test(line));
  return new Set(lines);
}

/** Lines copied across agent files, or between a skill and an agent; `texts` maps a path to its text. */
export function copiedAgentLines(texts) {
  const owners = new Map();
  for (const [file, text] of texts) {
    for (const line of sharedLines(text)) owners.set(line, [...(owners.get(line) ?? []), file]);
  }
  const copies = [];
  for (const [line, files] of owners) {
    const agents = files.filter((file) => AGENT_FILE.test(file));
    const skills = files.filter((file) => SKILL_FILE.test(file));
    if (agents.length >= COPY_MIN_AGENTS || (agents.length > 0 && skills.length > 0)) {
      copies.push(`"${line.slice(0, 60)}…" in ${files.join(', ')}`);
    }
  }
  return copies;
}
