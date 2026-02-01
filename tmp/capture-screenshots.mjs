/**
 * Script to capture screenshots of the Marketing Hub UI
 */
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

// Ensure screenshot directory exists
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureScreenshots() {
  console.log('Starting screenshot capture...');
  console.log('Screenshot directory:', SCREENSHOT_DIR);

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // List of URLs/routes to capture
  const routes = [
    { name: 'homepage', url: 'http://localhost:3000', description: 'Home page' },
    { name: 'homepage-full', url: 'http://localhost:3000', description: 'Home page (full scroll)', fullPage: true },
  ];

  const results = [];

  for (const route of routes) {
    try {
      console.log(`\nCapturing: ${route.name} - ${route.description}`);
      console.log(`URL: ${route.url}`);

      await page.goto(route.url, {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      // Wait for any animations to complete
      await page.waitForTimeout(2000);

      // Capture screenshot
      const screenshotPath = join(SCREENSHOT_DIR, `${route.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: route.fullPage || false
      });

      // Get page information
      const title = await page.title();
      const url = page.url();
      const contentLength = await page.evaluate(() => document.body.innerText.length);
      const hasContent = contentLength > 100;

      // Get heading elements
      const headings = await page.evaluate(() => {
        const headings = [];
        document.querySelectorAll('h1, h2, h3').forEach(h => {
          headings.push({
            tag: h.tagName,
            text: h.textContent?.trim()
          });
        });
        return headings;
      });

      results.push({
        name: route.name,
        url: route.url,
        description: route.description,
        title,
        screenshot: screenshotPath,
        success: true,
        hasContent,
        contentLength,
        headings
      });

      console.log(`✓ Captured: ${screenshotPath}`);
      console.log(`  Title: ${title}`);
      console.log(`  Has content: ${hasContent} (${contentLength} chars)`);
      console.log(`  Headings found: ${headings.length}`);

    } catch (error) {
      console.error(`✗ Failed to capture ${route.name}:`, error.message);
      results.push({
        name: route.name,
        url: route.url,
        description: route.description,
        success: false,
        error: error.message
      });
    }
  }

  await browser.close();

  // Generate summary report
  console.log('\n' + '='.repeat(60));
  console.log('SCREENSHOT CAPTURE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total routes attempted: ${routes.length}`);
  console.log(`Successful captures: ${results.filter(r => r.success).length}`);
  console.log(`Failed captures: ${results.filter(r => !r.success).length}`);

  console.log('\n📸 CAPTURED SCREENSHOTS:');
  results
    .filter(r => r.success)
    .forEach(r => {
      console.log(`\n  ✓ ${r.name}`);
      console.log(`    Path: ${r.screenshot}`);
      console.log(`    Title: ${r.title}`);
      console.log(`    URL: ${r.url}`);
      console.log(`    Description: ${r.description}`);
      console.log(`    Content length: ${r.contentLength} characters`);
      if (r.headings && r.headings.length > 0) {
        console.log(`    Headings:`);
        r.headings.slice(0, 5).forEach(h => {
          console.log(`      ${h.tag}: ${h.text}`);
        });
      }
    });

  if (results.some(r => !r.success)) {
    console.log('\n❌ FAILED CAPTURES:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  ✗ ${r.name}: ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(60));

  return results;
}

// Run the capture
captureScreenshots()
  .then(results => {
    console.log('\n✅ Screenshot capture complete!');
    process.exit(results.some(r => r.success) ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
