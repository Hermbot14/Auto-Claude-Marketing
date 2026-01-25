# Playwright Browser Testing - Complete Setup Guide

## Overview

Playwright has been configured for browser-based UI testing and exploration in the Auto-Claude Marketing project. This setup allows automated testing of the web marketing website at `http://localhost:3000`.

## What Has Been Set Up

### 1. Configuration Files Created

- **`apps/frontend/e2e/playwright.web.config.ts`** - Web UI test configuration
- **`apps/frontend/e2e/web-tests/basic-ui-exploration.spec.ts`** - Comprehensive test suite
- **`apps/frontend/e2e/web-tests/browser-explorer.mjs`** - Standalone exploration script
- **`apps/frontend/e2e/verify-playwright-setup.mjs`** - Setup verification script

### 2. Documentation Created

- **`apps/frontend/e2e/PLAYWRIGHT_SETUP.md`** - Complete setup documentation
- **`apps/frontend/e2e/web-tests/README.md`** - Quick start guide for web tests

### 3. NPM Scripts Added

Added to `apps/frontend/package.json`:
```json
{
  "test:e2e:web": "npx playwright test --config=e2e/playwright.web.config.ts",
  "test:web:explore": "node e2e/web-tests/browser-explorer.mjs",
  "playwright:install": "npx playwright install chromium"
}
```

## Installation Steps

### Step 1: Install Dependencies

Playwright is already listed as a dev dependency. To install:

```bash
# From project root
npm install

# OR from apps/frontend/
cd apps/frontend
npm install
```

### Step 2: Install Browser Binaries

```bash
# From apps/frontend/
npm run playwright:install
# or
npx playwright install chromium
```

This downloads the Chromium browser binary for your platform.

### Step 3: Verify Installation

```bash
node e2e/verify-playwright-setup.mjs
```

This will check:
- Playwright installation
- Configuration files
- Directory structure
- Browser availability

## Running Tests

### Option 1: Run Full Test Suite

```bash
cd apps/frontend
npm run test:e2e:web
```

This will:
- Start the web dev server on port 3000
- Launch Chromium browser
- Run all tests in `e2e/web-tests/`
- Generate HTML report in `playwright-report/web-report/`

### Option 2: Run Specific Test

```bash
cd apps/frontend
npx playwright test --config=e2e/playwright.web.config.ts web-tests/basic-ui-exploration.spec.ts
```

### Option 3: Run with Visible Browser

```bash
npx playwright test --config=e2e/playwright.web.config.ts --headed
```

### Option 4: Debug Mode

```bash
npx playwright test --config=e2e/playwright.web.config.ts --debug
```

This opens the Playwright Inspector for step-by-step debugging.

### Option 5: Browser Exploration Script

```bash
cd apps/frontend
npm run test:web:explore
```

This standalone script:
- Launches Chromium in visible mode
- Navigates to the marketing site
- Takes screenshots at various stages
- Tests button interactions
- Tests responsive viewports (desktop, tablet, mobile)
- Keeps browser open for 10 seconds for manual inspection

## Test Coverage

The `basic-ui-exploration.spec.ts` test suite includes:

1. **Page Loading Test** - Verifies the page loads correctly
2. **Navigation Exploration** - Finds and logs all links on the page
3. **Button Interactions** - Clicks buttons and captures state changes
4. **Page Structure Analysis** - Examines headings, buttons, links, inputs
5. **Responsive Testing** - Tests desktop (1920x1080), tablet (768x1024), mobile (375x667)
6. **Form Interactions** - Fills input fields if present

## Screenshots

All screenshots are saved to `apps/frontend/e2e/screenshots/`:

**From test suite:**
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

**From exploration script:**
- `explorer-01-initial.png` - Initial load
- `explorer-02-before-interaction.png` - Before interaction
- `explorer-03-after-interaction.png` - After interaction
- `explorer-04-viewport-tablet.png` - Tablet viewport
- `explorer-05-viewport-mobile.png` - Mobile viewport
- `explorer-06-viewport-desktop.png` - Desktop viewport

## Viewing Test Reports

After running tests, view the HTML report:

```bash
cd apps/frontend
npx playwright show-report
```

Or open the report file directly:
```
apps/frontend/playwright-report/web-report/index.html
```

## Configuration Details

### `playwright.web.config.ts`

Key settings:
- **Base URL:** `http://localhost:3000`
- **Browser:** Chromium
- **Timeout:** 60 seconds
- **Retries:** 2 (in CI)
- **Workers:** 1 (local), 2 (CI)
- **Auto-start server:** Yes (starts `npm run dev:web`)
- **Screenshots:** On failure only
- **Videos:** Retain on failure
- **Trace:** On first retry

## Troubleshooting

### "Playwright not installed"

```bash
npm install
npm run playwright:install
```

### "Port 3000 already in use"

Either:
1. Stop the existing server on port 3000
2. Or modify the port in `playwright.web.config.ts`:

```typescript
webServer: {
  command: 'npm run dev:web -- --port 3001',
  url: 'http://localhost:3001',
  // ...
}
```

### Tests timing out

Increase timeout in `playwright.web.config.ts`:

```typescript
timeout: 120_000, // 2 minutes
```

### Browser not launching

Ensure browser binaries are installed:

```bash
npx playwright install chromium --with-deps
```

## Writing New Tests

Create a new test file in `apps/frontend/e2e/web-tests/`:

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

Run the new test:

```bash
npx playwright test --config=e2e/playwright.web.config.ts web-tests/my-feature.spec.ts
```

## Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Wait for stable state** before assertions
3. **Take screenshots** at key moments for debugging
4. **Test responsive behavior** across viewports
5. **Keep tests isolated** - each test should work independently
6. **Use page objects** for complex interactions

## Integration with CI/CD

The configuration is CI-ready:
- Automatic retries on failure (2 retries in CI)
- Parallel test execution (2 workers in CI)
- HTML report generation
- Screenshot and video capture on failures
- Headless mode by default

## Quick Reference

| Task | Command |
|------|---------|
| Install browsers | `npm run playwright:install` |
| Run all web tests | `npm run test:e2e:web` |
| Run with browser visible | `npx playwright test --config=e2e/playwright.web.config.ts --headed` |
| Debug tests | `npx playwright test --config=e2e/playwright.web.config.ts --debug` |
| Browser exploration | `npm run test:web:explore` |
| View report | `npx playwright show-report` |
| Verify setup | `node e2e/verify-playwright-setup.mjs` |

## Summary

The Playwright browser testing setup is now complete and ready for use. The configuration provides:

✅ Automated browser testing for the marketing website
✅ Screenshot capture for visual verification
✅ Responsive testing across multiple viewports
✅ Easy exploration script for manual testing
✅ CI/CD ready configuration
✅ Comprehensive documentation

All tests run against the local dev server at `http://localhost:3000`, making it easy to test changes during development.

## Next Steps

1. Install dependencies: `npm install`
2. Install browsers: `npm run playwright:install`
3. Verify setup: `node e2e/verify-playwright-setup.mjs`
4. Run tests: `npm run test:e2e:web`

For detailed information, see `apps/frontend/e2e/PLAYWRIGHT_SETUP.md`.
