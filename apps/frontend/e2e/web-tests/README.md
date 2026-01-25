# Web UI Tests

This directory contains Playwright tests for the marketing website.

## Quick Start

```bash
# Run all web UI tests
npm run test:e2e:web

# Run specific test
npx playwright test --config=e2e/playwright.web.config.ts basic-ui-exploration.spec.ts

# Run with visible browser
npx playwright test --config=e2e/playwright.web.config.ts --headed

# Debug mode with inspector
npx playwright test --config=e2e/playwright.web.config.ts --debug
```

## Browser Exploration

For quick manual testing and exploration:

```bash
npm run test:web:explore
```

This launches a visible browser and:
- Navigates to the marketing site
- Takes screenshots
- Tests interactions
- Tests responsive viewports

## Test Files

- `basic-ui-exploration.spec.ts` - Comprehensive UI exploration and testing

## Screenshots

All screenshots are saved to `../screenshots/` directory.
