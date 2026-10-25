// Offline guard for the agents (.claude/agents) and skills (.claude/skills) and for every CLAUDE.md
// (docs/AGENT_GUIDELINES.md). Fails when:
//   - an agent or skill has no header, its name differs from its file, or its description has no "Use when";
//   - an agent has no "Must NOT do" section, or its model differs from the table in the guidelines;
//   - an agent preloads a skill that does not exist, names a skill it cannot reach (it has a tools list
//     without Skill and does not preload it), or preloads a skill that runs commands without having Bash;
//   - an agent, skill or CLAUDE.md names a script, npm script, path or code identifier that is not in the
//     repo. Agent files went stale this way: twelve of them named classes and routes that were gone.
// Needs only Node and git. Run by `npm run lint` and the CI frontend job.

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GUIDELINES = 'docs/AGENT_GUIDELINES.md';
const AGENT_FILE = /^\.claude\/agents\/([^/]+)\.md$/;
const SKILL_FILE = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/;
const PACKAGE_FILES = ['package.json', 'frontend/package.json', 'tests/e2e/package.json'];
// Source a named identifier must appear in.
const SOURCE = /^(backend\/(src|tests)|frontend\/(src|scripts)|tests\/e2e|scripts|\.github)\/.+\.(cs|ts|tsx|mjs|js|json|ya?ml|css|props|csproj)$|^backend\/Directory\.Build\.props$/;
const USE_WHEN = /\bUse (when|to|before|after|whenever|for)\b/;
const COMMAND = /\b(node scripts\/|npm run |dotnet |npx )/;

// Names that are written in backticks but are not this repo's code: products, specs and libraries.
const NOT_CODE = new Set(['PostgreSQL', 'TypeScript', 'JavaScript', 'GitHub', 'SignalR', 'OpenAPI', 'OpenTelemetry', 'TanStack', 'ECharts', 'WebKit', 'OAuth']);

/** The YAML header of a Markdown file as { name, description, tools, model, skills }, or null. */
export function parseHeader(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const header = { skills: [] };
  let list = '';
  for (const line of match[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(\S+)/.exec(line);
    if (list === 'skills' && item) {
      header.skills.push(item[1]);
      continue;
    }
    list = '';
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, value] = pair;
    if (key === 'skills' && value === '') list = 'skills';
    else if (key === 'tools') header.tools = value.split(',').map((t) => t.trim()).filter(Boolean);
    else header[key] = value.trim();
  }
  return header;
}

/** Agent name to model ('session' for none) from the guidelines' model table. */
export function modelTable(guidelines) {
  const models = new Map();
  for (const [, name, model] of guidelines.matchAll(/^\|\s*`([a-z-]+)`\s*\|\s*([a-z]+)\s*\|/gm)) models.set(name, model);
  return models;
}

// Backticked spans outside fenced code blocks.
function spans(text) {
  return text.replace(/^```[\s\S]*?^```/gm, '').match(/`[^`\n]+`/g)?.map((s) => s.slice(1, -1)) ?? [];
}

/** The scripts, npm scripts, paths and identifiers a document names. */
export function references(text) {
  const refs = { scripts: new Set(), npm: new Set(), paths: new Set(), identifiers: new Set() };
  for (const [, script] of text.matchAll(/\bnode (scripts\/[\w./-]+\.mjs)/g)) refs.scripts.add(script);
  for (const [, name] of text.matchAll(/\bnpm run ([\w:-]+)/g)) refs.npm.add(name);
  for (const span of spans(text)) {
    // Routes, URLs, placeholders, commands and calls into a faker library are not names in this repo.
    if (/\s|^\/|^https?:|[{}<>*$=]|^\.\.?\/|^(F|faker)\./.test(span)) continue;
    if (span.includes('/') && /(\/|\.(cs|ts|tsx|mjs|json|md|ya?ml|css|props|csproj|slnx))$/.test(span)) {
      refs.paths.add(span);
      continue;
    }
    for (const part of span.replace(/\(\)$/, '').split('.')) {
      if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(part) || /^I[A-Z][a-z]\w+$/.test(part)) refs.identifiers.add(part);
    }
    if (/^\w+\.(cs|tsx?|mjs)$/.test(span)) refs.paths.add(span);
  }
  return refs;
}

/**
 * The problems in a set of documents. `docs` maps repo-relative paths (agents, skills, CLAUDE.md files and
 * the guidelines) to text; `repo` has { files: string[], source: string, npmScripts: Set<string> }.
 */
export function findProblems(docs, repo) {
  const problems = [];
  const agents = [];
  const skills = new Map();
  for (const [file, text] of docs) {
    const agent = AGENT_FILE.exec(file);
    const skill = SKILL_FILE.exec(file);
    if (!agent && !skill) continue;
    const id = (agent ?? skill)[1];
    const header = parseHeader(text);
    if (!header) {
      problems.push(`${file} has no YAML header, so Claude Code cannot ${agent ? 'launch it as a subagent' : 'load it as a skill'}`);
      continue;
    }
    if (header.name !== id) problems.push(`${file}: name "${header.name ?? ''}" does not match the file name "${id}"`);
    if (!USE_WHEN.test(header.description ?? '')) problems.push(`${file}: the description must say when to use it ("Use when ...")`);
    if (agent) agents.push({ file, id, text, header });
    else skills.set(id, text);
  }

  const models = modelTable(docs.get(GUIDELINES) ?? '');
  for (const { file, id, text, header } of agents) {
    if (!/^## Must NOT do$/m.test(text)) problems.push(`${file} has no "## Must NOT do" section`);
    const model = header.model ?? 'session';
    if (models.get(id) !== model) problems.push(`${file}: model is ${model}, but ${GUIDELINES} says ${models.get(id) ?? 'nothing'}`);
    for (const name of header.skills.filter((s) => !skills.has(s))) problems.push(`${file} preloads the skill "${name}", which does not exist`);
    if (header.tools) {
      for (const name of [...skills.keys()].filter((s) => text.includes(`\`${s}\``) && !header.skills.includes(s))) {
        if (!header.tools.includes('Skill')) problems.push(`${file} names the skill "${name}" but cannot reach it: preload it or add Skill to tools`);
      }
      for (const name of header.skills.filter((s) => COMMAND.test(skills.get(s) ?? ''))) {
        if (!header.tools.includes('Bash')) problems.push(`${file} preloads "${name}", which runs commands, but has no Bash`);
      }
    }
  }
  for (const id of models.keys()) {
    if (!agents.some((a) => a.id === id)) problems.push(`${GUIDELINES} lists the agent "${id}", which does not exist`);
  }

  const fileSet = new Set(repo.files);
  // A path may be written from the repo root, from its own folder, or without the `AmbientWeather.` project
  // prefix (`Api/Middleware/`).
  const hasPath = (path) => [path, `AmbientWeather.${path}`].some((p) => {
    const dir = p.endsWith('/') ? p : `${p}/`;
    return fileSet.has(p) || repo.files.some((f) => f.endsWith(`/${p}`) || f.startsWith(dir) || f.includes(`/${dir}`));
  });
  for (const [file, text] of docs) {
    if (file === GUIDELINES) continue;
    const refs = references(text);
    for (const script of refs.scripts) if (!fileSet.has(script)) problems.push(`${file} runs ${script}, which does not exist`);
    for (const name of refs.npm) if (!repo.npmScripts.has(name)) problems.push(`${file} runs "npm run ${name}", which no package.json defines`);
    for (const path of refs.paths) if (!hasPath(path)) problems.push(`${file} names \`${path}\`, which is not in the repo`);
    for (const name of refs.identifiers) {
      if (!NOT_CODE.has(name) && !repo.source.includes(name)) problems.push(`${file} names \`${name}\`, which is not in the source`);
    }
  }
  return problems;
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr || result.error?.message || 'unknown error'}`);
  return [...new Set(result.stdout.split('\n').filter((f) => f && existsSync(resolve(REPO, f))))];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = trackedFiles();
  const docFiles = files.filter((f) => AGENT_FILE.test(f) || SKILL_FILE.test(f) || basename(f) === 'CLAUDE.md' || f === GUIDELINES);
  const docs = new Map(docFiles.map((f) => [f, readFileSync(resolve(REPO, f), 'utf8')]));
  const source = files.filter((f) => SOURCE.test(f)).map((f) => readFileSync(resolve(REPO, f), 'utf8')).join('\n');
  const npmScripts = new Set(PACKAGE_FILES.flatMap((f) => Object.keys(JSON.parse(readFileSync(resolve(REPO, f), 'utf8')).scripts ?? {})));
  const problems = findProblems(docs, { files, source, npmScripts });

  if (problems.length > 0) {
    console.error(`Agents and skills check failed (${String(problems.length)}):`);
    for (const problem of problems) console.error(` - ${problem}`);
    process.exit(1);
  }
  const count = (re) => docFiles.filter((f) => re.test(f)).length;
  console.log(`Agents and skills check passed: ${String(count(AGENT_FILE))} agents, ${String(count(SKILL_FILE))} skills, ${String(docFiles.length)} files checked.`);
}
