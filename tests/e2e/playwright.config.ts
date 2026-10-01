import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 4,
  reporter: [['html', { open: 'never', outputFolder: '../../playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    testIdAttribute: 'data-test-id',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results',
  // Starts Vite when nothing answers on 5173 and stops it after the run; a server that is already
  // running (CI, `npm run dev`, `npm run start:all`) is used as it is.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev --prefix ../../frontend', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
