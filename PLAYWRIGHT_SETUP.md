# Playwright Setup for UI Testing

## Overview

This project has Playwright installed and configured for End-to-End (E2E) testing of the Electron application. The setup includes both Electron-specific tests and web-based testing capabilities.

## Installation Status

✅ **Playwright is installed**: `@playwright/test@^1.52.0`
- Located in: `apps/frontend/package.json` (devDependencies)
- Version: 1.52.0
- Configuration: `apps/frontend/e2e/playwright.config.ts`

## Project Structure

```
apps/frontend/
├── e2e/
│   ├── playwright.config.ts      # Playwright configuration
│   ├── electron-helper.ts        # Helper utilities for Electron
│   ├── task-workflow.spec.ts     # Task workflow E2E tests
│   ├── flows.e2e.ts              # Main user flow tests
│   ├── terminal-copy-paste.e2e.ts # Terminal interaction tests
│   └── claude-accounts.e2e.ts    # Account management tests
└── src/renderer/                 # React application to test
```

## Configuration Details

### Playwright Config (`e2e/playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,           // Run tests serially for Electron
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,                     // Single worker for Electron
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
});
```

## Three Testing Approaches

### 1. **Electron E2E Testing** (Primary Approach)

Tests run against the actual Electron desktop application.

**Requirements:**
- Electron app must be built: `npm run build`
- Tests use `@playwright/test` with `_electron` launcher

**Run Tests:**
```bash
cd apps/frontend

# Build the app first
npm run build

# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test task-workflow --config=e2e/playwright.config.ts

# Run with UI (debug mode)
npx playwright test --ui --config=e2e/playwright.config.ts

# Run with headed mode (see browser window)
npx playwright test --headed --config=e2e/playwright.config.ts
```

**Example Test Structure:**
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test('should launch Electron app', async () => {
  const appPath = path.join(__dirname, '..');
  const app = await electron.launch({ args: [appPath] });
  const page = await app.firstWindow();

  await page.waitForLoadState('domcontentloaded');
  expect(await page.title()).toBeDefined();

  await app.close();
});
```

### 2. **Web Dev Server Testing** (Alternative)

Run the renderer as a web app in a browser (no Electron required).

**Why use this?**
- Faster development iteration (no build step)
- Easier debugging with browser DevTools
- Useful for renderer-only testing

**Start Web Dev Server:**
```bash
cd apps/frontend

# Start the web dev server (runs on http://localhost:3000)
npm run dev:web

# In another terminal, run Playwright tests
npx playwright test --config=e2e/playwright.config.ts
```

**Web Server Config (`vite.web.config.ts`):**
```typescript
server: {
  port: 3000,
  host: true,
  open: true,
  strictPort: false,
  allowedHosts: 'all'
}
```

**Example Web Test:**
```typescript
import { test, expect } from '@playwright/test';

test('should load web app', async () => {
  const page = await test.context().newPage();
  await page.goto('http://localhost:3000');

  // Wait for app to load
  await page.waitForSelector('[data-testid="app-container"]');

  // Interact with UI
  await page.click('text=Add Project');
});
```

### 3. **Mock-Based Testing** (Fastest)

Unit-style E2E tests that verify business logic without launching Electron.

**Why use this?**
- Fast execution (no app launch)
- CI-friendly (no display required)
- Tests logic flows and data structures

**Example Mock Test:**
```typescript
test('should create task spec structure', () => {
  setupTestEnvironment();
  createTestSpec('001-test-spec');

  const specDir = path.join(TEST_PROJECT_DIR, 'auto-claude', 'specs', '001-test-spec');
  expect(existsSync(specDir)).toBe(true);
  expect(existsSync(path.join(specDir, 'spec.md'))).toBe(true);

  cleanupTestEnvironment();
});
```

## Available Test Files

| Test File | Purpose | Type |
|-----------|---------|------|
| `task-workflow.spec.ts` | Full task creation and execution workflow | Mock-based + Electron |
| `flows.e2e.ts` | Main user flows (add project, create task, review) | Mock-based + Electron |
| `terminal-copy-paste.e2e.ts` | Terminal keyboard shortcuts and clipboard | Electron |
| `claude-accounts.e2e.ts` | Claude account management and authentication | Mock-based + Electron |

## Using Playwright to View and Interact with the UI

### Method 1: Interactive Mode (Recommended for Exploration)

```bash
cd apps/frontend

# Start the app in development mode (if not already running)
npm run dev

# Run Playwright in UI mode
npx playwright test --ui --config=e2e/playwright.config.ts
```

This opens the Playwright UI where you can:
- See all tests
- Run tests individually
- View traces and screenshots
- Inspect elements
- Debug step-by-step

### Method 2: Create a Custom Test to Explore UI

Create a new test file `e2e/explore-ui.e2e.ts`:

```typescript
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('UI Exploration', () => {
  test('explore the application', async () => {
    const appPath = path.join(__dirname, '..');
    const app = await electron.launch({
      args: [appPath],
      headless: false  // Show the window
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Take a screenshot
    await page.screenshot({ path: 'ui-overview.png', fullPage: true });

    // List all buttons
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons`);

    // List all text content
    const textContent = await page.evaluate(() => {
      return document.body.innerText;
    });
    console.log('Page text:', textContent);

    // Keep the app open for manual exploration
    // Press Ctrl+C to exit
    await page.pause();

    await app.close();
  });
});
```

Run it:
```bash
npx playwright test explore-ui --config=e2e/playwright.config.ts
```

### Method 3: Playwright Codegen (Record Interactions)

```bash
# Start the web dev server
npm run dev:web

# In another terminal, start codegen
npx playwright codegen http://localhost:3000
```

This opens:
1. The app in a browser window
2. A Playwright Inspector window

**Interact with the app and Playwright will auto-generate test code.**

### Method 4: Direct Browser Testing (No Electron)

```bash
# Start the web dev server
npm run dev:web

# Create a simple Node.js script (test-ui.js)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'app-screenshot.png' });

  // Explore the UI
  console.log('Page title:', await page.title());

  // List all interactive elements
  const buttons = await page.$$eval('button', buttons =>
    buttons.map(b => b.textContent)
  );
  console.log('Buttons:', buttons);

  // Keep browser open for manual exploration
  await page.waitForTimeout(30000); // 30 seconds

  await browser.close();
})();
```

Run it:
```bash
node test-ui.js
```

## Debugging Tips

### 1. Pause Execution
```typescript
test('my test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.pause(); // Execution pauses here for debugging
});
```

### 2. View Traces
```bash
# Run tests with trace enabled
npx playwright test --trace on --config=e2e/playwright.config.ts

# View trace
npx playwright show-trace trace.zip
```

### 3. Screenshots on Failure
Enabled by default in `playwright.config.ts`:
```typescript
use: {
  screenshot: 'only-on-failure'
}
```

### 4. Slow Mode
```typescript
test('slow motion test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Slow down all actions
  await page.slowMo();
});
```

## Quick Start Commands

```bash
cd apps/frontend

# Option 1: Build and test Electron app
npm run build
npm run test:e2e

# Option 2: Test with web dev server (faster)
npm run dev:web
# Then run tests in another terminal

# Option 3: Run Playwright UI for interactive testing
npx playwright test --ui --config=e2e/playwright.config.ts

# Option 4: Record interactions
npx playwright codegen http://localhost:3000
```

## Testing Features

### What You Can Test

1. **UI Interactions**
   - Click buttons, fill forms
   - Navigate through the app
   - Test keyboard shortcuts
   - Verify element visibility

2. **Terminal Integration**
   - Copy/paste functionality
   - Command execution
   - Multi-line input (Shift+Enter)
   - Platform-specific shortcuts (Ctrl+C on Windows/Linux, Cmd+C on Mac)

3. **Task Workflows**
   - Create tasks
   - Monitor progress
   - Review completed work
   - Handle errors

4. **Account Management**
   - Add Claude accounts
   - Authentication flows
   - Token persistence
   - Error handling

### Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Wait for elements** using `waitForSelector` or `waitForLoadState`
3. **Take screenshots** for visual verification
4. **Mock IPC handlers** for isolated testing
5. **Clean up** test data in `afterEach` or `afterAll`

## Troubleshooting

### Issue: "Electron not available"
**Solution:** Build the app first: `npm run build`

### Issue: Tests timeout
**Solution:** Increase timeout in `playwright.config.ts` or test file

### Issue: Element not found
**Solution:** Use `waitForSelector` or check if the element exists first

### Issue: Tests fail in CI
**Solution:** Many tests skip in CI (check for `test.skip(!process.env.CI)`)

## Summary

This project has excellent Playwright setup for UI testing:

✅ Playwright installed and configured
✅ Multiple testing approaches (Electron, Web, Mock)
✅ Comprehensive test coverage
✅ Helper utilities for common operations
✅ Both automated and interactive testing modes

**Recommended workflow for viewing the UI:**
1. Start web dev server: `npm run dev:web`
2. Use Playwright codegen to record and explore: `npx playwright codegen http://localhost:3000`
3. Or create custom tests to inspect specific UI elements

**For automated testing:**
1. Build the app: `npm run build`
2. Run E2E tests: `npm run test:e2e`
3. View HTML report: `npx playwright show-report`
