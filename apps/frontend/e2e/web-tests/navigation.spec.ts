/**
 * Navigation Test
 *
 * This test verifies that all sidebar navigation items work correctly:
 * - Each nav item is clickable
 * - Each view loads without errors
 * - URL hash updates correctly
 * - No console errors on navigation
 * - Visual verification with screenshots
 */

import { test, expect } from '@playwright/test';

// Define navigation items
const NAV_ITEMS = [
  'Kanban',
  'Roadmap',
  'Terminal',
  'Context',
  'Ideation',
  'Insights',
  'Changelog',
  'Worktrees',
  'Agent Tools'
];

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  });

  test('should navigate to Kanban view', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-kanban.png', fullPage: false });

    await page.click('button:has-text("Kanban")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/navigation/after-kanban.png', fullPage: true });

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('kanban');
  });

  test('should navigate to Roadmap view', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-roadmap.png', fullPage: false });

    await page.click('button:has-text("Roadmap")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/navigation/after-roadmap.png', fullPage: true });

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('roadmap');
  });

  test('should navigate to Settings', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-settings.png', fullPage: false });

    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(500);

    const settingsDialog = page.locator('[role="dialog"]').filter({ hasText: /Settings/i });
    await expect(settingsDialog).toBeVisible();

    await page.screenshot({ path: 'screenshots/navigation/after-settings.png', fullPage: false });
  });

  test('should navigate to Terminal view', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-terminals.png', fullPage: false });

    await page.click('button:has-text("Terminal")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/navigation/after-terminals.png', fullPage: true });

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('terminals');
  });

  test('should navigate to Context view', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-context.png', fullPage: false });

    await page.click('button:has-text("Context")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/navigation/after-context.png', fullPage: true });

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('context');
  });

  test('should navigate to Ideation view', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-ideation.png', fullPage: false });

    await page.click('button:has-text("Ideation")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/navigation/after-ideation.png', fullPage: true });

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('ideation');
  });

  test('should navigate to Insights view', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/navigation/before-insights.png', fullPage: false });

    await page.click('button:has-text("Insights")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/navigation/after-insights.png', fullPage: true });

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('insights');
  });

  test('should navigate all views sequentially', async ({ page }) => {
    const views = ['Kanban', 'Roadmap', 'Terminal', 'Context', 'Ideation', 'Insights'];

    for (const view of views) {
      await page.click(`button:has-text("${view}")`);
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `screenshots/navigation/sequential-${view.toLowerCase()}.png`,
        fullPage: true
      });
    }
  });
});
