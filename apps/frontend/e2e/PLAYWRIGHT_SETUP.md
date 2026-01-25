# Playwright Browser Testing Setup

This document describes the Playwright setup for browser-based UI testing and exploration in the Auto-Claude Marketing project.

## Overview

Playwright is configured for two testing scenarios:

1. **Electron E2E Tests** - Tests the Electron desktop app (existing setup)
2. **Web UI Tests** - Tests the web marketing site at `http://localhost:3000` (new setup)

## Installation

### 1. Install Dependencies

Playwright is already installed as a dev dependency (`@playwright/test@^1.52.0`).

### 2. Install Browser Binaries

```bash
# From apps/frontend/
npm run playwright:install
# or directly
npx playwright install chromium
```

This downloads the Chromium browser binary for your platform.

### 3. Verify Installation

```bash
npx playwright --version
```

## Configuration Files

### Web UI Tests (`playwright.web.config.ts`)

Located at: `e2e/playwright.web.config.ts`

**Configuration highlights:**
- **Base URL:** `http://localhost:3000`
- **Browser:** Chromium
- **Test directory:** `e2e/web-tests/`
- **Auto-starts dev server:** Yes (via `webServer` config)
- **Screenshots:** On failure only
- **Videos:** Retain on failure
- **Reports:** HTML report generated in `playwright-report/web-report/`

### Electron E2E Tests (`playwright.config.ts`)

Located at: `e2e/playwright.config.ts`

Tests the Electron desktop app. Uses the `_electron` launcher from Playwright.

## Running Tests

### 1. Run All Web UI Tests

```bash
# From apps/frontend/
npm run test:e2e:web
```

This will:
1. Start the web dev server on `http://localhost:3000`
2. Launch Chromium browser
3. Run all tests in `e2e/web-tests/`
4. Generate HTML report

### 2. Run Specific Test File

```bash
npx playwright test --config=e2e/playwright.web.config.ts web-tests/basic-ui-exploration.spec.ts
```

### 3. Run Tests in Headed Mode (Show Browser)

```bash
npx playwright test --config=e2e/playwright.web.config.ts --headed
```

### 4. Debug Tests with Browser Inspector

```bash
npx playwright test --config=e2e/playwright.web.config.ts --debug
```

This opens the Playwright Inspector for step-by-step debugging.

### 5. Browser Exploration Script

A standalone script for quick browser exploration without the test framework:

```bash
npm run test:web:explore
# or
node e2e/web-tests/browser-explorer.mjs
```

This will:
- Launch Chromium in visible mode
- Navigate to the marketing site
- Take screenshots at various stages
- Test interactions
- Test responsive viewports
- Keep browser open for 10 seconds for manual inspection

## Test Files

### `basic-ui-exploration.spec.ts`

A comprehensive test suite that demonstrates:

1. **Page Loading** - Verifies the page loads correctly
2. **Navigation Exploration** - Finds and lists all links
3. **Button Interactions** - Clicks buttons and captures state changes
4. **Page Structure** - Analyzes headings, buttons, links, inputs
5. **Responsive Testing** - Tests desktop, tablet, mobile viewports
6. **Form Interactions** - Fills input fields if present

**Screenshots saved to:** `e2e/screenshots/`

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run playwright:install` | Install Chromium browser |
| `npm run test:e2e` | Run Electron E2E tests |
| `npm run test:e2e:web` | Run web UI tests |
| `npm run test:web:explore` | Run browser exploration script |

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

Or open the report file directly:
- Web tests: `apps/frontend/playwright-report/web-report/index.html`

## Screenshots

Screenshots are saved to `e2e/screenshots/`:

- `01-initial-load.png` - Initial page load
- `02-before-navigation-exploration.png` - Before finding links
- `03-after-navigation-exploration.png` - After finding links
- `04-before-button-click.png` - Before button interaction
- `05-after-button-click.png` - After button interaction
- `06-page-structure.png` - Page structure analysis
- `07-viewport-desktop.png` - Desktop viewport
- `08-viewport-tablet.png` - Tablet viewport
- `09-viewport-mobile.png` - Mobile viewport
- `10-before-form-interaction.png` - Before form input
- `11-after-form-interaction.png` - After form input

Exploration script screenshots:
- `explorer-01-initial.png` - Initial load
- `explorer-02-before-interaction.png` - Before interaction
- `explorer-03-after-interaction.png` - After interaction
- `explorer-04-viewport-tablet.png` - Tablet viewport
- `explorer-05-viewport-mobile.png` - Mobile viewport
- `explorer-06-viewport-desktop.png` - Desktop viewport

## Writing New Tests

Create a new test file in `e2e/web-tests/`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');

    // Your test code here
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

## Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Wait for stable state** before assertions
3. **Take screenshots** at key moments for debugging
4. **Test responsive behavior** across viewports
5. **Use page objects** for complex interactions
6. **Keep tests isolated** - each test should work independently

## Troubleshooting

### Browser Not Installed

```bash
npm run playwright:install
```

### Port 3000 Already in Use

Stop any existing dev server or change the port in `playwright.web.config.ts`:

```typescript
webServer: {
  command: 'npm run dev:web -- --port 3001',
  url: 'http://localhost:3001',
  // ...
}
```

### Tests Timing Out

Increase timeout in `playwright.web.config.ts`:

```typescript
timeout: 120_000, // 2 minutes
```

### Headless vs Headed Mode

- **CI/CD:** Uses headless mode (default)
- **Local development:** Use `--headed` flag to see browser

## Integration with CI

The configuration is CI-ready with:
- Automatic retries on failure (2 retries in CI)
- Parallel test execution
- HTML report generation
- Screenshot and video capture on failures

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test Configuration](https://playwright.dev/docs/test-configuration)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Example Workflow

```bash
# 1. Start the web dev server manually (optional, tests auto-start it)
npm run dev:web

# 2. Run tests in a separate terminal
npm run test:e2e:web

# 3. View the report
npx playwright show-report

# 4. For quick exploration
npm run test:web:explore
```

## Summary

The Playwright setup provides:

- ✅ Automated browser testing for the marketing website
- ✅ Screenshot capture for visual verification
- ✅ Responsive testing across viewports
- ✅ Easy exploration script for manual testing
- ✅ CI/CD ready configuration
- ✅ Comprehensive documentation

All tests run against the local dev server at `http://localhost:3000`, making it easy to test changes during development.
