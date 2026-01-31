/**
 * UI/UX Screenshot Audit Test
 *
 * Takes screenshots of each view and checks for:
 * - Visual rendering issues
 * - "Auto-Claude" branding (should be "Auto-Marketing")
 * - Basic accessibility
 * - Console errors
 */

import { test, expect } from '@playwright/test';

const VIEWS = [
  { name: 'Kanban', button: 'Kanban', hash: 'kanban' },
  { name: 'Roadmap', button: 'Roadmap', hash: 'roadmap' },
  { name: 'Terminal', button: 'Terminal', hash: 'terminals' },
  { name: 'Context', button: 'Context', hash: 'context' },
  { name: 'Ideation', button: 'Ideation', hash: 'ideation' },
  { name: 'Insights', button: 'Insights', hash: 'insights' },
  { name: 'Changelog', button: 'Changelog', hash: 'changelog' }
];

test.describe('UI/UX Screenshot Audit', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('should load homepage', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/00-homepage.png', fullPage: true });

    // Check for critical errors
    const criticalErrors = consoleErrors.filter(e => !e.includes('404'));
    expect(criticalErrors.length).toBe(0);
  });

  test('should audit Kanban view', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Kanban")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/01-kanban.png', fullPage: true });

    // Check for "Auto-Claude" branding
    const pageContent = await page.content();
    const hasAutoClaudeBranding = pageContent.includes('Auto Claude') || pageContent.includes('Auto-Claude');

    // This test will FAIL if incorrect branding is found
    expect(hasAutoClaudeBranding, 'Should not have "Auto-Claude" branding').toBe(false);
  });

  test('should audit Roadmap view', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Roadmap")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/02-roadmap.png', fullPage: true });
  });

  test('should audit Terminal view', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Terminal")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/03-terminal.png', fullPage: true });
  });

  test('should audit Context view', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Context")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/04-context.png', fullPage: true });
  });

  test('should audit Ideation view', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Ideation")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/05-ideation.png', fullPage: true });
  });

  test('should audit Insights view', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Insights")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/06-insights.png', fullPage: true });
  });

  test('should audit Settings dialog', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/07-settings.png', fullPage: false });
  });

  test('should check accessibility', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const buttons = await page.locator('button:visible').count();
    expect(buttons).toBeGreaterThan(0);

    // Check button sizes
    const smallButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      let count = 0;
      buttons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) count++;
      });
      return count;
    });

    expect(smallButtons).toBe(0);
  });

  test('should check responsive design', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/responsive-desktop.png', fullPage: true });

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: 'screenshots/responsive-tablet.png', fullPage: true });

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: 'screenshots/responsive-mobile.png', fullPage: true });
  });
});
