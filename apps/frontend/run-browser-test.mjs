import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, 'e2e', 'web-tests', 'screenshots');
const LOG_FILE = path.join(__dirname, 'e2e', 'web-tests', 'test-log.json');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  timestamp: new Date().toISOString(),
  url: 'http://localhost:3000',
  tests: [],
  console: [],
  apiRequests: [],
  apiResponses: []
};

function logResult(testName, status, details, screenshotPath) {
  const result = {
    test: testName,
    status,
    details,
    screenshot: screenshotPath,
    time: new Date().toISOString()
  };
  results.tests.push(result);
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  console.log(`[${status.toUpperCase()}] ${testName}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('AUTO-CLAUDE BROWSER TEST');
  console.log('='.repeat(60));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Log console
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), time: new Date().toISOString() };
    results.console.push(entry);
    console.log(`[CONSOLE] ${msg.text()}`);
  });

  // Log API calls
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('claude') || url.includes('anthropic')) {
      results.apiRequests.push({ method: request.method(), url, time: new Date().toISOString() });
      console.log(`[API REQ] ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('api') || url.includes('claude') || url.includes('anthropic')) {
      results.apiResponses.push({ status: response.status(), url, time: new Date().toISOString() });
      console.log(`[API RES] ${response.status()} ${url}`);
    }
  });

  try {
    // Test 1: Load page
    console.log('\n[TEST 1] Loading page...');
    const start = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const screenshot1 = path.join(SCREENSHOT_DIR, '01-page-loaded.png');
    await page.screenshot({ path: screenshot1, fullPage: true });

    const title = await page.title();
    logResult('Page Load', 'pass', { title, loadTime: Date.now() - start }, screenshot1);

    // Test 2: Find all buttons
    console.log('\n[TEST 2] Finding buttons...');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} buttons`);

    const buttonResults = [];
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.evaluate(el => el.textContent);
      const visible = await button.isVisible();
      const enabled = await button.isEnabled();

      buttonResults.push({ index: i, text: text?.trim().substring(0, 50), visible, enabled });
      console.log(`  Button ${i}: "${text?.trim().substring(0, 30)}" (visible: ${visible}, enabled: ${enabled})`);

      // Test first few buttons
      if (visible && enabled && i < 5) {
        try {
          await button.hover();
          await page.waitForTimeout(300);
          await button.click();
          await page.waitForTimeout(500);
          await page.goBack().catch(() => {});
          await page.waitForTimeout(300);
        } catch (e) {
          console.log(`    Error: ${e.message}`);
        }
      }
    }

    const screenshot2 = path.join(SCREENSHOT_DIR, '02-buttons.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    logResult('Button Discovery', 'pass', { total: buttons.length, buttons: buttonResults }, screenshot2);

    // Test 3: Find all inputs
    console.log('\n[TEST 3] Finding inputs...');
    const inputs = await page.$$('input, textarea, [contenteditable="true"]');
    console.log(`Found ${inputs.length} inputs`);

    const inputResults = [];
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();

      inputResults.push({ index: i, type, placeholder, visible });
      console.log(`  Input ${i}: type=${type}, placeholder=${placeholder}`);

      // Test typing
      if (visible && type !== 'file' && type !== 'checkbox' && type !== 'radio') {
        try {
          await input.fill('Test value');
          await page.waitForTimeout(100);
          const value = await input.inputValue();
          console.log(`    -> Fill: "${value}"`);
          await input.fill('');
        } catch (e) {
          console.log(`    Error: ${e.message}`);
        }
      }
    }

    const screenshot3 = path.join(SCREENSHOT_DIR, '03-inputs.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    logResult('Input Discovery', 'pass', { total: inputs.length, inputs: inputResults }, screenshot3);

    // Final screenshot
    console.log('\n[TEST 4] Final state...');
    const screenshot4 = path.join(SCREENSHOT_DIR, '04-final.png');
    await page.screenshot({ path: screenshot4, fullPage: true });

    const hasErrors = results.console.some(m => m.type === 'error');
    logResult('Error Check', hasErrors ? 'fail' : 'pass', {
      hasErrors,
      consoleCount: results.console.length,
      apiRequests: results.apiRequests.length,
      apiResponses: results.apiResponses.length
    }, screenshot4);

    console.log('\nTests complete! Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Test error:', error);
    logResult('Test Suite', 'fail', { error: error.message, stack: error.stack });
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${results.tests.length}`);
  console.log(`Passed: ${results.tests.filter(t => t.status === 'pass').length}`);
  console.log(`Failed: ${results.tests.filter(t => t.status === 'fail').length}`);
  console.log(`Log: ${LOG_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));

  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
