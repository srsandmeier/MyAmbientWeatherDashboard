import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { GUIDELINES, findProblems, modelTable, parseHeader, references } from './check-agents-skills.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const agent = (name, { header = '', body = '## Must NOT do\n- Guess.\n' } = {}) =>
  `---\nname: ${name}\ndescription: Reviews things. Use when a thing changes.\n${header}---\n\n# ${name}\n\n${body}`;
const skill = (name, body = 'Run `npm run lint`.\n') => `---\nname: ${name}\ndescription: Does a thing. Use after a change.\n---\n\n${body}`;
const guidelines = (rows) => `# Guidelines\n\n| Agent | Model | Owns |\n|---|---|---|\n${rows.map(([n, m]) => `| \`${n}\` | ${m} | things |`).join('\n')}\n`;

function docs(overrides = {}) {
  return new Map(Object.entries({
    '.claude/agents/reviewer.md': agent('reviewer', { header: 'tools: Read, Grep, Bash\nmodel: sonnet\nskills:\n  - checker\n' }),
    '.claude/skills/checker/SKILL.md': skill('checker'),
    [GUIDELINES]: guidelines([['reviewer', 'sonnet']]),
    ...overrides,
  }));
}
const repo = { files: ['backend/src/AmbientWeather.Api/Middleware/Handler.cs', 'scripts/real.mjs'], source: 'class RealService {}', npmScripts: new Set(['lint']) };

test('a wired agent and skill have no problems', () => {
  assert.deepEqual(findProblems(docs(), repo), []);
});

test('the header is parsed with its tools list and preloaded skills', () => {
  const header = parseHeader(agent('reviewer', { header: 'tools: Read, Grep\nmodel: sonnet\nskills:\n  - a\n  - b\n' }));
  assert.deepEqual(header, { skills: ['a', 'b'], name: 'reviewer', description: 'Reviews things. Use when a thing changes.', tools: ['Read', 'Grep'], model: 'sonnet' });
  assert.equal(parseHeader('# No header\n'), null);
});

test('multi-line and quoted descriptions and YAML lists are read like single-line ones', () => {
  const folded = parseHeader('---\nname: reviewer\ndescription: >-\n  Reviews things.\n  Use when a thing changes.\ntools:\n  - Read\n  - Bash\nskills: [checker, "other"]\n---\n');
  assert.deepEqual(folded, { skills: ['checker', 'other'], name: 'reviewer', description: 'Reviews things. Use when a thing changes.', tools: ['Read', 'Bash'] });

  const literal = parseHeader('---\nname: "reviewer"\ndescription: |\n  Reviews things.\n\n  Use when a thing changes.\ntools: [Read, Grep]\n---\n');
  assert.equal(literal.name, 'reviewer');
  assert.equal(literal.description, 'Reviews things.\n\nUse when a thing changes.');
  assert.deepEqual(literal.tools, ['Read', 'Grep']);

  const plain = parseHeader("---\nname: reviewer\ndescription: 'Reviews things.\n  Use when a thing changes.'\n---\n");
  assert.equal(plain.description, 'Reviews things. Use when a thing changes.');
});

test('a folded description and a tools list pass the wiring checks', () => {
  const problems = findProblems(docs({
    '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: >-\n  Reviews things.\n  Use when a thing changes.\ntools:\n  - Read\n  - Bash\nmodel: sonnet\nskills:\n  - checker\n---\n\n## Must NOT do\n',
  }), repo);
  assert.deepEqual(problems, []);
});

test('a missing header, a wrong name and a description with no "Use when" are reported', () => {
  const problems = findProblems(docs({
    '.claude/agents/plain.md': '# Plain\n\n## Must NOT do\n',
    '.claude/skills/checker/SKILL.md': '---\nname: other\ndescription: Does a thing.\n---\n',
  }), repo);
  assert.ok(problems.includes('.claude/agents/plain.md has no YAML header, so Claude Code cannot launch it as a subagent'));
  assert.ok(problems.includes('.claude/skills/checker/SKILL.md: name "other" does not match the file name "checker"'));
  assert.ok(problems.includes('.claude/skills/checker/SKILL.md: the description must say when to use it ("Use when ...")'));
});

test('a missing Must NOT do section and a model that differs from the guidelines are reported', () => {
  const problems = findProblems(docs({
    '.claude/agents/reviewer.md': agent('reviewer', { header: 'tools: Read, Bash\nskills:\n  - checker\n', body: '## Rules\n' }),
  }), repo);
  assert.deepEqual(problems, [
    '.claude/agents/reviewer.md has no "## Must NOT do" section',
    `.claude/agents/reviewer.md: model is session, but ${GUIDELINES} says sonnet`,
  ]);
});

test('a guidelines row for an agent that does not exist is reported', () => {
  const problems = findProblems(docs({ [GUIDELINES]: guidelines([['reviewer', 'sonnet'], ['gone', 'session']]) }), repo);
  assert.deepEqual(problems, [`${GUIDELINES} lists the agent "gone", which does not exist`]);
});

test('an unknown preloaded skill, an unreachable skill and a script skill without Bash are reported', () => {
  const problems = findProblems(docs({
    '.claude/agents/reviewer.md': agent('reviewer', { header: 'tools: Read\nmodel: sonnet\nskills:\n  - checker\n  - missing\n', body: 'Then run `other`.\n\n## Must NOT do\n' }),
    '.claude/skills/other/SKILL.md': skill('other', 'Read the diff.\n'),
  }), repo);
  assert.deepEqual(problems, [
    '.claude/agents/reviewer.md preloads the skill "missing", which does not exist',
    '.claude/agents/reviewer.md names the skill "other" but cannot reach it: preload it or add Skill to tools',
    '.claude/agents/reviewer.md preloads "checker", which runs commands, but has no Bash',
  ]);
});

test('an agent with no tools list inherits every tool and can reach any skill', () => {
  const problems = findProblems(docs({
    '.claude/agents/reviewer.md': agent('reviewer', { header: 'model: sonnet\n', body: 'Run `checker`.\n\n## Must NOT do\n' }),
  }), repo);
  assert.deepEqual(problems, []);
});

test('references keep scripts, npm scripts, paths and code names, and skip routes, placeholders and code blocks', () => {
  const refs = references([
    'Run `node scripts/real.mjs` and `npm run lint`; see `Api/Middleware/` and `RealService.Run()`.',
    'Routes like `/api/health`, `{lat}`, `F.Address.City()` and `ok` are not names.',
    '```',
    'GoneInFence',
    '```',
  ].join('\n'));
  assert.deepEqual([...refs.scripts], ['scripts/real.mjs']);
  assert.deepEqual([...refs.npm], ['lint']);
  assert.deepEqual([...refs.paths], ['Api/Middleware/']);
  assert.deepEqual([...refs.identifiers], ['RealService']);
});

test('stale scripts, npm scripts, paths and identifiers in any document are reported', () => {
  const problems = findProblems(docs({
    'backend/CLAUDE.md': 'Run `node scripts/gone.mjs`, then `npm run gone`. See `Infrastructure/Gone/` and `GoneService`; `Api/Middleware/` and `RealService` exist.\n',
  }), repo);
  assert.deepEqual(problems, [
    'backend/CLAUDE.md runs scripts/gone.mjs, which does not exist',
    'backend/CLAUDE.md runs "npm run gone", which no package.json defines',
    'backend/CLAUDE.md names `Infrastructure/Gone/`, which is not in the repo',
    'backend/CLAUDE.md names `GoneService`, which is not in the source',
  ]);
});

test('the model table reads agent rows and ignores other tables', () => {
  assert.deepEqual([...modelTable(`${guidelines([['a', 'sonnet'], ['b', 'session']])}\n| Concern | Owner |\n|---|---|\n| x | \`a\` |\n`)], [['a', 'sonnet'], ['b', 'session']]);
});

test('the script passes on this repository', () => {
  const result = spawnSync(process.execPath, [join(HERE, 'check-agents-skills.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Agents and skills check passed: \d+ agents, \d+ skills/);
});
