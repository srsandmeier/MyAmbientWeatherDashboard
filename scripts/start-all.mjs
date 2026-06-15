/**
 * start-all.mjs — Sequential dev startup with Docker pre-flight
 *
 * 1. Check PostgreSQL (:5432) and Redis (:6379) are reachable.
 *    If either is down, run `docker compose up -d` and wait for both.
 * 2. Start `dotnet watch` (API) and wait until /api/health/live returns 200.
 * 3. Start `vite dev` (frontend) once the API is healthy.
 * 4. Forward Ctrl+C to both child processes.
 */

import net  from 'net';
import http from 'http';
import { spawn, execSync } from 'child_process';

// ── ANSI colour helpers ───────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
};

function tag(name, color, text) {
  for (const line of String(text).trimEnd().split('\n')) {
    if (line.trim()) process.stdout.write(`${color}[${name}]${C.reset} ${line}\n`);
  }
}

const info = (msg) => process.stdout.write(`${C.yellow}[start]${C.reset} ${msg}\n`);
const ok   = (msg) => process.stdout.write(`${C.green}[start]${C.reset} ${msg}\n`);
const fail = (msg) => process.stderr.write(`${C.red}[start]${C.reset} ${msg}\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Port / HTTP helpers ───────────────────────────────────────────────────────

function portOpen(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const s = net.connect(port, host);
    s.setTimeout(timeoutMs);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error',   () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

async function waitForPort(label, port, totalMs = 30_000) {
  const deadline = Date.now() + totalMs;
  process.stdout.write(`${C.yellow}[start]${C.reset} Waiting for ${label}…`);
  while (Date.now() < deadline) {
    if (await portOpen(port)) {
      process.stdout.write(` ${C.green}ready${C.reset}\n`);
      return true;
    }
    process.stdout.write('.');
    await sleep(1000);
  }
  process.stdout.write('\n');
  fail(`Timed out waiting for ${label} on :${port}`);
  return false;
}

function httpCheck(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForApi(url, proc, totalMs = 120_000) {
  const deadline = Date.now() + totalMs;
  process.stdout.write(`${C.yellow}[start]${C.reset} Waiting for API health…`);
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      process.stdout.write('\n');
      return false;
    }
    if (await httpCheck(url)) {
      process.stdout.write(` ${C.green}healthy${C.reset}\n`);
      return true;
    }
    process.stdout.write('.');
    await sleep(2000);
  }
  process.stdout.write('\n');
  return false;
}

// ── 1. Docker pre-flight ──────────────────────────────────────────────────────

const pgUp    = await portOpen(5432);
const redisUp = await portOpen(6379);

if (pgUp && redisUp) {
  ok('PostgreSQL :5432  ✓');
  ok('Redis      :6379  ✓');
} else {
  if (!pgUp)    info('PostgreSQL :5432  not reachable');
  if (!redisUp) info('Redis      :6379  not reachable');
  info('Running: docker compose up -d');
  try {
    execSync('docker compose up -d', { stdio: 'inherit' });
  } catch {
    fail('docker compose up -d failed — is Docker Desktop running?');
    process.exit(1);
  }
  if (!await waitForPort('PostgreSQL :5432', 5432)) process.exit(1);
  if (!await waitForPort('Redis :6379',      6379)) process.exit(1);
}

// ── 2. Start API ──────────────────────────────────────────────────────────────

info('Starting API (dotnet watch)…');

const apiProc = spawn('npm', ['run', 'api:watch'], {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
apiProc.stdout.on('data', (d) => tag('api',      C.cyan,    d));
apiProc.stderr.on('data', (d) => tag('api',      C.cyan,    d));

const apiHealthy = await waitForApi('http://localhost:5080/api/health/live', apiProc);
if (!apiHealthy) {
  fail('API did not become healthy — check output above.');
  apiProc.kill();
  process.exit(1);
}

// ── 3. Start frontend ─────────────────────────────────────────────────────────

ok('Launching frontend (Vite)…\n');

const feProc = spawn('npm', ['run', 'dev'], {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
feProc.stdout.on('data', (d) => tag('frontend', C.magenta, d));
feProc.stderr.on('data', (d) => tag('frontend', C.magenta, d));

// ── 4. Status banner ──────────────────────────────────────────────────────────

const sep = '─'.repeat(42);
process.stdout.write(`\n${sep}\n`);
process.stdout.write(`${C.bold} Dev session running${C.reset} — Ctrl+C to stop\n`);
process.stdout.write(`   api      → http://localhost:5080\n`);
process.stdout.write(`   frontend → http://localhost:5173\n`);
process.stdout.write(`${sep}\n\n`);

// ── 5. Lifecycle ──────────────────────────────────────────────────────────────

function shutdown(code = 0) {
  process.stdout.write(`\n${sep}\n Dev session ended\n${sep}\n`);
  try { apiProc.kill(); } catch { /* already gone */ }
  try { feProc.kill();  } catch { /* already gone */ }
  process.exit(code);
}

process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

apiProc.on('close', (code) => {
  if (code !== 0 && code !== null) {
    fail(`API process exited with code ${code}`);
    shutdown(1);
  }
});

feProc.on('close', (code) => {
  if (code !== 0 && code !== null) {
    fail(`Frontend process exited with code ${code}`);
    shutdown(1);
  }
});
