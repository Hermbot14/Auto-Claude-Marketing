/**
 * Smoke Test - Basic connectivity verification
 */
import { test, expect } from '@playwright/test';

test('should be able to navigate to localhost:3000', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Take a screenshot
  await page.screenshot({ path: 'screenshots/smoke-test.png', fullPage: true });

  // Page title should exist
  const title = await page.title();
  console.log('Page title:', title);
  expect(title).toBeTruthy();
});
