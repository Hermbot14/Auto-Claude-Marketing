/**
 * Script to capture screenshots of the Marketing Hub UI
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = join(process.cwd(), 'tmp', 'screenshots');

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
    { name: 'features', url: 'http://localhost:3000#features', description: 'Features section' },
    { name: 'getting-started', url: 'http://localhost:3000#getting-started', description: 'Getting started guide' },
    { name: 'documentation', url: 'http://localhost:3000#documentation', description: 'Documentation section' },
    { name: 'community', url: 'http://localhost:3000#community', description: 'Community section' }
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

      // Capture full page screenshot
      const screenshotPath = join(SCREENSHOT_DIR, `${route.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      // Get page title and description
      const title = await page.title();
      const hasContent = await page.evaluate(() => {
        return document.body.innerText.length > 100;
      });

      results.push({
        name: route.name,
        url: route.url,
        description: route.description,
        title,
        screenshot: screenshotPath,
        success: true,
        hasContent
      });

      console.log(`✓ Captured: ${screenshotPath}`);
      console.log(`  Title: ${title}`);
      console.log(`  Has content: ${hasContent}`);

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
  console.log('\n=== SCREENSHOT CAPTURE SUMMARY ===');
  console.log(`Total routes attempted: ${routes.length}`);
  console.log(`Successful captures: ${results.filter(r => r.success).length}`);
  console.log(`Failed captures: ${results.filter(r => !r.success).length}`);

  console.log('\nCaptured screenshots:');
  results
    .filter(r => r.success)
    .forEach(r => {
      console.log(`  ✓ ${r.name}: ${r.screenshot}`);
      console.log(`    Title: ${r.title}`);
      console.log(`    URL: ${r.url}`);
      console.log(`    Description: ${r.description}`);
    });

  if (results.some(r => !r.success)) {
    console.log('\nFailed captures:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  ✗ ${r.name}: ${r.error}`);
      });
  }

  return results;
}

// Run the capture
captureScreenshots()
  .then(results => {
    console.log('\nScreenshot capture complete!');
    process.exit(results.some(r => r.success) ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
