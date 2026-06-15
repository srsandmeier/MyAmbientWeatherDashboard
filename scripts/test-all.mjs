// Cross-platform replacement for test-all.sh
// Runs backend then frontend test suites sequentially.
// Both suites always run regardless of the other's result.

import { spawnSync } from 'child_process';

function runSuite(label, npmScript) {
  console.log(`\n=== ${label} ===`);
  // Pass as a single shell string to avoid cmd.exe argument-splitting issues on Windows.
  const result = spawnSync(`npm run ${npmScript}`, { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const backendExit  = runSuite('Backend (dotnet test)', 'test:backend');
const frontendExit = runSuite('Frontend (Vitest)',     'test:frontend');

const sep = '==========================================';
console.log(`\n${sep}`);
console.log(' Test session summary');
console.log(sep);
console.log(` backend   ${backendExit  === 0 ? 'PASSED' : `FAILED (code ${String(backendExit)})`}`);
console.log(` frontend  ${frontendExit === 0 ? 'PASSED' : `FAILED (code ${String(frontendExit)})`}`);
console.log(sep);

process.exit(backendExit === 0 && frontendExit === 0 ? 0 : 1);
