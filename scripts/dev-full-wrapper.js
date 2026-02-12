#!/usr/bin/env node
/**
 * Cross-platform wrapper for the dev-full script
 * Detects platform and launches the appropriate script
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const platform = os.platform();
const scriptDir = __dirname;

console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════════════════════════╗');
console.log('\x1b[36m%s\x1b[0m', '║     Auto Claude Marketing Hub - Dev Environment Setup     ║');
console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════════════════════════╝');
console.log();

let script, args, shell;

switch (platform) {
  case 'win32':
    script = 'powershell.exe';
    args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', path.join(scriptDir, 'dev-full.ps1'),
      ...process.argv.slice(2).map(arg => {
        // Convert npm-style flags to PowerShell
        if (arg === '--skip-deps') return '-SkipDepsCheck';
        if (arg === '--no-browser') return '-NoBrowser';
        if (arg === '--no-qr') return '-NoQR';
        if (arg === '--verbose') return '-Verbose';
        return arg;
      })
    ];
    shell = false;
    break;

  case 'darwin':
  case 'linux':
    const bashScript = path.join(scriptDir, 'dev-full.sh');

    // Ensure bash script is executable
    try {
      fs.chmodSync(bashScript, 0o755);
    } catch (err) {
      console.warn('\x1b[33m%s\x1b[0m', '⚠ Warning: Could not set execute permission. You may need to run: chmod +x scripts/dev-full.sh');
    }

    script = bashScript;
    args = process.argv.slice(2);
    shell = true;
    break;

  default:
    console.error('\x1b[31m%s\x1b[0m', `❌ Unsupported platform: ${platform}`);
    console.error('\x1b[33m%s\x1b[0m', 'Supported platforms: Windows, macOS, Linux');
    process.exit(1);
}

// Spawn the appropriate script
const child = spawn(script, args, {
  stdio: 'inherit',
  shell: shell,
  env: { ...process.env }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `❌ Failed to start script: ${err.message}`);
  process.exit(1);
});
