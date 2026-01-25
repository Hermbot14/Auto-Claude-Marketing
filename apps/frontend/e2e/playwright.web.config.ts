/**
 * Playwright configuration for web-based UI testing
 * Tests the marketing website running on http://localhost:3000
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './web-tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report/web-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        screenshot: 'only-on-failure'
      }
    }
  ],
  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
});
