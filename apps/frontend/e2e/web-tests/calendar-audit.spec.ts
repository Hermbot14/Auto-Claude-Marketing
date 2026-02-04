import { test, expect } from '@playwright/test';

test('calendar visual audit - capture screenshot', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout to 60 seconds
  console.log('🔍 Starting Calendar Visual Audit...');

  // Navigate to the app
  console.log('📍 Navigating to http://localhost:3003');
  await page.goto('http://localhost:3003', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000); // Wait for React to fully render

  // Log the page title
  const title = await page.title();
  console.log('📄 Page title:', title);

  // Close any open dialogs (onboarding, welcome, etc.)
  try {
    // Try pressing Escape to close any open dialogs
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Also try clicking outside dialogs (on the backdrop)
    const backdrop = page.locator('[data-state="open"]').first();
    if (await backdrop.count() > 0) {
      await page.mouse.click(0, 0);
      await page.waitForTimeout(500);
    }
    console.log('✅ Attempted to close dialogs');
  } catch (e) {
    console.log('⚠️ No dialogs to close or failed to close:', e.message);
  }

  // Try to navigate to Calendar
  console.log('📅 Attempting to navigate to Calendar view...');

  // Method 1: Use keyboard shortcut 'E' for Calendar (works without project now)
  try {
    await page.keyboard.press('e');
    await page.waitForTimeout(2000);
    console.log('✅ Pressed keyboard shortcut for Calendar');
  } catch (e) {
    console.log('⚠️ Keyboard shortcut failed:', e.message);
  }

  // Wait for calendar to render
  await page.waitForTimeout(3000);

  // Take full page screenshot
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const screenshotPath = `calendar-visual-audit-${timestamp}.png`;

  console.log('📸 Taking screenshot:', screenshotPath);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });
  console.log('✅ Screenshot saved');

  // Get page info for debugging
  const url = page.url();
  console.log('🔗 Current URL:', url);

  // Log visible elements for context
  const heading = await page.locator('h1, h2').first().textContent({ timeout: 2000 }).catch(() => 'No heading found');
  console.log('📋 Page heading:', heading);

  // Check for any errors in console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console error:', msg.text());
    }
  });
});
