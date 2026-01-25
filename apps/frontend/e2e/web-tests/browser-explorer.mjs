#!/usr/bin/env node

/**
 * Browser Exploration Script
 *
 * A standalone script for quick browser-based UI exploration.
 * This can be run directly without the full test framework.
 *
 * Usage: node e2e/web-tests/browser-explorer.mjs
 */

import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = 'e2e/screenshots';

async function exploreBrowser() {
  console.log('🚀 Starting Browser Exploration...');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log('');

  // Launch Chromium browser
  const browser = await chromium.launch({
    headless: false, // Show the browser window
    slowMo: 100 // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // 1. Navigate to the website
    console.log('1️⃣ Navigating to website...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    console.log('✓ Page loaded');

    // 2. Take initial screenshot
    console.log('2️⃣ Taking initial screenshot...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explorer-01-initial.png`,
      fullPage: true
    });
    console.log('✓ Screenshot saved');

    // 3. Get page information
    console.log('3️⃣ Gathering page information...');
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasMain: !!document.querySelector('main'),
        hasHeader: !!document.querySelector('header'),
        hasFooter: !!document.querySelector('footer'),
        hasNav: !!document.querySelector('nav'),
        buttonCount: document.querySelectorAll('button').length,
        linkCount: document.querySelectorAll('a').length,
        inputCount: document.querySelectorAll('input').length
      };
    });

    console.log('  Page Title:', pageInfo.title);
    console.log('  URL:', pageInfo.url);
    console.log('  Structure:');
    console.log('    - <main>:', pageInfo.hasMain);
    console.log('    - <header>:', pageInfo.hasHeader);
    console.log('    - <footer>:', pageInfo.hasFooter);
    console.log('    - <nav>:', pageInfo.hasNav);
    console.log('  Elements:');
    console.log('    - Buttons:', pageInfo.buttonCount);
    console.log('    - Links:', pageInfo.linkCount);
    console.log('    - Inputs:', pageInfo.inputCount);

    // 4. Explore headings
    console.log('4️⃣ Exploring page headings...');
    const headings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
        tag: h.tagName,
        text: h.textContent?.trim().substring(0, 50)
      }));
    });

    console.log(`✓ Found ${headings.length} headings:`);
    headings.forEach(h => {
      console.log(`  ${h.tag}: ${h.text}${h.text.length >= 50 ? '...' : ''}`);
    });

    // 5. Explore navigation links
    console.log('5️⃣ Exploring navigation links...');
    const links = await page.locator('a').all();
    console.log(`✓ Found ${links.length} links`);

    const linkInfo = [];
    for (let i = 0; i < Math.min(links.length, 10); i++) {
      const text = await links[i].textContent();
      const href = await links[i].getAttribute('href');
      linkInfo.push({ text: text?.trim(), href });
    }

    console.log('  First 10 links:');
    linkInfo.forEach((link, i) => {
      console.log(`  [${i + 1}] ${link.text || '[empty]'} -> ${link.href || '[no href]'}`);
    });

    // 6. Screenshot before interaction
    console.log('6️⃣ Taking screenshot before interaction...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explorer-02-before-interaction.png`
    });

    // 7. Click a button if available
    if (pageInfo.buttonCount > 0) {
      console.log('7️⃣ Testing button interaction...');
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          const buttonText = await button.textContent();
          console.log(`  Clicking: "${buttonText?.trim()}"`);
          await button.click();
          await page.waitForTimeout(1000);
          break;
        }
      }

      // Screenshot after interaction
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/explorer-03-after-interaction.png`
      });
      console.log('✓ Interaction complete');
    } else {
      console.log('7️⃣ No buttons to interact with');
    }

    // 8. Test responsive viewports
    console.log('8️⃣ Testing responsive viewports...');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explorer-04-viewport-tablet.png`
    });
    console.log('  ✓ Tablet viewport captured');

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explorer-05-viewport-mobile.png`
    });
    console.log('  ✓ Mobile viewport captured');

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explorer-06-viewport-desktop.png`
    });
    console.log('  ✓ Desktop viewport captured');

    // 9. Get console logs (if any)
    console.log('9️⃣ Checking for console messages...');
    // Note: Console logs would need to be collected during page load
    console.log('  (Console log collection requires page.on("console") setup)');

    console.log('');
    console.log('✅ Browser exploration complete!');
    console.log('');
    console.log('📸 Screenshots saved to:');
    console.log(`   ${SCREENSHOT_DIR}/explorer-*.png`);
    console.log('');

    // Keep browser open for manual inspection
    console.log('🔍 Keeping browser open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Error during exploration:', error.message);
  } finally {
    await browser.close();
    console.log('✓ Browser closed');
  }
}

// Run the exploration
exploreBrowser().catch(console.error);
