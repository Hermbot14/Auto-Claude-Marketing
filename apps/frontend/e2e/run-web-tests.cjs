/**
 * Run Web E2E Tests
 * Simple script to run the web-specific Playwright tests
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(60));
console.log('Running Web E2E Tests for Auto-Marketing');
console.log('='.repeat(60));

const frontendDir = path.join(__dirname, '../');
const configPath = 'e2e/playwright.web.config.ts';

console.log(`Working directory: ${frontendDir}`);
console.log(`Config: ${configPath}`);
console.log('');

// Change to frontend directory
process.chdir(frontendDir);

// Run tests using npx
const args = [
  'playwright',
  'test',
  '--config=' + configPath,
  '--reporter=list',
  '--reporter=html',
  '--project=chromium'
];

console.log('Running: npx ' + args.join(' '));
console.log('');

const proc = spawn('npx', args, {
  stdio: 'inherit',
  cwd: frontendDir,
  shell: true
});

proc.on('close', (code) => {
  console.log('');
  console.log('='.repeat(60));
  if (code === 0) {
    console.log('Tests completed successfully!');
  } else {
    console.log(`Tests completed with exit code: ${code}`);
  }
  console.log('='.repeat(60));
  console.log('Report: tmp/playwright-report/web-report/index.html');
  process.exit(code);
});
