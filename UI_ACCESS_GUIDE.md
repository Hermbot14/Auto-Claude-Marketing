# UI Access Guide - Marketing Hub

**Definitive guide for accessing and viewing the Marketing Hub UI**

**Last Updated:** 2025-01-25
**Project:** Auto-Claude-Marketing v1.0.0

---

## Quick Start (Fastest Method)

**Want to see the UI right now? Run this:**

```bash
cd apps/frontend
npm run dev:web
```

This opens the Marketing Hub UI in your browser at `http://localhost:3000`

**Why this works:** The web dev server bypasses the Electron main process entirely, running the React renderer directly in your browser. No build step required.

---

## Method Comparison Table

| Method | Speed | Features | Status | Best For |
|--------|-------|----------|--------|----------|
| **Web Dev Server** | Fastest | UI only (no IPC/File System) | Working | Development, UI review |
| **Playwright Codegen** | Fast | Interactive exploration | Working | UI testing, recording |
| **Electron Desktop** | Slow (requires fix) | Full functionality | Broken | Production, packaged apps |
| **Chromium Direct** | Fast | Headless automation | Working | Screenshots, automation |

---

## Method 1: Web Dev Server (Recommended)

### Overview
Runs the React renderer directly in a browser without Electron. This is the **fastest way** to view and interact with the UI.

### Setup
```bash
cd apps/frontend
npm run dev:web
```

### What Happens
1. Vite dev server starts at `http://localhost:3000`
2. Browser opens automatically
3. Hot Module Replacement (HMR) enabled for instant updates
4. Full React DevTools support

### Features Available
- Full UI rendering
- Navigation and routing
- Form inputs and validation
- Button interactions
- State management (Zustand)
- i18n translations

### Features NOT Available (Electron-specific)
- File system operations (IPC)
- Terminal integration
- Process management
- Desktop notifications
- Native OS integration

### Configuration File
Located at `apps/frontend/vite.web.config.ts`:

```typescript
server: {
  port: 3000,
  host: true,
  open: true,
  strictPort: false,
  allowedHosts: 'all'
}
```

### Custom Port
To use a different port:

```bash
npm run dev:web -- --port 5173
```

### Production Build
To build for web deployment:

```bash
cd apps/frontend
vite build --config vite.web.config.ts
# Output: dist-web/
```

---

## Method 2: Playwright Browser Automation

### Overview
Use Playwright to programmatically interact with and explore the UI. Great for testing and automation.

### Prerequisites
Playwright is already installed (`@playwright/test@^1.52.0`).

### Option 2A: Playwright Codegen (Interactive Recording)

**Best for:** Visual exploration and test recording

```bash
# Start the web dev server first
cd apps/frontend
npm run dev:web

# In another terminal, start codegen
npx playwright codegen http://localhost:3000
```

**What happens:**
1. Browser window opens with the app
2. Playwright Inspector window opens
3. Interact with the app - Playwright auto-generates test code
4. Copy generated code to create tests

**Features:**
- Visual element picker
- Automatic code generation
- Step-by-step recording
- Multiple selector strategies

### Option 2B: Custom Playwright Script

Create a script to explore and screenshot the UI:

```javascript
// explore-ui.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'ui-screenshot.png', fullPage: true });

  // List all buttons
  const buttons = await page.$$eval('button', buttons =>
    buttons.map(b => b.textContent).filter(Boolean)
  );
  console.log('Buttons found:', buttons);

  // List navigation items
  const navItems = await page.$$eval('[data-testid="nav-item"]', items =>
    items.map(i => i.textContent)
  );
  console.log('Navigation items:', navItems);

  // Keep open for exploration
  await page.waitForTimeout(30000);

  await browser.close();
})();
```

Run it:
```bash
node explore-ui.js
```

### Option 2C: Playwright Test Mode

```bash
cd apps/frontend

# Start web dev server
npm run dev:web

# Run tests in another terminal
npx playwright test --config=e2e/playwright.config.ts

# Run with UI mode (interactive)
npx playwright test --ui --config=e2e/playwright.config.ts

# Run with headed mode (see browser)
npx playwright test --headed --config=e2e/playwright.config.ts
```

### Playwright Configuration
Located at `apps/frontend/e2e/playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
});
```

---

## Method 3: Electron Desktop App (Requires Fix)

### Current Status: BROKEN

The Electron app fails to start due to a workspace hoisting issue.

### The Problem
```
TypeError: Cannot read properties of undefined (reading 'isPackaged')
```

**Root Cause:** npm workspace hoisting causes `require("electron")` to resolve incorrectly, returning `undefined` instead of the Electron API.

### Expected Behavior (When Fixed)
```bash
cd apps/frontend
npm run build  # Build the app
npm start      # Launch Electron desktop app
```

### Development Mode (When Fixed)
```bash
cd apps/frontend
npm run dev    # Start Electron with HMR
```

### Remote Debugging (When Fixed)
For E2E testing and MCP integration:

```bash
cd apps/frontend
npm run dev:mcp  # Start with remote debugging on port 9222
```

### Current Workarounds

**Option A: Use Web Dev Server (Recommended)**
- See Method 1 above
- Full UI access without Electron

**Option B: Try Alternative Package Managers**
The issue may be specific to npm workspaces. Try pnpm:

```bash
# Remove npm lockfile
rm package-lock.json
rm -rf node_modules
rm -rf apps/frontend/node_modules

# Install with pnpm
npm install -g pnpm
pnpm install

# Try running
cd apps/frontend
npm run dev
```

### For More Information
See these documents for detailed analysis:
- `ELECTRON_ISSUES_RESEARCH.md` - Deep dive into the problem
- `LAUNCH_ISSUE_ANALYSIS.md` - Troubleshooting history
- `PLAYWRIGHT_SETUP.md` - E2E testing setup

---

## Method 4: Chromium Direct (Headless Automation)

### Overview
Use Playwright's Chromium directly for screenshots and automation without Electron.

### Prerequisites
Start the web dev server first:
```bash
cd apps/frontend
npm run dev:web
```

### Screenshot Script
```javascript
// screenshot.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport size
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Capture full page
  await page.screenshot({
    path: 'marketing-hub-screenshot.png',
    fullPage: true
  });

  console.log('Screenshot saved: marketing-hub-screenshot.png');

  await browser.close();
})();
```

### Batch Screenshots
```javascript
// batch-screenshots.js
const { chromium } = require('playwright');

const pages = [
  { url: '/', name: 'dashboard' },
  { url: '#/campaigns', name: 'campaigns' },
  { url: '#/creative-studio', name: 'creative-studio' },
  { url: '#/analytics', name: 'analytics' }
];

(async () => {
  const browser = await chromium.launch();

  for (const page of pages) {
    const p = await browser.newPage();
    await p.goto(`http://localhost:3000${page.url}`);
    await p.waitForLoadState('networkidle');

    await p.screenshot({
      path: `screenshots/${page.name}.png`,
      fullPage: true
    });

    console.log(`Screenshot: ${page.name}.png`);
    await p.close();
  }

  await browser.close();
})();
```

### PDF Export
```javascript
// export-pdf.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Export to PDF
  await page.pdf({
    path: 'marketing-hub.pdf',
    format: 'A4',
    printBackground: true
  });

  console.log('PDF exported: marketing-hub.pdf');

  await browser.close();
})();
```

---

## Troubleshooting

### Web Dev Server Issues

**Port already in use:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# Kill the process or use different port
npm run dev:web -- --port 5173
```

**Blank page / errors:**
```bash
# Clear cache and restart
rm -rf node_modules/.vite
npm run dev:web
```

**Module resolution errors:**
```bash
# Reinstall dependencies
cd apps/frontend
rm -rf node_modules
npm install
npm run dev:web
```

### Playwright Issues

**Playwright not found:**
```bash
cd apps/frontend
npx playwright install
```

**Browser not installed:**
```bash
npx playwright install chromium
```

**Tests timeout:**
- Increase timeout in `e2e/playwright.config.ts`
- Check if dev server is running

### Electron Issues

**App crashes on startup:**
- Current known issue - use web dev server instead
- See `ELECTRON_ISSUES_RESEARCH.md` for details

**"electron is undefined" error:**
- This is the workspace hoisting bug
- Use web dev server as workaround

**Build fails:**
```bash
# Clean build artifacts
rm -rf apps/frontend/out
rm -rf apps/frontend/dist

# Rebuild
cd apps/frontend
npm run build
```

---

## Feature Compatibility Matrix

| Feature | Web Dev Server | Playwright | Electron (when fixed) |
|---------|----------------|------------|----------------------|
| UI Rendering | Yes | Yes | Yes |
| Navigation | Yes | Yes | Yes |
| Forms & Input | Yes | Yes | Yes |
| Hot Reload | Yes | No | Yes |
| File System | No | Mock | Yes |
| Terminal IPC | No | Mock | Yes |
| Process Mgmt | No | Mock | Yes |
| Notifications | No | Mock | Yes |
| Auto-updates | No | No | Yes |
| Desktop Tray | No | No | Yes |

---

## Development Workflow Recommendations

### For UI Development
```bash
# Use web dev server for fastest iteration
cd apps/frontend
npm run dev:web

# Make changes to React components
# See changes instantly in browser
```

### For Testing
```bash
# Start dev server
npm run dev:web

# Run tests in another terminal
npx playwright test --config=e2e/playwright.config.ts

# Or use interactive mode
npx playwright test --ui --config=e2e/playwright.config.ts
```

### For Screenshots/Demos
```bash
# Start dev server
npm run dev:web

# Use Playwright codegen for interactive screenshots
npx playwright codegen http://localhost:3000
```

### For Full Integration (when Electron is fixed)
```bash
# Build and run desktop app
cd apps/frontend
npm run build
npm start
```

---

## Advanced: Custom Access Methods

### Method A: Express Server with Mock IPC

Create a simple Express server that mocks Electron IPC:

```javascript
// mock-server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Proxy Vite dev server
app.use(
  createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true
  })
);

// Mock IPC endpoints
app.post('/api/ipc', (req, res) => {
  res.json({ success: true, data: {} });
});

app.listen(3001, () => {
  console.log('Mock server running at http://localhost:3001');
});
```

### Method B: Docker Container

```dockerfile
# Dockerfile
FROM node:24-alpine
WORKDIR /app
COPY apps/frontend/package*.json ./
RUN npm install
COPY apps/frontend .
EXPOSE 3000
CMD ["npm", "run", "dev:web"]
```

Build and run:
```bash
docker build -t marketing-hub .
docker run -p 3000:3000 marketing-hub
```

### Method C: Static Export

```bash
# Build for web
cd apps/frontend
vite build --config vite.web.config.ts

# Serve with any static server
npx serve dist-web
```

---

## Resources

### Documentation
- `ELECTRON_ISSUES_RESEARCH.md` - Electron bug deep dive
- `LAUNCH_ISSUE_ANALYSIS.md` - Troubleshooting history
- `PLAYWRIGHT_SETUP.md` - E2E testing setup
- `CLAUDE.md` - Project overview

### Configuration Files
- `apps/frontend/vite.web.config.ts` - Web dev server config
- `apps/frontend/e2e/playwright.config.ts` - Playwright config
- `apps/frontend/package.json` - NPM scripts

### Key Scripts
- `npm run dev:web` - Start web dev server
- `npm run dev` - Start Electron (currently broken)
- `npm run test:e2e` - Run E2E tests
- `npx playwright codegen` - Interactive UI exploration

---

## Summary

**To see the UI right now:**
```bash
cd apps/frontend
npm run dev:web
```

**To explore interactively:**
```bash
npm run dev:web
# Then in another terminal:
npx playwright codegen http://localhost:3000
```

**To run automated tests:**
```bash
npm run dev:web
# Then in another terminal:
npx playwright test --config=e2e/playwright.config.ts
```

**Current status:**
- Web Dev Server: Working
- Playwright Testing: Working
- Electron Desktop: Broken (workspace hoisting issue)

---

**Last Updated:** 2025-01-25
**Maintainer:** Auto-Claude Team
