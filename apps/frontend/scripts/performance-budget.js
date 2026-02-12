#!/usr/bin/env node
/**
 * Performance Budget Checker
 *
 * Validates bundle sizes and Lighthouse metrics against defined budgets.
 * Use in CI/CD to prevent performance regressions.
 *
 * Usage:
 *   node scripts/performance-budget.js                    # Check built bundles
 *   node scripts/performance-budget.js --lighthouse        # Run Lighthouse audit
 *   node scripts/performance-budget.js --compare base.json   # Compare against baseline
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'performance-budget.config.json');

// Load budget configuration
let budgetConfig;
try {
  budgetConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
} catch (error) {
  console.error('Failed to load performance budget configuration:', error.message);
  process.exit(1);
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(ms) {
  return `${ms.toFixed(0)}ms`;
}

function getColor(value, budget, warning) {
  if (value > budget) return 'red';
  if (value > warning) return 'yellow';
  return 'green';
}

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Check bundle sizes against budgets
 */
async function checkBundleSizes() {
  console.log('\n' + colorize('📦 Bundle Size Analysis', 'blue') + '\n');

  const results = [];
  const budgetSizes = budgetConfig.budgets.resources.bundleSize;
  const budgetAssets = budgetConfig.budgets.resources.assets;

  // Check main bundle
  const outDir = join(ROOT, 'out');
  const rendererDir = join(outDir, 'renderer');

  if (!existsSync(rendererDir)) {
    console.log(colorize('  ⚠ No build output found. Run "bun run build" first.', 'yellow'));
    return null;
  }

  // Collect all JS files
  const jsFiles = await glob('**/*.js', { cwd: rendererDir, absolute: false });
  const cssFiles = await glob('**/*.css', { cwd: rendererDir, absolute: false });

  // Calculate sizes
  let totalJsSize = 0;
  let totalCssSize = 0;

  for (const file of jsFiles) {
    const filePath = join(rendererDir, file);
    const stats = statSync(filePath);
    totalJsSize += stats.size;
  }

  for (const file of cssFiles) {
    const filePath = join(rendererDir, file);
    const stats = statSync(filePath);
    totalCssSize += stats.size;
  }

  // Check against budgets
  const checks = [
    {
      name: 'JavaScript Total',
      actual: totalJsSize,
      budget: budgetSizes.main.budget,
      warning: budgetSizes.main.warning,
      format: formatBytes
    },
    {
      name: 'CSS Total',
      actual: totalCssSize,
      budget: budgetSizes.css.budget,
      warning: budgetSizes.css.warning,
      format: formatBytes
    }
  ];

  let passed = true;
  for (const check of checks) {
    const color = getColor(check.actual, check.budget, check.warning);
    const status = check.actual <= check.budget ? '✓' : '✗';
    const output = `  ${status} ${check.name}: ${colorize(check.format(check.actual), color)} / ${check.format(check.budget)}`;

    console.log(output);
    results.push({
      metric: check.name,
      actual: check.actual,
      budget: check.budget,
      warning: check.warning,
      passed: check.actual <= check.budget
    });

    if (check.actual > check.budget) passed = false;
  }

  return { passed, results };
}

/**
 * Run Lighthouse audit and check scores
 */
async function runLighthouse() {
  console.log('\n' + colorize('🔍 Lighthouse Audit', 'blue') + '\n');

  try {
    // Check if we're in web mode
    const port = process.env.LIGHTHOUSE_PORT || '3000';
    const url = `http://localhost:${port}`;

    console.log(`  Auditing ${url}...`);

    // Dynamic import for lighthouse
    const lighthouse = await import('lighthouse');
    const chromeLauncher = await import('chrome-launcher');

    let chrome;
    try {
      chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--disable-gpu'] });
    } catch (error) {
      console.log(colorize('  ✗ Chrome not available. Lighthouse check skipped.', 'yellow'));
      console.log('  Hint: Install Chrome or use Lighthouse CI in GitHub Actions.');
      return null;
    }

    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port
    };

    const runnerResult = await lighthouse.default(url, options);
    await chrome.kill();

    const report = runnerResult.report;

    // Check category scores against budgets
    const categories = budgetConfig.budgets.lighthouse.categories;
    const results = [];
    let passed = true;

    for (const [category, budget] of Object.entries(categories)) {
      const score = report.categories[category]?.score * 100 || 0;
      const color = getColorScore(score, budget.budget, budget.warning);
      const status = score >= budget.budget ? '✓' : '✗';

      console.log(`  ${status} ${category}: ${colorize(score.toFixed(0), color)} / ${budget.budget}`);
      results.push({
        metric: category,
        actual: score,
        budget: budget.budget,
        warning: budget.warning,
        passed: score >= budget.budget
      });

      if (score < budget.budget) passed = false;
    }

    // Check key metrics
    const audits = budgetConfig.budgets.performance;
    console.log('\n  Key Metrics:');

    for (const [metric, budget] of Object.entries(audits)) {
      const lhMetric = report.audits[metric];
      if (!lhMetric || lhMetric.score === null) continue;

      const actual = lhMetric.numericValue;
      const color = getColor(actual, budget.budget, budget.warning);
      const status = actual <= budget.budget ? '✓' : '✗';

      console.log(`    ${status} ${metric}: ${colorize(formatDuration(actual), color)} / ${formatDuration(budget.budget)}`);
      results.push({
        metric: metric,
        actual: actual,
        budget: budget.budget,
        warning: budget.warning,
        passed: actual <= budget.budget
      });

      if (actual > budget.budget) passed = false;
    }

    return { passed, results, report };
  } catch (error) {
    console.log(colorize(`  ✗ Lighthouse error: ${error.message}`, 'red'));
    return null;
  }
}

/**
 * Compare current results against baseline
 */
function compareAgainstBaseline(currentResults, baselinePath) {
  console.log('\n' + colorize('📊 Regression Detection', 'blue') + '\n');

  if (!existsSync(baselinePath)) {
    console.log(colorize('  ⚠ No baseline found. Skipping comparison.', 'yellow'));
    return true;
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  const regressions = [];

  for (const current of currentResults) {
    const baselineResult = baseline.results?.find(r => r.metric === current.metric);
    if (!baselineResult) continue;

    // For performance metrics, higher = worse
    // For scores, lower = worse
    const isReversed = current.metric.toLowerCase().includes('score') ||
                      current.metric === 'accessibility' ||
                      current.metric === 'best-practices' ||
                      current.metric === 'seo' ||
                      current.metric === 'performance';

    const regressionThreshold = 0.05; // 5% regression threshold
    let hasRegression = false;

    if (isReversed) {
      // Score: check for decrease
      const decrease = baselineResult.actual - current.actual;
      const percentDecrease = (decrease / baselineResult.actual) * 100;
      if (percentDecrease > regressionThreshold * 100) {
        hasRegression = true;
        regressions.push({
          metric: current.metric,
          previous: baselineResult.actual,
          current: current.actual,
          change: -percentDecrease
        });
      }
    } else {
      // Time/size: check for increase
      const increase = current.actual - baselineResult.actual;
      const percentIncrease = (increase / baselineResult.actual) * 100;
      if (percentIncrease > regressionThreshold * 100) {
        hasRegression = true;
        regressions.push({
          metric: current.metric,
          previous: baselineResult.actual,
          current: current.actual,
          change: percentIncrease
        });
      }
    }
  }

  if (regressions.length > 0) {
    console.log(colorize('  ⚠ Performance Regressions Detected:', 'yellow'));
    for (const reg of regressions) {
      const sign = reg.change >= 0 ? '+' : '';
      console.log(`    • ${reg.metric}: ${sign}${reg.change.toFixed(1)}% (${formatValue(reg.previous, reg.metric)} → ${formatValue(reg.current, reg.metric)})`);
    }
    return false;
  }

  console.log(colorize('  ✓ No regressions detected', 'green'));
  return true;
}

function formatValue(value, metric) {
  if (metric.toLowerCase().includes('score')) {
    return value.toFixed(0);
  }
  if (metric.toLowerCase().includes('size') || metric.toLowerCase().includes('bytes')) {
    return formatBytes(value);
  }
  return formatDuration(value);
}

/**
 * Save results as baseline
 */
function saveBaseline(results, outputPath) {
  const baseline = {
    timestamp: new Date().toISOString(),
    version: budgetConfig.version,
    results
  };

  // Ensure directory exists
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.dirname(outputPath);
  if (!existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2));
  console.log(`\n${colorize('💾 Baseline saved to:', 'blue')} ${outputPath}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const runLighthouse = args.includes('--lighthouse');
  const saveBaseline = args.includes('--save-baseline');
  const compareBaseline = args.find(a => a === '--compare') || (saveBaseline ? null : '--compare');
  const baselinePath = compareBaseline ? args[args.indexOf(compareBaseline) + 1] || join(ROOT, '.tmp', 'performance-baseline.json') : null;

  // Check bundle sizes
  const bundleResult = await checkBundleSizes();

  let allResults = [];
  let allPassed = bundleResult ? bundleResult.passed : true;

  if (bundleResult) {
    allResults.push(...bundleResult.results);
  }

  // Run Lighthouse if requested
  let lighthouseResult = null;
  if (runLighthouse) {
    lighthouseResult = await runLighthouse();
    if (lighthouseResult) {
      allResults.push(...lighthouseResult.results);
      allPassed = allPassed && lighthouseResult.passed;
    }
  }

  // Compare against baseline
  if (baselinePath && compareBaseline !== null) {
    const noRegression = compareAgainstBaseline(allResults, baselinePath);
    allPassed = allPassed && noRegression;
  }

  // Save baseline if requested
  if (saveBaseline) {
    const outputPath = baselinePath || join(ROOT, '.tmp', 'performance-baseline.json');
    await saveBaseline(allResults, outputPath);
  }

  // Summary
  console.log('\n' + colorize('─'.repeat(50), 'gray'));
  if (allPassed) {
    console.log(colorize('✓ All performance budgets passed!', 'green'));
    process.exit(0);
  } else {
    console.log(colorize('✗ Performance budgets failed. Please review.', 'red'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
