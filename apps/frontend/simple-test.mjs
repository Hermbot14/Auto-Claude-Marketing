import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'e2e', 'web-tests', 'screenshots');
const LOG_FILE = path.join(__dirname, 'e2e', 'web-tests', 'test-results.json');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  timestamp: new Date().toISOString(),
  url: 'http://localhost:3000',
  tests: []
};

async function run() {
  console.log('=' .repeat(60));
  console.log('BROWSER TEST STARTING');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[Console ${msg.type()}] ${text}`);
  });

  page.on('request', req => {
    const url = req.url();
    if (url.includes('api') || url.includes('claude') || url.includes('anthropic')) {
      console.log(`[API Request] ${req.method()} ${url}`);
    }
  });

  page.on('response', res => {
    const url = res.url();
    if (url.includes('api') || url.includes('claude') || url.includes('anthropic')) {
      console.log(`[API Response] ${res.status()} ${url}`);
    }
  });

  try {
    console.log('\n[1/3] Loading page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const screenshot1 = path.join(SCREENSHOT_DIR, '01-page-loaded.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log('Screenshot: ' + screenshot1);

    const title = await page.title();
    console.log('Page Title: ' + title);
    results.tests.push({ test: 'Page Load', status: 'pass', title });

    console.log('\n[2/3] Finding interactive elements...');
    const buttons = await page.$$('button');
    const inputs = await page.$$('input, textarea');
    const links = await page.$$('a');

    console.log(`Buttons: ${buttons.length}`);
    console.log(`Inputs: ${inputs.length}`);
    console.log(`Links: ${links.length}`);

    const buttonData = [];
    for (let i = 0; i < Math.min(buttons.length, 15); i++) {
      const btn = buttons[i];
      const text = await btn.evaluate(el => el.textContent);
      const visible = await btn.isVisible();
      const enabled = await btn.isEnabled();
      const bbox = await btn.boundingBox();

      buttonData.push({
        index: i,
        text: text ? text.trim().substring(0, 50) : '',
        visible,
        enabled,
        hasPosition: !!bbox
      });

      console.log(`  [${i}] "${text?.trim().substring(0, 30)}" visible=${visible} enabled=${enabled}`);

      if (visible && enabled && i < 5) {
        try {
          await btn.hover();
          await page.waitForTimeout(200);
          await btn.click();
          await page.waitForTimeout(500);
          await page.goBack().catch(() => {});
          await page.waitForTimeout(300);
        } catch (e) {
          console.log(`    Click error: ${e.message}`);
        }
      }
    }

    const screenshot2 = path.join(SCREENSHOT_DIR, '02-interactions.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log('Screenshot: ' + screenshot2);

    results.tests.push({
      test: 'Interactive Elements',
      status: 'pass',
      buttons: buttons.length,
      inputs: inputs.length,
      links: links.length,
      buttonData
    });

    console.log('\n[3/3] Checking for errors...');
    const bodyText = await page.locator('body').textContent();
    const hasError = bodyText && (bodyText.includes('Error') || bodyText.includes('error'));

    const screenshot3 = path.join(SCREENSHOT_DIR, '03-final.png');
    await page.screenshot({ path: screenshot3, fullPage: true });

    results.tests.push({
      test: 'Error Check',
      status: hasError ? 'fail' : 'pass',
      hasError
    });

    console.log('Screenshot: ' + screenshot3);
    console.log('\nTests complete! Keeping browser open for 3 seconds...');
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('\nERROR:', error.message);
    results.tests.push({
      test: 'Test Suite',
      status: 'fail',
      error: error.message,
      stack: error.stack
    });
  } finally {
    await browser.close();
  }

  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Total: ${results.tests.length}`);
  console.log(`Passed: ${results.tests.filter(t => t.status === 'pass').length}`);
  console.log(`Failed: ${results.tests.filter(t => t.status === 'fail').length}`);
  console.log(`Log: ${LOG_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
