// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.SF_INSTANCE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 15000
  },
  timeout: 60000,
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.js/,
      testDir: './e2e/fixtures'
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: '.auth/admin.json'
      },
      dependencies: ['auth-setup']
    }
  ],
  outputDir: 'test-results'
});
