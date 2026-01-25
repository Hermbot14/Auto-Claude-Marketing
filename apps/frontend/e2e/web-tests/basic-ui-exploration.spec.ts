/**
 * Basic UI Exploration Test
 *
 * This test demonstrates:
 * 1. Launching Chromium browser
 * 2. Navigating to the web dev server
 * 3. Taking screenshots
 * 4. Performing basic interactions
 *
 * Run with: npx playwright test --config=e2e/playwright.web.config.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Basic UI Exploration', () => {
  test('should load the marketing website', async ({ page }) => {
    // Navigate to the marketing website
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Take a screenshot of the initial state
    await page.screenshot({
      path: 'e2e/screenshots/01-initial-load.png',
      fullPage: true
    });

    // Check that the page has loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ Page loaded successfully');
    console.log('✓ Title:', await page.title());
    console.log('✓ URL:', page.url());
  });

  test('should explore navigation elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Take screenshot before interaction
    await page.screenshot({
      path: 'e2e/screenshots/02-before-navigation-exploration.png'
    });

    // Find all navigation links
    const links = await page.locator('a').all();
    console.log(`✓ Found ${links.length} links on the page`);

    // Log all link text and hrefs
    for (let i = 0; i < Math.min(links.length, 20); i++) {
      const text = await links[i].textContent();
      const href = await links[i].getAttribute('href');
      console.log(`  [${i + 1}] ${text?.trim() || '[empty]'} -> ${href || '[no href]'}`);
    }

    // Take screenshot after exploration
    await page.screenshot({
      path: 'e2e/screenshots/03-after-navigation-exploration.png'
    });
  });

  test('should interact with buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find all buttons
    const buttons = await page.locator('button').all();
    console.log(`✓ Found ${buttons.length} buttons on the page`);

    if (buttons.length > 0) {
      // Take screenshot before clicking
      await page.screenshot({
        path: 'e2e/screenshots/04-before-button-click.png'
      });

      // Click the first button (if visible)
      const firstButton = buttons[0];
      const isVisible = await firstButton.isVisible();

      if (isVisible) {
        const buttonText = await firstButton.textContent();
        console.log(`✓ Clicking button: "${buttonText?.trim()}"`);

        await firstButton.click();

        // Wait a moment for any state changes
        await page.waitForTimeout(1000);

        // Take screenshot after clicking
        await page.screenshot({
          path: 'e2e/screenshots/05-after-button-click.png'
        });
      } else {
        console.log('✓ First button is not visible, skipping click');
      }
    }
  });

  test('should check page structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Get page structure information
    const structure = await page.evaluate(() => {
      return {
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
          tag: h.tagName,
          text: h.textContent?.trim()
        })),
        hasMain: !!document.querySelector('main'),
        hasHeader: !!document.querySelector('header'),
        hasFooter: !!document.querySelector('footer'),
        hasNav: !!document.querySelector('nav'),
        buttonCount: document.querySelectorAll('button').length,
        linkCount: document.querySelectorAll('a').length,
        inputCount: document.querySelectorAll('input').length
      };
    });

    console.log('✓ Page Structure:');
    console.log(`  Title: "${structure.title}"`);
    console.log(`  Headings: ${structure.headings.length}`);
    structure.headings.forEach(h => {
      console.log(`    ${h.tag}: ${h.text}`);
    });
    console.log(`  Has <main>: ${structure.hasMain}`);
    console.log(`  Has <header>: ${structure.hasHeader}`);
    console.log(`  Has <footer>: ${structure.hasFooter}`);
    console.log(`  Has <nav>: ${structure.hasNav}`);
    console.log(`  Buttons: ${structure.buttonCount}`);
    console.log(`  Links: ${structure.linkCount}`);
    console.log(`  Inputs: ${structure.inputCount}`);

    // Take screenshot of structure analysis
    await page.screenshot({
      path: 'e2e/screenshots/06-page-structure.png',
      fullPage: true
    });
  });

  test('should test responsive viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'e2e/screenshots/07-viewport-desktop.png',
      fullPage: true
    });
    console.log('✓ Desktop viewport captured');

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500); // Wait for responsive adjustments
    await page.screenshot({
      path: 'e2e/screenshots/08-viewport-tablet.png',
      fullPage: true
    });
    console.log('✓ Tablet viewport captured');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Wait for responsive adjustments
    await page.screenshot({
      path: 'e2e/screenshots/09-viewport-mobile.png',
      fullPage: true
    });
    console.log('✓ Mobile viewport captured');
  });

  test('should test form interactions if forms exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for input fields
    const inputs = await page.locator('input, textarea').all();
    console.log(`✓ Found ${inputs.length} input fields`);

    if (inputs.length > 0) {
      // Take screenshot before form interaction
      await page.screenshot({
        path: 'e2e/screenshots/10-before-form-interaction.png'
      });

      // Fill in the first input field
      const firstInput = inputs[0];
      const isVisible = await firstInput.isVisible();
      const inputType = await firstInput.getAttribute('type');

      if (isVisible && inputType !== 'hidden') {
        const placeholder = await firstInput.getAttribute('placeholder');
        console.log(`✓ Filling input: ${placeholder ? `"${placeholder}"` : '[no placeholder]'}`);

        await firstInput.fill('Test input from Playwright');

        // Take screenshot after filling
        await page.screenshot({
          path: 'e2e/screenshots/11-after-form-interaction.png'
        });
      }
    } else {
      console.log('✓ No form inputs found to interact with');
    }
  });
});
