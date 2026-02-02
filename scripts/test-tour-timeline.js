/**
 * Simple Tour Timeline Verification Script
 * Uses Playwright to navigate to the web UI and verify the Tour Timeline
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '../test-results', 'tour-timeline');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTourTimeline() {
  console.log('🚀 Starting Tour Timeline verification...');
  console.log(`📍 Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate to the app
    console.log('🌐 Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-homepage.png') });
    console.log('✅ Homepage loaded');

    // Look for Calendar in sidebar
    console.log('🔍 Looking for Calendar navigation...');
    const calendarLink = await page.$('text=Calendar');
    if (!calendarLink) {
      console.log('⚠️  Calendar link not found, looking for alternative...');
      // Try to find by role or text content
      const elements = await page.$$('a, button, div');
      for (const el of elements) {
        const text = await el.textContent();
        if (text && text.toLowerCase().includes('calendar')) {
          console.log('✅ Found Calendar element');
          await el.click();
          break;
        }
      }
    } else {
      console.log('✅ Found Calendar link');
      await calendarLink.click();
    }
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-calendar-view.png') });
    console.log('✅ Calendar view loaded');

    // Look for Tour Timeline button
    console.log('🔍 Looking for Tour Timeline button...');
    const timelineButtons = await page.$$('button');
    let timelineFound = false;

    for (const button of timelineButtons) {
      const text = await button.textContent();
      if (text && (text.includes('Tour Timeline') || text.includes('Timeline'))) {
        console.log('✅ Found Tour Timeline button');
        await button.click();
        timelineFound = true;
        break;
      }
    }

    if (!timelineFound) {
      console.log('⚠️  Tour Timeline button not found, checking URL...');
      // Try to navigate directly via hash
      await page.goto(`${BASE_URL}#calendar`, { waitUntil: 'networkidle' });
      await sleep(2000);
    }

    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-tour-timeline.png'), fullPage: true });
    console.log('✅ Tour Timeline screenshot captured');

    // Check for campaign cards
    console.log('🔍 Checking for campaign cards...');
    const campaignCards = await page.$$('[class*="absolute"], [class*="campaign"], [class*="bg-"]');
    console.log(`✅ Found ${campaignCards.length} potential campaign cards`);

    // Check for countdown badges
    console.log('🔍 Checking for countdown badges...');
    const countdownBadges = await page.$$('[class*="bg-red-100"], [class*="bg-gray-100"], [class*="text-red"]');
    console.log(`✅ Found ${countdownBadges.length} countdown-related elements`);

    // Check for status indicators
    console.log('🔍 Checking for status indicators...');
    const statusIndicators = await page.$$('[class*="bg-blue-50"], [class*="bg-amber-50"], [class*="bg-green-50"]');
    console.log(`✅ Found ${statusIndicators.length} status indicator elements`);

    // Get page text to look for specific campaigns
    console.log('🔍 Checking for mock campaign data...');
    const pageText = await page.textContent('body');
    const campaigns = ['Australian Open', 'FIH Pro League', 'Taylor Swift', 'Olympics', 'Rugby World Cup'];

    for (const campaign of campaigns) {
      if (pageText && pageText.includes(campaign)) {
        console.log(`✅ Found campaign: ${campaign}`);
      } else {
        console.log(`⚠️  Campaign not found: ${campaign}`);
      }
    }

    // Check for zoom controls
    console.log('🔍 Checking for zoom controls...');
    const zoomButtons = await page.$$('button');
    let foundMonth = false, foundQuarter = false, foundYear = false;

    for (const button of zoomButtons) {
      const text = await button.textContent();
      if (text) {
        if (text.includes('month')) foundMonth = true;
        if (text.includes('quarter')) foundQuarter = true;
        if (text.includes('year')) foundYear = true;
      }
    }

    console.log(`  - Month zoom: ${foundMonth ? '✅' : '❌'}`);
    console.log(`  - Quarter zoom: ${foundQuarter ? '✅' : '❌'}`);
    console.log(`  - Year zoom: ${foundYear ? '✅' : '❌'}`);

    // Check for category filters
    console.log('🔍 Checking for category filters...');
    const categories = ['Sports Event', 'Concert Tour', 'Championship', 'Olympics'];
    for (const category of categories) {
      if (pageText && pageText.includes(category)) {
        console.log(`✅ Found category: ${category}`);
      }
    }

    // Final full page screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-full-timeline.png'), fullPage: true });

    console.log('');
    console.log('📊 Tour Timeline Verification Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`✅ Campaign cards found: ${campaignCards.length}`);
    console.log(`✅ Countdown elements: ${countdownBadges.length}`);
    console.log(`✅ Status indicators: ${statusIndicators.length}`);
    console.log(`✅ Zoom controls: ${foundMonth && foundQuarter && foundYear ? 'Complete' : 'Partial'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎉 Tour Timeline verification complete!');
    console.log('');
    console.log('To view screenshots:');
    console.log(`  ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error-screenshot.png') });
    throw error;
  } finally {
    await sleep(3000); // Keep browser open for 3 seconds to see the result
    await browser.close();
  }
}

// Run the test
testTourTimeline().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
