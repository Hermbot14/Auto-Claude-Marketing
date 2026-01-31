/**
 * Comprehensive Visual UI Test Suite for Auto-Claude-Marketing
 *
 * This test suite performs automated browser testing of all UI components,
 * buttons, and functionality while capturing detailed logs of all interactions.
 *
 * Run with: npx playwright test e2e/web-tests/visual-test.spec.ts --config=e2e/playwright.web.config.ts --headed
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log file for capturing all test results
const LOG_FILE = path.join(__dirname, 'test-results.json');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Test results tracking
const testResults: {
  timestamp: string;
  tests: {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    screenshot?: string;
    error?: string;
    details: any;
  }[];
} = {
  timestamp: new Date().toISOString(),
  tests: []
};

// Helper to log test results
function logTest(name: string, status: 'pass' | 'fail' | 'skip', duration: number, details: any, screenshot?: string, error?: string) {
  const result = {
    name,
    status,
    duration,
    details,
    ...(screenshot && { screenshot }),
    ...(error && { error })
  };
  testResults.tests.push(result);

  // Write to log file after each test
  fs.writeFileSync(LOG_FILE, JSON.stringify(testResults, null, 2));

  console.log(`[${status.toUpperCase()}] ${name} (${duration}ms)`);
  if (error) console.log(`  Error: ${error}`);
}

test.beforeAll(async () => {
  console.log('='.repeat(60));
  console.log('AUTO-CLAUDE VISUAL UI TEST SUITE');
  console.log('='.repeat(60));
  console.log(`Starting tests at: ${new Date().toISOString()}`);
  console.log(`Base URL: http://localhost:3000`);
  console.log(`Log file: ${LOG_FILE}`);
  console.log(`Screenshot dir: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));
});

test.describe('Application Launch & Initial State', () => {
  test('should load the application', async ({ page }) => {
    const startTime = Date.now();

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

      // Check page title
      const title = await page.title();
      expect(title).toContain('Auto Claude');

      // Check for root element
      const root = await page.locator('#root').count();
      expect(root).toBe(1);

      const duration = Date.now() - startTime;
      const screenshot = path.join(SCREENSHOT_DIR, '01-app-loaded.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      logTest('Application Load', 'pass', duration, {
        title,
        rootElementPresent: root > 0
      }, screenshot);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logTest('Application Load', 'fail', duration, {}, undefined, error.message);
      throw error;
    }
  });

  test('should show initial UI state', async ({ page }) => {
    const startTime = Date.now();

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000); // Wait for React to render

      // Capture initial state
      const bodyText = await page.locator('body').textContent();

      // Check for common UI elements
      const hasButtons = await page.locator('button').count() > 0;
      const hasInputs = await page.locator('input').count() > 0;
      const hasNavigation = await page.locator('nav').count() > 0;

      const screenshot = path.join(SCREENSHOT_DIR, '02-initial-state.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      const details = {
        bodyTextLength: bodyText?.length || 0,
        buttonCount: await page.locator('button').count(),
        inputCount: await page.locator('input').count(),
        hasNavigation,
        hasButtons,
        hasInputs
      };

      logTest('Initial UI State', 'pass', Date.now() - startTime, details, screenshot);

    } catch (error: any) {
      logTest('Initial UI State', 'fail', Date.now() - startTime, {}, undefined, error.message);
      throw error;
    }
  });
});

test.describe('Navigation Testing', () => {
  test('should find and test navigation elements', async ({ page }) => {
    const startTime = Date.now();

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Find all navigation elements
      const navElements = await page.locator('nav, [role="navigation"], .nav, .navigation').all();

      const navDetails: any[] = [];

      for (const nav of navElements) {
        const isVisible = await nav.isVisible();
        const text = await nav.textContent();
        const buttonCount = await nav.locator('button').count();

        navDetails.push({
          visible: isVisible,
          textLength: text?.length || 0,
          buttonCount
        });
      }

      // Try clicking on any navigation buttons
      const navButtons = await page.locator('nav button, [role="navigation"] button, .nav button').all();
      const clickResults: any[] = [];

      for (let i = 0; i < Math.min(navButtons.length, 5); i++) {
        try {
          const button = navButtons[i];
          const buttonText = await button.textContent();
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();

          if (isVisible && isEnabled) {
            await button.click();
            await page.waitForTimeout(1000);

            const url = page.url();
            clickResults.push({
              button: buttonText?.trim(),
              url,
              successful: true
            });

            // Go back
            await page.goBack();
            await page.waitForTimeout(500);
          }
        } catch (err) {
          clickResults.push({
            index: i,
            successful: false,
            error: (err as Error).message
          });
        }
      }

      const screenshot = path.join(SCREENSHOT_DIR, '03-navigation.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      logTest('Navigation Elements', 'pass', Date.now() - startTime, {
        navCount: navElements.length,
        navDetails,
        navButtonsClicked: clickResults.length,
        clickResults
      }, screenshot);

    } catch (error: any) {
      logTest('Navigation Elements', 'fail', Date.now() - startTime, {}, undefined, error.message);
      throw error;
    }
  });
});

test.describe('Button Interaction Testing', () => {
  test('should find and test all clickable buttons', async ({ page }) => {
    const startTime = Date.now();

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Find all buttons
      const buttons = await page.locator('button').all();
      const buttonResults: any[] = [];

      console.log(`Found ${buttons.length} buttons to test`);

      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const buttonStart = Date.now();

        try {
          const buttonText = await button.textContent();
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          const boundingBox = await button.boundingBox();

          const buttonInfo: any = {
            index: i,
            text: buttonText?.trim().substring(0, 50),
            visible: isVisible,
            enabled: isEnabled,
            hasPosition: !!boundingBox,
            position: boundingBox
          };

          // Try hovering over button
          if (isVisible) {
            await button.hover();
            await page.waitForTimeout(200);

            // Check if there's any visual feedback (class changes, etc.)
            const afterHoverClasses = await button.getAttribute('class');
            buttonInfo.hoverClasses = afterHoverClasses;

            // If enabled, try clicking
            if (isEnabled && buttonText && !buttonText.includes('menu')) {
              try {
                // Take screenshot before click
                const beforeScreenshot = path.join(SCREENSHOT_DIR, `button-${i}-before.png`);
                await button.screenshot({ path: beforeScreenshot });

                await button.click();
                await page.waitForTimeout(500);

                const afterScreenshot = path.join(SCREENSHOT_DIR, `button-${i}-after.png`);
                await button.screenshot({ path: afterScreenshot });

                buttonInfo.clickSuccessful = true;
                buttonInfo.screenshots = [beforeScreenshot, afterScreenshot];

                // Go back if navigation occurred
                await page.goBack().catch(() => {});
                await page.waitForTimeout(500);

              } catch (clickError) {
                buttonInfo.clickError = (clickError as Error).message;
              }
            }
          }

          buttonInfo.duration = Date.now() - buttonStart;
          buttonResults.push(buttonInfo);

          console.log(`  [OK] Button ${i}: ${buttonInfo.text}`);

        } catch (error: any) {
          buttonResults.push({
            index: i,
            error: error.message,
            duration: Date.now() - buttonStart
          });
          console.log(`  [FAIL] Button ${i}: ${error.message}`);
        }
      }

      const screenshot = path.join(SCREENSHOT_DIR, '04-all-buttons.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      logTest('Button Interactions', 'pass', Date.now() - startTime, {
        totalButtons: buttons.length,
        tested: buttonResults.length,
        results: buttonResults
      }, screenshot);

    } catch (error: any) {
      logTest('Button Interactions', 'fail', Date.now() - startTime, {}, undefined, error.message);
      throw error;
    }
  });
});

test.describe('Form Input Testing', () => {
  test('should find and test all input fields', async ({ page }) => {
    const startTime = Date.now();

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Find all inputs
      const inputs = await page.locator('input, textarea, [contenteditable="true"]').all();
      const inputResults: any[] = [];

      console.log(`Found ${inputs.length} input fields`);

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const inputStart = Date.now();

        try {
          const inputType = await input.getAttribute('type');
          const placeholder = await input.getAttribute('placeholder');
          const isVisible = await input.isVisible();
          const isEnabled = await input.isEnabled();

          const inputInfo: any = {
            index: i,
            type: inputType || 'text',
            placeholder,
            visible: isVisible,
            enabled: isEnabled
          };

          if (isVisible && isEnabled) {
            // Try focusing the input
            await input.focus();
            await page.waitForTimeout(200);

            // Try typing if it's a text input
            if (inputType !== 'file' && inputType !== 'checkbox' && inputType !== 'radio') {
              const testValue = 'Test input value';
              await input.fill(testValue);
              await page.waitForTimeout(200);

              // Verify value was set
              const value = await input.inputValue();
              inputInfo.fillSuccessful = value === testValue;
              inputInfo.testValue = testValue;
              inputInfo.actualValue = value;

              // Clear the input
              await input.fill('');
            }

            // Check for validation messages
            const validationMessage = await input.evaluate((el: any) => el.validationMessage);
            inputInfo.validationMessage = validationMessage;
          }

          inputInfo.duration = Date.now() - inputStart;
          inputResults.push(inputInfo);

          console.log(`  [OK] Input ${i}: ${inputType || 'text'}`);

        } catch (error: any) {
          inputResults.push({
            index: i,
            error: error.message,
            duration: Date.now() - inputStart
          });
          console.log(`  [FAIL] Input ${i}: ${error.message}`);
        }
      }

      const screenshot = path.join(SCREENSHOT_DIR, '05-inputs.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      logTest('Form Inputs', 'pass', Date.now() - startTime, {
        totalInputs: inputs.length,
        tested: inputResults.length,
        results: inputResults
      }, screenshot);

    } catch (error: any) {
      logTest('Form Inputs', 'fail', Date.now() - startTime, {}, undefined, error.message);
      throw error;
    }
  });
});

test.describe('API Connection Testing', () => {
  test('should test backend connection from UI', async ({ page }) => {
    const startTime = Date.now();

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Listen for all network requests
      const apiRequests: any[] = [];
      page.on('request', request => {
        const url = request.url();
        if (url.includes('api') || url.includes('anthropic')) {
          apiRequests.push({
            url,
            method: request.method(),
            headers: request.headers()
          });
        }
      });

      // Listen for responses
      const apiResponses: any[] = [];
      page.on('response', response => {
        const url = response.url();
        if (url.includes('api') || url.includes('anthropic')) {
          apiResponses.push({
            url,
            status: response.status(),
            ok: response.ok(),
            headers: response.headers()
          });
        }
      });

      // Look for any "Test Connection" or similar buttons
      const testButton = await page.locator('button:has-text("Test"), button:has-text("Connect"), button:has-text("Check")').first();

      const hasTestButton = await testButton.count() > 0;
      const details: any = {
        hasTestButton,
        apiRequests: [],
        apiResponses: []
      };

      if (hasTestButton) {
        await testButton.click();
        await page.waitForTimeout(5000);

        details.apiRequests = apiRequests;
        details.apiResponses = apiResponses;
      }

      const screenshot = path.join(SCREENSHOT_DIR, '06-api-connection.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      logTest('API Connection', 'pass', Date.now() - startTime, details, screenshot);

    } catch (error: any) {
      logTest('API Connection', 'fail', Date.now() - startTime, {}, undefined, error.message);
      throw error;
    }
  });
});

test.describe('Console & Error Monitoring', () => {
  test('should monitor console for errors and warnings', async ({ page }) => {
    const startTime = Date.now();

    try {
      const consoleMessages: any[] = [];

      page.on('console', msg => {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        });
      });

      page.on('pageerror', error => {
        consoleMessages.push({
          type: 'error',
          text: error.toString(),
          stack: error.stack
        });
      });

      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(5000);

      // Interact with page to trigger potential errors
      const buttons = await page.locator('button').all();
      for (let i = 0; i < Math.min(buttons.length, 3); i++) {
        try {
          await buttons[i].click();
          await page.waitForTimeout(500);
          await page.goBack().catch(() => {});
        } catch {}
      }

      const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      const screenshot = path.join(SCREENSHOT_DIR, '07-console-monitor.png');
      await page.screenshot({ path: screenshot, fullPage: true });

      logTest('Console Monitoring', errors.length === 0 ? 'pass' : 'fail', Date.now() - startTime, {
        totalMessages: consoleMessages.length,
        errorsAndWarnings: errors
      }, screenshot, errors.length > 0 ? `${errors.length} console errors/warnings found` : undefined);

    } catch (error: any) {
      logTest('Console Monitoring', 'fail', Date.now() - startTime, {}, undefined, error.message);
      throw error;
    }
  });
});

test.afterAll(async () => {
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = testResults.tests.filter(t => t.status === 'pass').length;
  const failed = testResults.tests.filter(t => t.status === 'fail').length;
  const total = testResults.tests.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${Date.now() - new Date(testResults.timestamp).getTime()}ms`);
  console.log(`Log File: ${LOG_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));

  // Write final summary
  fs.writeFileSync(LOG_FILE, JSON.stringify(testResults, null, 2));
});
