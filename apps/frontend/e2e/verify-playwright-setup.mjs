#!/usr/bin/env node

/**
 * Playwright Setup Verification Script
 *
 * This script verifies that Playwright is properly configured for browser testing.
 */

import { chromium } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://localhost:3000';

async function verifySetup() {
  console.log('🔍 Playwright Setup Verification\n');
  console.log('================================\n');

  let allPassed = true;

  // 1. Check if Playwright is installed
  console.log('1️⃣ Checking Playwright installation...');
  try {
    const browser = await chromium.launch();
    await browser.close();
    console.log('✅ Playwright is installed and Chromium is available\n');
  } catch (error) {
    console.log('❌ Playwright or Chromium not installed');
    console.log('   Run: npm run playwright:install\n');
    allPassed = false;
    return;
  }

  // 2. Check config files
  console.log('2️⃣ Checking configuration files...');
  const configFiles = [
    'e2e/playwright.config.ts',
    'e2e/playwright.web.config.ts',
    'e2e/web-tests/basic-ui-exploration.spec.ts',
    'e2e/web-tests/browser-explorer.mjs'
  ];

  const rootDir = resolve(__dirname, '..', '..');
  let allConfigsExist = true;

  for (const file of configFiles) {
    const filePath = resolve(rootDir, file);
    if (existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - NOT FOUND`);
      allConfigsExist = false;
    }
  }

  if (allConfigsExist) {
    console.log('✅ All configuration files present\n');
  } else {
    console.log('❌ Some configuration files missing\n');
    allPassed = false;
  }

  // 3. Check directories
  console.log('3️⃣ Checking directories...');
  const directories = [
    'e2e/web-tests',
    'e2e/screenshots'
  ];

  let allDirsExist = true;
  for (const dir of directories) {
    const dirPath = resolve(rootDir, dir);
    if (existsSync(dirPath)) {
      console.log(`✅ ${dir}/`);
    } else {
      console.log(`❌ ${dir}/ - NOT FOUND`);
      allDirsExist = false;
    }
  }

  if (allDirsExist) {
    console.log('✅ All directories present\n');
  } else {
    console.log('❌ Some directories missing\n');
    allPassed = false;
  }

  // 4. Check if web server can start (optional)
  console.log('4️⃣ Web server check...');
  console.log('   Note: Web server will be started automatically when running tests');
  console.log('   To manually start: npm run dev:web\n');

  // 5. Summary
  console.log('================================');
  console.log('\n📋 Summary:\n');

  if (allPassed) {
    console.log('✅ Playwright setup is complete!\n');
    console.log('Next steps:');
    console.log('  1. Run web UI tests:');
    console.log('     npm run test:e2e:web');
    console.log('\n  2. Run browser exploration:');
    console.log('     npm run test:web:explore');
    console.log('\n  3. Run tests with visible browser:');
    console.log('     npx playwright test --config=e2e/playwright.web.config.ts --headed');
  } else {
    console.log('⚠️  Some issues detected. Please review the output above.\n');
    console.log('To fix issues:');
    console.log('  1. Install Chromium: npm run playwright:install');
    console.log('  2. Create missing directories: mkdir -p e2e/screenshots');
  }

  console.log('\nFor more information, see: e2e/PLAYWRIGHT_SETUP.md');
  console.log('');
}

// Run verification
verifySetup().catch(error => {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
});
