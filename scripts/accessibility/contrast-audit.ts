#!/usr/bin/env bun
/**
 * Color Contrast Audit Script
 *
 * Build-time accessibility audit for color contrast.
 * Validates all theme colors against WCAG 2.1 standards.
 *
 * Usage:
 *   bun run contrast-audit
 *   bun run contrast-audit --fix
 *   bun run contrast-audit --json
 *
 * Exit codes:
 *   0 - All themes pass WCAG AA
 *   1 - Contrast violations found
 *   2 - Configuration error
 *
 * @see {@link https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html}
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// TYPES AND INTERFACES
// ============================================

/**
 * Color palette definition
 */
interface ColorPalette {
  name: string;
  mode: 'light' | 'dark';
  colors: {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    mutedForeground: string;
    secondary: string;
    success: string;
    error: string;
    warning: string;
    border: string;
    inputBorder: string;
  };
}

/**
 * Color pair to validate
 */
interface ColorPair {
  key: string;
  fg: string;
  bg: string;
  minRatio: number;
  textSize?: 'normal' | 'large';
}

/**
 * Contrast check result
 */
interface ContrastCheck {
  theme: string;
  mode: string;
  property: string;
  foreground: string;
  background: string;
  ratio: number;
  expected: number;
  level: 'FAIL' | 'AA' | 'AAA';
  wcagLevel: 'AA' | 'AAA';
}

/**
 * Audit result summary
 */
interface AuditResult {
  totalThemes: number;
  passedThemes: number;
  failedThemes: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  violations: ContrastCheck[];
  summary: Record<string, { passed: number; failed: number; violations: ContrastCheck[] }>;
}

/**
 * CLI options
 */
interface CliOptions {
  fix?: boolean;
  json?: boolean;
  verbose?: boolean;
  level?: 'AA' | 'AAA';
  config?: string;
}

// ============================================
// THEME DEFINITIONS
// ============================================

/**
 * Default color palettes to validate
 * These should match the CSS custom properties in accessible-colors.css
 */
const DEFAULT_PALETTES: ColorPalette[] = [
  {
    name: 'light',
    mode: 'light',
    colors: {
      background: '#FFFFFF',
      foreground: '#0B0B0F',
      primary: '#4A90E2',
      primaryForeground: '#FFFFFF',
      mutedForeground: '#4B5563',
      secondary: '#7C3AED',
      success: '#16A34A',
      error: '#DC2626',
      warning: '#EA580C',
      border: '#E5E7EB',
      inputBorder: '#D1D5DB',
    },
  },
  {
    name: 'dark',
    mode: 'dark',
    colors: {
      background: '#0B0B0F',
      foreground: '#F9FAFB',
      primary: '#60A5FA',
      primaryForeground: '#0B0B0F',
      mutedForeground: '#E5E7EB',
      secondary: '#A78BFA',
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F97316',
      border: '#1F2937',
      inputBorder: '#374151',
    },
  },
  {
    name: 'enhanced-contrast-light',
    mode: 'light',
    colors: {
      background: '#FFFFFF',
      foreground: '#000000',
      primary: '#000000',
      primaryForeground: '#FFFFFF',
      mutedForeground: '#1A1A1A',
      secondary: '#0000FF',
      success: '#004D00',
      error: '#8B0000',
      warning: '#8B4500',
      border: '#000000',
      inputBorder: '#000000',
    },
  },
  {
    name: 'enhanced-contrast-dark',
    mode: 'dark',
    colors: {
      background: '#000000',
      foreground: '#FFFFFF',
      primary: '#FFFFFF',
      primaryForeground: '#000000',
      mutedForeground: '#E5E5E5',
      secondary: '#FFFF00',
      success: '#00FF00',
      error: '#FF0000',
      warning: '#FFFF00',
      border: '#FFFFFF',
      inputBorder: '#FFFFFF',
    },
  },
];

// ============================================
// CONTRAST CALCULATION
// ============================================

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');

  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }

  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/**
 * Calculate relative luminance
 */
function calculateLuminance(r: number, g: number, b: number): number {
  const [sr, sg, sb] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

/**
 * Calculate contrast ratio
 */
function calculateContrastRatio(fg: string, bg: string): number {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);

  const fgLuminance = calculateLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLuminance = calculateLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/**
 * Check if contrast meets WCAG level
 */
function checkWcagLevel(ratio: number, wcagLevel: 'AA' | 'AAA', textSize: 'normal' | 'large'): 'FAIL' | 'AA' | 'AAA' {
  const thresholds = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };

  const threshold = thresholds[wcagLevel][textSize];

  if (ratio >= 7) return 'AAA';
  if (ratio >= threshold) return wcagLevel;
  return 'FAIL';
}

// ============================================
// AUDIT FUNCTIONS
// ============================================

/**
 * Get color pairs to validate for a theme
 */
function getColorPairs(theme: ColorPalette): ColorPair[] {
  const c = theme.colors;

  return [
    { key: 'primary-text', fg: c.foreground, bg: c.background, minRatio: 4.5 },
    { key: 'secondary-text', fg: c.mutedForeground, bg: c.background, minRatio: 4.5 },
    { key: 'primary-on-bg', fg: c.primary, bg: c.background, minRatio: 4.5 },
    { key: 'primary-fg', fg: c.primaryForeground, bg: c.primary, minRatio: 4.5 },
    { key: 'secondary-on-bg', fg: c.secondary, bg: c.background, minRatio: 4.5 },
    { key: 'success-on-bg', fg: c.success, bg: c.background, minRatio: 4.5 },
    { key: 'error-on-bg', fg: c.error, bg: c.background, minRatio: 4.5 },
    { key: 'warning-on-bg', fg: c.warning, bg: c.background, minRatio: 4.5 },
    { key: 'border-on-bg', fg: c.border, bg: c.background, minRatio: 3, textSize: 'large' as const },
    { key: 'input-border-on-bg', fg: c.inputBorder, bg: c.background, minRatio: 3, textSize: 'large' as const },
  ];
}

/**
 * Run audit on all themes
 */
function runAudit(paletteList: ColorPalette[], wcagLevel: 'AA' | 'AAA'): AuditResult {
  const violations: ContrastCheck[] = [];
  const summary: Record<string, { passed: number; failed: number; violations: ContrastCheck[] }> = {};

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;

  for (const theme of paletteList) {
    const themeChecks: ContrastCheck[] = [];
    const pairs = getColorPairs(theme);

    for (const pair of pairs) {
      totalChecks++;

      const ratio = calculateContrastRatio(pair.fg, pair.bg);
      const textSize = pair.textSize || 'normal';
      const level = checkWcagLevel(ratio, wcagLevel, textSize);
      const passes = ratio >= pair.minRatio;

      if (passes) {
        passedChecks++;
      } else {
        failedChecks++;
        const violation: ContrastCheck = {
          theme: theme.name,
          mode: theme.mode,
          property: pair.key,
          foreground: pair.fg,
          background: pair.bg,
          ratio,
          expected: pair.minRatio,
          level,
          wcagLevel,
        };
        violations.push(violation);
        themeChecks.push(violation);
      }
    }

    summary[theme.name] = {
      passed: pairs.length - themeChecks.length,
      failed: themeChecks.length,
      violations: themeChecks,
    };
  }

  return {
    totalThemes: paletteList.length,
    passedThemes: paletteList.length - Object.values(summary).filter(s => s.failed > 0).length,
    failedThemes: Object.values(summary).filter(s => s.failed > 0).length,
    totalChecks,
    passedChecks,
    failedChecks,
    violations,
    summary,
  };
}

// ============================================
// OUTPUT FORMATTING
// ============================================

/**
 * Print console output
 */
function printConsoleOutput(result: AuditResult, options: CliOptions): void {
  console.log('\n' + '='.repeat(60));
  console.log('   Color Contrast Audit - WCAG ' + options.level);
  console.log('='.repeat(60) + '\n');

  console.log(`Total Themes:     ${result.totalThemes}`);
  console.log(`Passed Themes:    ${'✅'.repeat(result.passedThemes)} ${result.passedThemes}`);
  console.log(`Failed Themes:    ${'❌'.repeat(result.failedThemes)} ${result.failedThemes}`);
  console.log('');
  console.log(`Total Checks:      ${result.totalChecks}`);
  console.log(`Passed Checks:     ${'✓'.repeat(Math.min(result.passedChecks, 50))} ${result.passedChecks}`);
  console.log(`Failed Checks:     ${'✗'.repeat(Math.min(result.failedChecks, 50))} ${result.failedChecks}`);
  console.log('');

  // Print violations
  if (result.violations.length > 0) {
    console.log('VIOLATIONS:\n');
    const violationsByTheme = groupViolationsByTheme(result.violations);

    for (const [theme, themeViolations] of Object.entries(violationsByTheme)) {
      console.log(`  ${theme}:`);
      for (const v of themeViolations) {
        console.log(`    ❌ ${v.property}`);
        console.log(`       Ratio: ${v.ratio.toFixed(2)}:1 (expected ${v.expected}:1)`);
        console.log(`       ${v.foreground} on ${v.background}`);
        console.log(`       Level: ${v.level} (WCAG ${v.wcagLevel})`);
      }
      console.log('');
    }
  } else {
    console.log('✅ All themes pass WCAG ' + options.level + ' requirements!\n');
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Group violations by theme
 */
function groupViolationsByTheme(violations: ContrastCheck[]): Record<string, ContrastCheck[]> {
  const grouped: Record<string, ContrastCheck[]> = {};

  for (const v of violations) {
    if (!grouped[v.theme]) {
      grouped[v.theme] = [];
    }
    grouped[v.theme].push(v);
  }

  return grouped;
}

/**
 * Print JSON output
 */
function printJsonOutput(result: AuditResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Print HTML report
 */
function printHtmlReport(result: AuditResult): void {
  const rows = Object.entries(result.summary).map(([themeName, themeResult]) => {
    const statusClass = themeResult.failed > 0 ? 'fail' : 'pass';
    const status = themeResult.failed > 0 ? '❌ FAIL' : '✅ PASS';

    return `
      <tr class="${statusClass}">
        <td>${themeName}</td>
        <td>${status}</td>
        <td>${themeResult.passed}</td>
        <td>${themeResult.failed}</td>
        <td>${themeResult.violations.map(v =>
          `<details><summary>${v.property}</summary>
          <span class="ratio">${v.ratio.toFixed(2)}:1</span>
          <span class="expected">(exp: ${v.expected}:1)</span>
          <span class="colors">${v.foreground} / ${v.background}</span>
          </details>`
        ).join('') || '—'}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Color Contrast Audit Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { padding: 24px; border-bottom: 2px solid #e5e7eb; color: #0B0B0F; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 24px; background: #f9fafb; border-radius: 6px; margin: 24px; }
    .summary-card { padding: 16px; background: white; border-radius: 4px; border: 1px solid #e5e7eb; }
    .summary-card h3 { font-size: 14px; color: #6b7280; margin: 0 0 8px 0; }
    .summary-card .value { font-size: 32px; font-weight: 700; }
    .summary-card.pass .value { color: #16a34A; }
    .summary-card.fail .value { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: #f9fafb; }
    .pass { background: #d1fae5; }
    .fail { background: #fee2e2; }
    details { cursor: pointer; }
    summary { font-size: 12px; color: #4b5563; }
    .ratio { font-weight: 600; color: #0B0B0F; }
    .expected { color: #6b7280; font-size: 11px; }
    .colors { font-family: monospace; font-size: 11px; background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
    .footer { padding: 24px; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Color Contrast Audit Report</h1>
    <p style="padding: 0 24px; color: #6b7280;">
      Generated: ${new Date().toISOString()}<br>
      WCAG Level: ${result.violations.length > 0 ? 'FAILED' : 'PASSED'}
    </p>

    <div class="summary">
      <div class="summary-card ${result.failedThemes === 0 ? 'pass' : 'fail'}">
        <h3>Themes</h3>
        <div class="value">${result.totalThemes}</div>
      </div>
      <div class="summary-card pass">
        <h3>Passed</h3>
        <div class="value">${result.passedThemes}</div>
      </div>
      <div class="summary-card ${result.failedThemes > 0 ? 'fail' : 'pass'}">
        <h3>Failed</h3>
        <div class="value">${result.failedThemes}</div>
      </div>
      <div class="summary-card pass">
        <h3>Total Checks</h3>
        <div class="value">${result.totalChecks}</div>
      </div>
      <div class="summary-card pass">
        <h3>Passed Checks</h3>
        <div class="value">${result.passedChecks}</div>
      </div>
      <div class="summary-card ${result.failedChecks > 0 ? 'fail' : 'pass'}">
        <h3>Failed Checks</h3>
        <div class="value">${result.failedChecks}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Theme</th>
          <th>Status</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Violations</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      <p>WCAG 2.1 Level AA: 4.5:1 for normal text, 3:1 for large text</p>
      <p>WCAG 2.1 Level AAA: 7:1 for normal text, 4.5:1 for large text</p>
    </div>
  </div>
</body>
</html>`;

  const reportPath = resolve(__dirname, '../../tmp/contrast-report.html');
  writeFileSync(reportPath, html, 'utf-8');
  console.log(`\n📄 HTML report saved to: ${reportPath}`);
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Parse CLI arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    level: 'AA',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--fix') {
      options.fix = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--aaa') {
      options.level = 'AAA';
    } else if (arg === '--config') {
      options.config = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Color Contrast Audit - Validate theme colors against WCAG standards

Usage:
  bun run contrast-audit [options]

Options:
  --fix       Attempt to fix violations (experimental)
  --json      Output results as JSON
  --verbose    Show detailed output
  --aaa       Check against WCAG AAA (default: AA)
  --config    Path to custom theme config
  --help, -h  Show this help

Exit codes:
  0 - All themes pass
  1 - Contrast violations found
  2 - Configuration error

Examples:
  bun run contrast-audit
  bun run contrast-audit --aaa
  bun run contrast-audit --json > report.json
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Main function
 */
function main(): number {
  const options = parseArgs();

  // Load custom config if provided
  let palettes = DEFAULT_PALETTES;
  if (options.config && existsSync(options.config)) {
    try {
      const configContent = readFileSync(options.config, 'utf-8');
      const config = JSON.parse(configContent);
      if (config.palettes && Array.isArray(config.palettes)) {
        palettes = config.palettes;
        if (options.verbose) {
          console.log(`Loaded ${palettes.length} themes from config: ${options.config}`);
        }
      }
    } catch (error) {
      console.error(`Error loading config: ${error}`);
      return 2;
    }
  }

  // Run the audit
  const result = runAudit(palettes, options.level || 'AA');

  // Output results
  if (options.json) {
    printJsonOutput(result);
  } else {
    printConsoleOutput(result, options);
    printHtmlReport(result);
  }

  // Return exit code
  if (result.failedChecks > 0) {
    console.error('💡 To fix violations, adjust color values in accessible-colors.css');
    console.error('💡 Use the ColorContrastChecker component to test changes interactively');
    return 1;
  }

  return 0;
}

// Run main
const exitCode = main();
process.exit(exitCode);
