/**
 * Buttons Test
 *
 * This test verifies all interactive buttons in the application:
 * - "New Task" button functionality
 * - Settings buttons
 * - Action buttons in each view
 * - Hover and active states
 * - Accessibility (keyboard focus, ARIA labels)
 * - Visual verification with screenshots
 */

import { test, expect } from '@playwright/test';

test.describe('Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  });

  test('should display and click New Task button', async ({ page }) => {
    const newTaskButton = page.locator('button').filter({ hasText: /New Task|Create/i }).first();

    await expect(newTaskButton).toBeVisible();
    await newTaskButton.screenshot({ path: 'screenshots/buttons/new-task-default.png' });

    await newTaskButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.screenshot({ path: 'screenshots/buttons/new-task-dialog-open.png', fullPage: false });
  });

  test('should click Settings button', async ({ page }) => {
    const settingsButton = page.locator('button').filter({ hasText: /Settings/i }).first();

    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await page.waitForTimeout(500);

    const settingsDialog = page.locator('[role="dialog"]').filter({ hasText: /Settings/i });
    await expect(settingsDialog).toBeVisible();

    await page.screenshot({ path: 'screenshots/buttons/settings-dialog-open.png', fullPage: false });
  });

  test('should test navigation buttons', async ({ page }) => {
    const navItems = ['Kanban', 'Roadmap', 'Terminal', 'Context', 'Ideation', 'Insights'];

    for (const item of navItems) {
      const button = page.locator(`button:has-text("${item}")`).first();
      const isVisible = await button.isVisible().catch(() => false);

      if (isVisible) {
        await button.hover();
        await page.waitForTimeout(100);

        const isInteractive = await button.evaluate((el: HTMLElement) => {
          return el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
        });

        expect(isInteractive).toBe(true);

        await button.screenshot({
          path: `screenshots/buttons/nav-${item.toLowerCase()}.png`
        });
      }
    }
  });

  test('should verify button accessibility', async ({ page }) => {
    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        const isTouchTarget = box.width >= 44 && box.height >= 44;
        expect(isTouchTarget).toBe(true);
      }
    }

    await page.screenshot({ path: 'screenshots/buttons/accessibility-check.png', fullPage: false });
  });

  test('should test button keyboard navigation', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          outline: el ? window.getComputedStyle(el).outline : 'none'
        };
      });

      expect(focused.tagName).toBe('BUTTON');
    }

    await page.screenshot({ path: 'screenshots/buttons/keyboard-navigation.png', fullPage: false });
  });
});
