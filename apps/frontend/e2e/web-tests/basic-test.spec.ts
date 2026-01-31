/**
 * Basic Playwright Test for Auto-Claude Web UI
 *
 * Simple test to verify the page loads and basic elements exist
 */

import { test, expect } from '@playwright/test';

test('basic page load test', async ({ page }) => {
  console.log('Starting basic page load test...');

  // Navigate to the Web UI
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for React to render
  await page.waitForTimeout(3000);

  // Check page title
  const title = await page.title();
  console.log('Page title:', title);
  expect(title).toContain('Auto Claude');

  // Check for root element
  const root = page.locator('#root');
  await expect(root).toBeVisible();

  // Count visible elements
  const buttons = await page.locator('button').count();
  const inputs = await page.locator('input').count();
  const links = await page.locator('a').count();

  console.log('Found elements:', {
    buttons,
    inputs,
    links
  });

  // Take screenshot
  await page.screenshot({
    path: 'e2e/web-tests/screenshots/basic-test.png',
    fullPage: true
  });

  console.log('Basic test completed successfully!');
});

test('find all interactive elements', async ({ page }) => {
  console.log('Finding all interactive elements...');

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Find all buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons`);

  const buttonInfo: any[] = [];
  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    const text = await buttons[i].textContent();
    const visible = await buttons[i].isVisible();
    buttonInfo.push({
      index: i,
      text: text?.trim().substring(0, 30),
      visible
    });
  }

  console.log('Button info:', JSON.stringify(buttonInfo, null, 2));

  // Find all inputs
  const inputs = await page.locator('input, textarea').all();
  console.log(`Found ${inputs.length} inputs`);

  const inputInfo: any[] = [];
  for (let i = 0; i < Math.min(inputs.length, 10); i++) {
    const type = await inputs[i].getAttribute('type');
    const placeholder = await inputs[i].getAttribute('placeholder');
    inputInfo.push({
      index: i,
      type,
      placeholder
    });
  }

  console.log('Input info:', JSON.stringify(inputInfo, null, 2));

  // Save results to file
  const fs = require('fs');
  const results = {
    timestamp: new Date().toISOString(),
    buttons: buttonInfo,
    inputs: inputInfo
  };

  fs.writeFileSync(
    'e2e/web-tests/element-scan.json',
    JSON.stringify(results, null, 2)
  );

  console.log('Results saved to element-scan.json');
});
