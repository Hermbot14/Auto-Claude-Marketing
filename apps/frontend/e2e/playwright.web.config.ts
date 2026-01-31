/**
 * Playwright configuration for web-based UI testing
 * Tests the Auto-Marketing application running on http://localhost:3000
 */
import { defineConfig, devices } from '@playwright/test';

// Generate timestamp for screenshot directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const screenshotDir = `../../tmp/screenshots-e2e-${timestamp}`;

export default defineConfig({
  testDir: './web-tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false, // Run serially for consistent screenshots
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for consistent state
  reporter: [
    ['html', { outputFolder: '../../tmp/playwright-report/web-report' }],
    ['json', { outputFile: `../../tmp/playwright-results-${timestamp}.json` }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'always', // Always take screenshots for audit
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 }, // Full HD for better screenshots
    ignoreHTTPSErrors: true,
    // Capture screenshots for each test
    screenshotDir
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'always'
      }
    }
  ],
  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
