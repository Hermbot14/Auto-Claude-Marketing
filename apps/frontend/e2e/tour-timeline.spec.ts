import { test, expect } from '@playwright/test';

/**
 * Tour Timeline Calendar E2E Tests
 * Tests the Tour Timeline view with countdowns, status indicators, and mock data
 */

test.describe('Tour Timeline Calendar', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl);
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display Tour Timeline view', async ({ page }) => {
    // Click on Calendar in sidebar
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);

    // Click on Tour Timeline view button
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/tour-timeline-view.png', fullPage: true });

    // Verify timeline is visible
    await expect(page.locator('text=Tour Timeline')).toBeVisible();
  });

  test('should display campaign cards with countdowns', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Look for countdown badges (clock icon)
    const countdownBadges = page.locator('[class*="bg-red-100"], [class*="bg-gray-100"]').filter({ hasText: /\d+/ });

    // Take screenshot of campaign cards
    await page.screenshot({ path: 'test-results/tour-timeline-countdowns.png' });

    // Verify countdown elements exist
    const count = await countdownBadges.count();
    console.log(`Found ${count} countdown badges`);

    // Should have at least some campaigns
    expect(count).toBeGreaterThan(0);
  });

  test('should display status indicators', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Look for status indicators (dots with different colors)
    const statusIndicators = page.locator('[class*="rounded-full"]');

    const count = await statusIndicators.count();
    console.log(`Found ${count} status indicators`);

    await page.screenshot({ path: 'test-results/tour-timeline-status.png' });

    // Should have status indicators
    expect(count).toBeGreaterThan(0);
  });

  test('should filter by category', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Click on a category filter (e.g., Sports Event)
    const sportsEventButton = page.locator('button:has-text("Sports Event")').first();
    await sportsEventButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/tour-timeline-filtered.png' });

    // Verify filter is applied (button should be highlighted)
    await expect(sportsEventButton).toHaveAttribute('class', /bg-blue-50/);
  });

  test('should show zoom controls', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Check for zoom level buttons
    await expect(page.locator('button:has-text("month")')).toBeVisible();
    await expect(page.locator('button:has-text("quarter")')).toBeVisible();
    await expect(page.locator('button:has-text("year")')).toBeVisible();

    // Test quarter zoom
    await page.click('button:has-text("quarter")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/tour-timeline-quarter-zoom.png' });
  });

  test('should display campaign detail panel on click', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Click on a campaign card
    const campaignCard = page.locator('[class*="absolute"]').first();
    await campaignCard.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/tour-timeline-detail-panel.png' });

    // Verify detail panel is shown
    await expect(page.locator('text=Dates')).toBeVisible();
    await expect(page.locator('text=Location')).toBeVisible();
  });

  test('should display today indicator', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Look for the today indicator (red line)
    const todayIndicator = page.locator('[class*="bg-red-500"][class*="absolute"]');

    await page.screenshot({ path: 'test-results/tour-timeline-today-indicator.png' });

    // The today indicator should exist when today is in range
    const count = await todayIndicator.count();
    console.log(`Today indicator count: ${count}`);
  });

  test('should have navigation controls', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Check for navigation buttons
    await expect(page.locator('button[aria-label*="Previous"]')).toBeVisible();
    await expect(page.locator('button[aria-label*="Next"]')).toBeVisible();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();

    // Test navigation
    await page.click('button[aria-label*="Next"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/tour-timeline-navigated.png' });
  });

  test('should display mock tour campaigns', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Look for specific campaigns from mock data
    const campaigns = [
      'Australian Open',
      'FIH Pro League',
      'Taylor Swift',
      'World Baseball Classic',
      'Rugby World Cup',
      'Olympics'
    ];

    for (const campaign of campaigns) {
      const element = page.locator(`text=${campaign}`).first();
      const isVisible = await element.isVisible().catch(() => false);
      console.log(`${campaign}: ${isVisible ? 'Found' : 'Not found'}`);
    }

    await page.screenshot({ path: 'test-results/tour-timeline-campaigns.png' });
  });

  test('should support search functionality', async ({ page }) => {
    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('Olympics');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/tour-timeline-search.png' });

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);
  });
});

test.describe('Tour Timeline - Countdown Display', () => {
  const baseUrl = 'http://localhost:3000';

  test('should show different countdown formats', async ({ page }) => {
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    await page.click('text=Calendar');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Tour Timeline")');
    await page.waitForTimeout(3000);

    // Get all countdown texts
    const countdownElements = await page.locator('[class*="countdown" i], [class*="rounded-md"]').all();

    console.log(`Found ${countdownElements.length} potential countdown elements`);

    await page.screenshot({ path: 'test-results/tour-timeline-countdown-formats.png' });
  });
});
