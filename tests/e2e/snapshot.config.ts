import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// UI snapshots for design review (`npm run ui:snapshot`, .claude/skills/ui-snapshot/SKILL.md). Not a test
// suite: it lives outside specs/, so `npm run test:e2e` and CI never run it.
export default defineConfig({
  ...base,
  testDir: './snapshot',
  retries: 0,
  reporter: 'line',
  outputDir: 'test-results/ui-snapshot-run',
});
