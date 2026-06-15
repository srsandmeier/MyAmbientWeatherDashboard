import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const vitestBin = join(scriptDir, '..', 'node_modules', 'vitest', 'vitest.mjs');
const inheritedOptions = process.env.NODE_OPTIONS?.trim();
const testNodeOptions = [
  inheritedOptions,
  '--no-experimental-webstorage',
  '--disable-warning=ExperimentalWarning',
].filter(Boolean).join(' ');

const result = spawnSync(
  process.execPath,
  [vitestBin, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: testNodeOptions,
    },
  },
);

process.exit(result.status ?? 1);
