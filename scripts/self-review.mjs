// Self-review (skill: self-review; docs/QUALITY_PROCESS_PLAN.md, P2). Checks the branch against the
// misses recorded in docs/LESSONS_LEARNED.md before anyone reviews it, so a review finds new problems
// and not the ones we already know we make. No build and no tests; a few seconds.
//
//   node scripts/self-review.mjs              all checks, the weakest checklist items, the checklist
//   node scripts/self-review.mjs --quiet      the checks only (every run after the first on a branch)
//   node scripts/self-review.mjs --required   the required checks only, over the whole repo; needs no
//                                             git history, so CI runs this form
//
// Required checks exit 1. Advisory checks warn. A passing check prints nothing: the last line counts
// them. The branch is compared with its merge base with main; SELF_REVIEW_BASE overrides that, so a
// check can be tried on a slice of history. The rules are in scripts/lib/self-review-rules.mjs.

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { checklistFor, findProblems, formatReport, lessonsReport } from './lessons-report.mjs';
import {
  LESSONS_FILE,
  addedLines,
  addedUnitsWithoutTests,
  areasFor,
  controllersWithoutRateLimit,
  copiedAgentLines,
  dtoChangesWithoutContract,
  handBuiltQueryKeys,
  hasControlCharacters,
  lessonSectionsFor,
  locationLiterals,
  movedInstructionFiles,
  openApiEditedByHand,
  parseNameStatus,
  phaseCommits,
  reviewFixCommits,
  schemaChangesWithoutMigration,
  scopeWarning,
} from './lib/self-review-rules.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_FILE = /\.(cs|csproj|slnx|tsx?|jsx?|mjs|cjs|md|json|css|html|ya?ml|sh|txt)$|(^|\/)\.[\w.]+$/;

function git(...args) {
  const result = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return result.status === 0 ? result.stdout.trimEnd() : '';
}

function lines(text) {
  return text.split('\n').filter(Boolean);
}

function read(file) {
  return readFileSync(resolve(REPO, file), 'utf8');
}

function list(files, limit = 5) {
  return files.length > limit ? `${files.slice(0, limit).join(', ')} and ${String(files.length - limit)} more` : files.join(', ');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const requiredOnly = process.argv.includes('--required');
  const quiet = process.argv.includes('--quiet') || requiredOnly;
  const results = [];
  const check = (name, required, detail) => results.push({ name, required, detail: detail || null });

  const tracked = lines(git('ls-files'));
  if (tracked.length === 0) {
    console.error('Self-review: git lists no tracked files here, so nothing would be checked.');
    process.exit(1);
  }
  const base = requiredOnly ? '' : process.env.SELF_REVIEW_BASE || git('merge-base', 'HEAD', 'main') || git('merge-base', 'HEAD', 'origin/main');
  if (!requiredOnly && base === '') {
    console.error('Self-review: no merge base with main found. Fetch main, set SELF_REVIEW_BASE, or run with --required.');
    process.exit(1);
  }
  const untracked = requiredOnly ? [] : lines(git('ls-files', '--others', '--exclude-standard'));
  const changes = requiredOnly
    ? []
    : [...parseNameStatus(lines(git('diff', '--name-status', base))), ...untracked.map((path) => ({ status: 'A', path, from: null }))];
  const changed = changes.filter((change) => change.status !== 'D').map((change) => change.path);

  // Required.
  const scanned = (requiredOnly ? tracked : changed).filter((file) => TEXT_FILE.test(file) && existsSync(resolve(REPO, file)));
  check('No control characters in changed files', true, list(scanned.filter((file) => hasControlCharacters(read(file)))));

  const lessons = existsSync(resolve(REPO, LESSONS_FILE)) ? read(LESSONS_FILE) : '';
  const lessonProblems = lessons === '' ? [`${LESSONS_FILE} not found`] : findProblems(lessons);
  check('Lessons file keeps its rails', true, lessonProblems.length > 0 ? `${lessonProblems[0]}${lessonProblems.length > 1 ? ` (+${String(lessonProblems.length - 1)}; node scripts/lessons-report.mjs --check)` : ''}` : '');

  const controllers = [...tracked, ...untracked].filter((file) => /^backend\/src\/AmbientWeather\.Api\/Controllers\/\w+Controller\.cs$/.test(file) && existsSync(resolve(REPO, file)));
  check('Every controller has a class-level [EnableRateLimiting]', true, list(controllersWithoutRateLimit(new Map(controllers.map((file) => [file, read(file)])))));

  const instructions = [...tracked, ...untracked].filter((file) => /^\.claude\/(agents|skills)\/.+\.md$/.test(file) && existsSync(resolve(REPO, file)));
  const copies = copiedAgentLines(new Map(instructions.map((file) => [file, read(file)])));
  check('No text copied across agent and skill files', true, copies.length > 0 ? `${copies[0]}${copies.length > 1 ? ` (+${String(copies.length - 1)})` : ''}; keep it in one CLAUDE.md or skill and point to it` : '');

  // Advisory: these need the branch's diff.
  if (!requiredOnly) {
    const subjects = lines(git('log', '--format=%s', `${base}..HEAD`));
    const added = addedLines(git('diff', '-U0', base, '--', 'backend', 'frontend/src', 'tests/e2e', 'docs', 'scripts'));
    for (const file of untracked.filter((path) => TEXT_FILE.test(path))) {
      for (const text of read(file).split('\n')) added.push({ file, text });
    }

    check('Branch is one change', false, scopeWarning(changed));

    const schema = schemaChangesWithoutMigration(changes);
    check('Schema changes have a migration', false, schema.length > 0 ? `${list(schema)} changed and no migration was added (npm run db:migrate -- Name), or the change needs none` : '');

    const dtos = dtoChangesWithoutContract(changed);
    check('DTO changes reach the frontend types', false, dtos.length > 0 ? `${list(dtos)} changed; nothing under frontend/src/types/ and not docs/openapi.json` : '');

    check('docs/openapi.json is generated', false, openApiEditedByHand(changed) ? 'docs/openapi.json changed with no backend change; regenerate it (npm run swagger:generate)' : '');

    const untested = addedUnitsWithoutTests(changes);
    check('New units have tests', false, untested.length > 0 ? `no test file on the branch for ${list(untested)}` : '');

    const fixes = reviewFixCommits(subjects);
    check('Review fixes are logged as lessons', false, fixes.length > 0 && !changed.includes(LESSONS_FILE) ? `${String(fixes.length)} review-fix commit(s) and ${LESSONS_FILE} is unchanged; add an entry for each miss` : '');

    const phases = phaseCommits(subjects);
    check('Phase work updates its docs', false, phases.length > 0 && !changed.some((file) => file.startsWith('docs/')) ? 'commits name a phase and nothing under docs/ changed (CLAUDE.md, "Phase closeout documentation")' : '');

    const moved = movedInstructionFiles(changes);
    check('CLAUDE.md loading re-checked', false, moved.length > 0 ? `${list(moved)} added, moved or deleted; run node scripts/check-instructions-loading.mjs --all` : '');

    const keys = handBuiltQueryKeys(added);
    check('Query keys come from queryKeys', false, keys.length > 0 ? `${list(keys)} adds a queryKey array not built from frontend/src/lib/queryKeys.ts` : '');

    const literals = locationLiterals(added);
    check('No location literals added', false, literals.length > 0 ? `${list(literals)} adds a coordinate- or postcode-shaped literal; use faker or a placeholder (CLAUDE.md, "Privacy")` : '');
  }

  const failed = results.filter((result) => result.required && result.detail !== null);
  const warned = results.filter((result) => !result.required && result.detail !== null);
  for (const result of [...failed, ...warned]) {
    console.log(`${result.required ? 'FAIL' : 'WARN'}  ${result.name}: ${result.detail}`);
  }
  const scope = requiredOnly ? 'required checks, whole repo' : `${String(changed.length)} files against ${base.slice(0, 7)}`;
  console.log(`Self-review: ${String(results.length - failed.length - warned.length)} passed, ${String(warned.length)} warned, ${String(failed.length)} failed (${scope}).`);

  // The checklist lives in the lessons file, so there is one list; only the items for what changed are shown.
  if (!quiet && lessonProblems.length === 0) {
    const weakest = formatReport(lessonsReport(lessons), 3);
    const items = checklistFor(lessons, areasFor(changed));
    const sections = lessonSectionsFor(changed).map((section) => `"## ${section}"`);
    console.log(`\nWeakest checklist items (node scripts/lessons-report.mjs):\n${weakest}`);
    console.log(`\nAnswer before review; a "no" is fixed first${sections.length > 0 ? ` (${LESSONS_FILE}: read ${sections.join(', ')})` : ''}:`);
    for (const item of items) console.log(`- [ ] ${item}`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}
