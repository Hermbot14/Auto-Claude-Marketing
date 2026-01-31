/**
 * Run E2E Tests Script
 *
 * This script:
 * 1. Starts the web dev server in background
 * 2. Waits for it to be ready
 * 3. Runs Playwright tests
 * 4. Shuts down the server
 * 5. Generates test report
 */

import { spawn } from 'child_process';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../../tmp/screenshots-e2e-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5));
const REPORT_DIR = path.join(__dirname, '../../tmp/playwright-report');

// Create directories
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

console.log('='.repeat(60));
console.log('E2E Test Runner for Auto-Marketing');
console.log('='.repeat(60));
console.log(`Screenshot dir: ${SCREENSHOT_DIR}`);
console.log(`Report dir: ${REPORT_DIR}`);
console.log('');

// Function to wait for server
function waitForServer(port, maxWait = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const checkServer = () => {
      require('net').createConnection({ port })
        .on('connect', () => {
          console.log(`Server is ready on port ${port}`);
          resolve(true);
        })
        .on('error', () => {
          if (Date.now() - start > maxWait) {
            reject(new Error(`Server didn't start within ${maxWait}ms`));
          } else {
            setTimeout(checkServer, 500);
          }
        });
    };

    checkServer();
  });
}

// Function to run command
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      shell: true,
      stdio: 'inherit',
      ...options
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  let serverProc = null;

  try {
    // Check if server is already running
    try {
      await waitForServer(3000, 5000);
      console.log('Server already running on port 3000');
    } catch {
      // Start the dev server
      console.log('Starting dev server...');
      serverProc = spawn('npm', ['run', 'dev:web'], {
        shell: true,
        stdio: 'pipe',
        cwd: path.join(__dirname, '../frontend')
      });

      serverProc.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      serverProc.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      // Wait for server
      await waitForServer(3000);
    }

    // Give extra time for Vite to fully initialize
    console.log('Waiting for Vite to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Run Playwright tests
    console.log('');
    console.log('Running Playwright tests...');
    console.log('='.repeat(60));

    await runCommand('npx', [
      'playwright',
      'test',
      '--config=e2e/playwright.web.config.ts',
      '--reporter=list',
      '--reporter=html',
      '--reporter=json',
      `--output=../../tmp/e2e-results.json`
    ], {
      cwd: path.join(__dirname, '../frontend')
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('Tests completed!');
    console.log('='.repeat(60));
    console.log(`Screenshots: ${SCREENSHOT_DIR}`);
    console.log(`Report: ${REPORT_DIR}/web-report/index.html`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (serverProc) {
      console.log('Shutting down server...');
      serverProc.kill();
    }
  }
}

main();
