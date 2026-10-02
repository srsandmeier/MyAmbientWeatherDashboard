import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  COPY_MIN_CHARS,
  MAX_FILES,
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
} from './self-review-rules.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'backend/src/AmbientWeather.Application';
const INFRA = 'backend/src/AmbientWeather.Infrastructure';
const change = (status, path, from = null) => ({ status, path, from });

test('name-status lines are parsed; a rename keeps both paths', () => {
  assert.deepEqual(parseNameStatus(['M\ta.cs', 'A\tb/c.ts', 'R100\told.md\tnew.md', 'D\tgone.cs', '', 'warning: noise']), [
    change('M', 'a.cs'),
    change('A', 'b/c.ts'),
    change('R', 'new.md', 'old.md'),
    change('D', 'gone.cs'),
  ]);
});

test('changed files map to checklist areas and to lessons sections', () => {
  assert.deepEqual(areasFor(['backend/src/A.cs', 'frontend/src/b.ts', 'tests/e2e/specs/c.spec.ts', 'docs/d.md']), ['backend', 'frontend', 'e2e', 'docs']);
  assert.deepEqual(areasFor(['README.md']), ['docs']);
  assert.deepEqual(areasFor(['scripts/x.mjs', '.github/workflows/ci.yml']), []);

  assert.deepEqual(lessonSectionsFor(['backend/src/A.cs', 'backend/tests/ATests.cs']), ['Backend', 'Tests and E2E']);
  assert.deepEqual(lessonSectionsFor(['frontend/src/b.tsx']), ['Frontend']);
  assert.deepEqual(lessonSectionsFor(['scripts/x.mjs', 'docs/d.md']), ['Docs and drift', 'Process']);
});

test('a control character is found; tab, newline and carriage return are not', () => {
  assert.equal(hasControlCharacters('a\tb\r\nc'), false);
  assert.equal(hasControlCharacters(`a${String.fromCharCode(8)}b`), true);
  assert.equal(hasControlCharacters(`a${String.fromCharCode(27)}[0m`), true);
});

test('a controller without a class-level rate-limit attribute is reported', () => {
  const limited = '[ApiController]\n[Authorize]\n[EnableRateLimiting("per-user")]\npublic sealed class GoodController(IMediator m) : ControllerBase\n{\n}';
  const bare = '[ApiController]\n[Route("api/bare")]\npublic class BareController : ControllerBase\n{\n}';
  // An attribute on an action, below the class line, does not protect actions added later.
  const actionOnly = '[ApiController]\npublic class ActionController : ControllerBase\n{\n    [EnableRateLimiting("per-user")]\n    public IActionResult Get() => Ok();\n}';
  const health = '[ApiController]\npublic sealed class HealthController : ControllerBase\n{\n}';
  const sources = new Map([['Good.cs', limited], ['Bare.cs', bare], ['Action.cs', actionOnly], ['Health.cs', health]]);

  assert.deepEqual(controllersWithoutRateLimit(sources), ['BareController (Bare.cs)', 'ActionController (Action.cs)']);
  assert.deepEqual(controllersWithoutRateLimit(new Map([['Health.cs', health]]), []), ['HealthController (Health.cs)']);
});

test('a branch over the file limit gets a scope warning; one that spans every area does not', () => {
  const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => `backend/src/F${String(i)}.cs`);
  assert.equal(scopeWarning(many.slice(0, MAX_FILES)), null);
  assert.match(scopeWarning(many), /^26 files \(over 25\)/);

  assert.equal(scopeWarning(['backend/a', 'frontend/b', 'tests/e2e/c', 'docs/d', 'scripts/e', 'README.md']), null);
});

test('an entity or DbContext change with no added migration is reported', () => {
  const entity = change('M', 'backend/src/AmbientWeather.Domain/Entities/WeatherStation.cs');
  const context = change('M', `${INFRA}/Data/AmbientWeatherDbContext.cs`);
  const migration = change('A', `${INFRA}/Migrations/20990101000000_AddThing.cs`);
  const snapshot = change('M', `${INFRA}/Migrations/AmbientWeatherDbContextModelSnapshot.cs`);

  assert.deepEqual(schemaChangesWithoutMigration([entity, context]), [entity.path, context.path]);
  assert.deepEqual(schemaChangesWithoutMigration([entity, snapshot]), [entity.path]);
  assert.deepEqual(schemaChangesWithoutMigration([entity, migration]), []);
  assert.deepEqual(schemaChangesWithoutMigration([change('M', `${APP}/Features/X/XHandler.cs`)]), []);
});

test('a BFF DTO change with no frontend type or OpenAPI change is reported', () => {
  const dto = `${APP}/DTOs/Dashboard/CurrentReadingDto.cs`;
  const request = 'backend/src/AmbientWeather.Api/Controllers/UpdateUserPreferencesRequest.cs';
  const ambient = `${APP}/DTOs/AmbientApi/DeviceDto.cs`;

  assert.deepEqual(dtoChangesWithoutContract([dto, request, ambient]), [dto, request]);
  assert.deepEqual(dtoChangesWithoutContract([dto, 'frontend/src/types/dashboard.ts']), []);
  assert.deepEqual(dtoChangesWithoutContract([dto, 'docs/openapi.json']), []);
  assert.deepEqual(dtoChangesWithoutContract([ambient]), []);
});

test('the OpenAPI snapshot changed with no backend source change is a hand edit', () => {
  assert.equal(openApiEditedByHand(['docs/openapi.json', 'frontend/src/types/a.ts']), true);
  assert.equal(openApiEditedByHand(['docs/openapi.json', `${APP}/DTOs/Dashboard/A.cs`]), false);
  assert.equal(openApiEditedByHand(['docs/other.json']), false);
});

test('an added handler, validator, service, component or hook with no test of its name is reported', () => {
  const handler = change('A', `${APP}/Features/X/Queries/GetXQueryHandler.cs`);
  const service = change('A', `${INFRA}/Services/ThingService.cs`);
  const component = change('A', 'frontend/src/components/tiles/NewTile.tsx');
  const hook = change('A', 'frontend/src/hooks/useThing.ts');

  assert.deepEqual(addedUnitsWithoutTests([handler, service, component, hook]), [handler.path, service.path, component.path, hook.path]);
  assert.deepEqual(
    addedUnitsWithoutTests([
      handler,
      change('A', 'backend/tests/AmbientWeather.UnitTests/Features/X/GetXQueryHandlerTests.cs'),
      service,
      change('M', 'backend/tests/AmbientWeather.UnitTests/Infrastructure/ThingServiceTests.cs'),
      component,
      change('A', 'frontend/src/components/tiles/NewTile.test.tsx'),
      hook,
      change('A', 'frontend/src/hooks/useThing.test.ts'),
    ]),
    [],
  );
});

test('changed units, interfaces, vendored primitives and other files need no test of their own', () => {
  assert.deepEqual(
    addedUnitsWithoutTests([
      change('M', `${APP}/Features/X/Queries/GetXQueryHandler.cs`),
      change('A', `${APP}/Interfaces/IThingService.cs`),
      change('A', 'frontend/src/components/ui/button.tsx'),
      change('A', `${APP}/Features/X/Queries/GetXQuery.cs`),
      change('A', 'frontend/src/lib/format.ts'),
    ]),
    [],
  );
});

test('review-fix and phase commits are recognised by their subjects', () => {
  const subjects = ['fix(ui): address review findings on the tile', 'fix(api): fixes from code-review', 'docs(plan): add the review step', 'feat(charts): Phase 12 chart controls', 'chore: phase-13 prep', 'fix(ui): emphasise the label'];

  assert.deepEqual(reviewFixCommits(subjects), [subjects[0], subjects[1]]);
  assert.deepEqual(phaseCommits(subjects), [subjects[3], subjects[4]]);
});

test('an added, moved or deleted CLAUDE.md is reported; an edited one is not', () => {
  assert.deepEqual(
    movedInstructionFiles([change('A', 'tests/CLAUDE.md'), change('R', 'frontend/src/CLAUDE.md', 'frontend/CLAUDE.md'), change('D', 'backend/CLAUDE.md'), change('M', 'CLAUDE.md'), change('A', 'docs/a.md')]),
    ['tests/CLAUDE.md', 'frontend/CLAUDE.md', 'frontend/src/CLAUDE.md', 'backend/CLAUDE.md'],
  );
});

test('added lines are read from a zero-context diff with their file', () => {
  const diff = ['diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts', '@@ -1 +1,2 @@', '-old', '+new one', '+new two', 'diff --git a/y.ts b/y.ts', '--- a/y.ts', '+++ /dev/null', '@@ -1 +0,0 @@', '-gone'].join('\n');

  assert.deepEqual(addedLines(diff), [{ file: 'x.ts', text: 'new one' }, { file: 'x.ts', text: 'new two' }]);
});

test('a query key built by hand is reported; one that starts from queryKeys is not', () => {
  const line = (file, text) => ({ file, text });

  assert.deepEqual(
    handBuiltQueryKeys([
      line('frontend/src/hooks/useA.ts', "    queryKey: ['a', id],"),
      line('frontend/src/hooks/useB.ts', "    queryKey: [...queryKeys.b(), 'more'],"),
      line('frontend/src/hooks/useC.ts', '    queryKey: queryKeys.c(id),'),
      line('frontend/src/hooks/useD.test.ts', "    queryKey: ['d'],"),
      line('frontend/src/lib/queryKeys.ts', "    queryKey: ['e'],"),
    ]),
    ['frontend/src/hooks/useA.ts'],
  );
});

test('a coordinate- or postcode-shaped literal on a location line is reported', () => {
  const line = (file, text) => ({ file, text });
  const digits = (count) => '1'.repeat(count);

  assert.deepEqual(
    locationLiterals([
      line('backend/tests/A.cs', `            Latitude = ${digits(2)}.${digits(4)},`),
      line('tests/e2e/b.ts', `  zipCode: '${digits(5)}',`),
      line('frontend/src/lib/units.ts', `const FACTOR = 0.${digits(5)};`),
      line('backend/tests/C.cs', '            Latitude = F.Address.Latitude(),'),
      line('frontend/src/d.ts', `const longTimeout = ${digits(5)};`),
      line('docs/openapi.json', `"latitude": ${digits(2)}.${digits(4)}`),
      line('backend/tests/E.cs', '        result.Latitude.ShouldBe(latitude, tolerance: 0.0001);'),
    ]),
    ['backend/tests/A.cs', 'tests/e2e/b.ts'],
  );
});

test('a long line in three agent files, or in a skill and an agent, is a copy; a pointer is not', () => {
  const rule = `- ${'A rule that is long enough to count as shared text. '.repeat(2)}`.trim();
  const pointer = `Before a review, follow \`.claude/skills/self-review/SKILL.md\` and report what it finds first of all.`;
  const short = 'Short line.';
  assert.ok(rule.length >= COPY_MIN_CHARS && pointer.length >= COPY_MIN_CHARS);
  const agent = (name) => `.claude/agents/${name}.md`;

  assert.deepEqual(copiedAgentLines(new Map([[agent('a'), rule], [agent('b'), rule]])), []);
  assert.equal(copiedAgentLines(new Map([[agent('a'), rule], [agent('b'), `# B\n  ${rule}  `], [agent('c'), rule]])).length, 1);
  assert.equal(copiedAgentLines(new Map([[agent('a'), rule], ['.claude/skills/x/SKILL.md', rule]])).length, 1);
  assert.deepEqual(copiedAgentLines(new Map(['a', 'b', 'c', 'd'].map((name) => [agent(name), `${pointer}\n${short}`]))), []);
  assert.deepEqual(copiedAgentLines(new Map([['docs/a.md', rule], ['docs/b.md', rule], ['docs/c.md', rule]])), []);
});

test('the required checks pass on this repo and print one line', () => {
  const result = spawnSync(process.execPath, [join(SCRIPTS, 'self-review.mjs'), '--required'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^Self-review: 4 passed, 0 warned, 0 failed \(required checks, whole repo\)\.\n$/);
});
