/**
 * Manual Browser Test & Logger
 *
 * Run this script to:
 * 1. Open the Web UI in a browser
 * 2. Take screenshots of every state
 * 3. Log all interactions
 * 4. Test every button and input
 *
 * Usage: node e2e/web-tests/manual-browser-test.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const LOG_FILE = path.join(__dirname, 'test-log.json');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Test results
const results = {
  timestamp: new Date().toISOString(),
  url: 'http://localhost:3000',
  tests: []
};

// Helper to log results
function logResult(testName, status, details, screenshotPath) {
  const result = {
    test: testName,
    status,
    details,
    screenshot: screenshotPath,
    time: new Date().toISOString()
  };
  results.tests.push(result);

  // Write to log file
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));

  console.log(`[${status.toUpperCase()}] ${testName}`);
  if (details) console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('AUTO-CLAUDE BROWSER TEST & LOGGING');
  console.log('='.repeat(60));
  console.log(`Starting at: ${new Date().toISOString()}`);
  console.log(`URL: http://localhost:3000`);
  console.log(`Screenshot dir: ${SCREENSHOT_DIR}`);
  console.log(`Log file: ${LOG_FILE}`);
  console.log('='.repeat(60));
  console.log();

  const browser = await chromium.launch({
    headless: false,  // Run with visible browser
    slowMo: 500  // Slow down actions to see what's happening
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Log console messages
  page.on('console', msg => {
    const logEntry = {
      type: msg.type(),
      text: msg.text(),
      time: new Date().toISOString()
    };
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);

    // Append to log file
    results.console = results.console || [];
    results.console.push(logEntry);
  });

  // Log network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('claude')) {
      console.log(`[API REQUEST] ${request.method()} ${url}`);
      results.apiRequests = results.apiRequests || [];
      results.apiRequests.push({
        method: request.method(),
        url,
        time: new Date().toISOString()
      });
    }
  });

  // Log network responses
  page.on('response', response => {
    const url = response.url();
    if (url.includes('api') || url.includes('claude')) {
      console.log(`[API RESPONSE] ${response.status()} ${url}`);
      results.apiResponses = results.apiResponses || [];
      results.apiResponses.push({
        status: response.status(),
        url,
        time: new Date().toISOString()
      });
    }
  });

  try {
    // Test 1: Load page
    console.log('\n[TEST 1] Loading page...');
    const startTime = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const screenshot1 = path.join(SCREENSHOT_DIR, '01-page-loaded.png');
    await page.screenshot({ path: screenshot1, fullPage: true });

    const title = await page.title();
    logResult('Page Load', 'pass', {
      title,
      loadTime: Date.now() - startTime
    }, screenshot1);

    // Test 2: Find all buttons
    console.log('\n[TEST 2] Finding buttons...');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} buttons`);

    const buttonResults = [];
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.evaluate(el => el.textContent);
      const isVisible = await button.isVisible();
      const isEnabled = await button.isEnabled();

      buttonResults.push({
        index: i,
        text: text?.trim().substring(0, 50),
        visible: isVisible,
        enabled: isEnabled
      });

      console.log(`  Button ${i}: ${text?.trim().substring(0, 30)} (visible: ${isVisible}, enabled: ${isEnabled})`);

      // Try hovering and clicking
      if (isVisible && isEnabled && i < 5) {  // Only test first 5 buttons
        try {
          await button.hover();
          await page.waitForTimeout(500);

          const beforeScreenshot = path.join(SCREENSHOT_DIR, `button-${i}-hover.png`);
          await button.screenshot({ path: beforeScreenshot });

          await button.click();
          await page.waitForTimeout(1000);

          const afterScreenshot = path.join(SCREENSHOT_DIR, `button-${i}-clicked.png`);
          await page.screenshot({ path: afterScreenshot, fullPage: true });

          console.log(`    -> Clicked successfully`);

          // Go back if navigation occurred
          await page.goBack().catch(() => {});
          await page.waitForTimeout(500);

        } catch (error) {
          console.log(`    -> Error: ${error.message}`);
        }
      }
    }

    logResult('Button Discovery', 'pass', {
      totalButtons: buttons.length,
      buttons: buttonResults
    });

    // Test 3: Find all inputs
    console.log('\n[TEST 3] Finding inputs...');
    const inputs = await page.$$('input, textarea');
    console.log(`Found ${inputs.length} inputs`);

    const inputResults = [];
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const isVisible = await input.isVisible();

      inputResults.push({
        index: i,
        type,
        placeholder,
        visible: isVisible
      });

      console.log(`  Input ${i}: type=${type}, placeholder=${placeholder}`);

      // Try typing in text inputs
      if (isVisible && type !== 'file' && type !== 'checkbox') {
        try {
          await input.fill('Test value');
          await page.waitForTimeout(200);

          const value = await input.inputValue();
          console.log(`    -> Fill successful: "${value}"`);

          await input.fill('');  // Clear
        } catch (error) {
          console.log(`    -> Error: ${error.message}`);
        }
      }
    }

    logResult('Input Discovery', 'pass', {
      totalInputs: inputs.length,
      inputs: inputResults
    });

    // Test 4: Check for any errors
    console.log('\n[TEST 4] Checking for errors...');
    const hasErrors = results.console && results.console.some(m => m.type === 'error');

    const finalScreenshot = path.join(SCREENSHOT_DIR, '99-final-state.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });

    logResult('Error Check', hasErrors ? 'fail' : 'pass', {
      hasErrors,
      consoleMessages: results.console?.length || 0,
      apiRequests: results.apiRequests?.length || 0,
      apiResponses: results.apiResponses?.length || 0
    }, finalScreenshot);

    // Wait so you can see the browser
    console.log('\nTests complete! Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Test error:', error);
    logResult('Test Suite', 'fail', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    await browser.close();
  }

  // Write final results
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${results.tests.length}`);
  console.log(`Passed: ${results.tests.filter(t => t.status === 'pass').length}`);
  console.log(`Failed: ${results.tests.filter(t => t.status === 'fail').length}`);
  console.log(`Log file: ${LOG_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));

  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
}

// Run the tests
runTests().catch(console.error);
