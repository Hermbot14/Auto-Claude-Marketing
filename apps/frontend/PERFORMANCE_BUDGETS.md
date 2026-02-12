# Performance Budgets & Monitoring

This document describes the performance budget system for Auto Claude Marketing Hub, including budget definitions, monitoring tools, and regression prevention.

## Overview

The performance budget system consists of:

1. **Budget Configuration** - `performance-budget.config.json` defines thresholds for all metrics
2. **CI Enforcement** - `.github/workflows/performance.yml` validates budgets on every PR
3. **Dashboard** - `PerformanceDashboard.tsx` displays real-time metrics in the UI
4. **Regression Alerts** - `regression-alerts.config.json` configures automated alerts

## Budget Definitions

### Performance Metrics

| Metric | Budget | Warning | Rationale |
|---------|---------|----------|------------|
| Time to Interactive (TTI) | 2,500ms | 2,000ms | Google's "Good" TTI threshold. Users perceive delays > 3s as slow. |
| First Contentful Paint (FCP) | 1,500ms | 1,200ms | Google's "Good" FCP threshold. Critical for perceived performance. |
| Largest Contentful Paint (LCP) | 2,500ms | 2,000ms | Core Web Vitals "Good" LCP threshold. |
| Cumulative Layout Shift (CLS) | 0.1 | 0.05 | Core Web Vitals "Good" CLS threshold. |
| First Input Delay (FID) | 100ms | 50ms | Ensures app feels responsive to user interactions. |
| Time to First Byte (TTFB) | 600ms | 400ms | Allows for local Electron app IPC overhead. |

### Resource Sizes

| Resource | Budget | Warning | Rationale |
|----------|---------|----------|------------|
| Main JS Bundle | 1.5MB | 1.2MB | Ensures reasonable load times. Consider code splitting for larger bundles. |
| Renderer JS Bundle | 1.0MB | 800KB | Keeps Electron main process lightweight. |
| Preload Script | 500KB | 400KB | Preload scripts should be minimal. |
| CSS Total | 300KB | 200KB | With Tailwind CSS and component styles. |
| Images Total | 500KB | 300KB | Use WebP with compression. |
| Fonts Total | 200KB | 150KB | Consider system fonts fallbacks. |

### Memory Usage

| Metric | Budget | Warning | Rationale |
|--------|---------|----------|------------|
| Heap Size | 150MB | 120MB | Prevents memory leaks from impacting UX. |
| JS Heap Size Limit | 200MB | 150MB | Based on typical Electron app constraints. |

### Network Metrics

| Metric | Budget | Warning | Rationale |
|--------|---------|----------|------------|
| Requests Count | 50 | 30 | Reduces HTTP overhead and improves load time. |
| Total Transfer Size | 3MB | 2MB | For initial page load including all resources. |

### Lighthouse Categories

| Category | Budget | Warning |
|----------|---------|----------|
| Performance | 90 | 85 |
| Accessibility | 95 | 90 |
| Best Practices | 90 | 85 |
| SEO | 85 | 80 |

## Usage

### Local Development

#### Check bundle sizes:

```bash
cd apps/frontend
bun run build
bun run scripts/performance-budget.js
```

#### Run Lighthouse audit:

```bash
# Start the web dev server first
bun run dev:web

# In another terminal, run Lighthouse
LIGHTHOUSE_PORT=3000 bun run scripts/performance-budget.js --lighthouse
```

#### Save performance baseline:

```bash
bun run scripts/performance-budget.js --save-baseline
```

#### Compare against baseline:

```bash
bun run scripts/performance-budget.js --compare .tmp/performance-baseline.json
```

### CI/CD Integration

The performance workflow runs automatically on:

- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual workflow dispatch

#### Workflow Jobs:

1. **Build** - Compiles the frontend
2. **Bundle Size** - Checks bundle sizes against budgets
3. **Lighthouse** - Runs Lighthouse audit and checks scores
4. **Regression Check** - Compares against baseline and detects regressions
5. **Update Baseline** - Saves new baseline on merge to main (manual trigger)

#### Manual Baseline Update:

```bash
# From GitHub Actions UI
# Click "Actions" -> "Performance" -> "Run workflow"
# Check "Update baseline" and run
```

### Performance Dashboard

Access the performance dashboard from Settings → Performance section:

1. Open Settings
2. Navigate to the new "Performance" section
3. View real-time metrics and budget status

Features:
- **Summary Cards** - Overview of passed/warning/failed metrics
- **Category Filters** - View by performance, resources, memory, or network
- **Metrics Table** - Detailed view of all metrics with progress bars
- **Rationale Section** - Explanation of why each budget exists

## Regression Alerts

### Alert Channels

Configure alert channels in `regression-alerts.config.json`:

#### GitHub (enabled by default):
- Posts comments on PRs with regressions
- Sets commit status check
- Blocks merge for critical regressions

#### Slack (optional):
- Posts to configured channel
- Requires `SLACK_WEBHOOK_URL` secret

#### Email (optional):
- Sends emails to recipients
- Requires SMTP configuration

### Alert Rules

#### Critical Regressions:
- Any metric exceeds regression threshold (10%)
- Or critical thresholds breached (TTI > 3s, Bundle > 2MB)
- Actions: Block PR, notify urgently

#### Multiple Warnings:
- 3+ metrics in warning state
- Actions: Add label, post comment

#### Memory Leak:
- Heap size increasing over 3 measurements
- Actions: Notify urgently, create GitHub issue

#### Bundle Size Increase:
- Bundle size increases by 15%+
- Actions: Require review before merge

### Exemptions

Alerts are exempted for:
- Branches: `develop`, `feature/*`
- Authors: `dependabot[bot]`, `renovate[bot]`
- Files: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `__tests__/**`
- Commit messages: `*wip*`, `*draft*`, `work in progress*`

## Configuration Files

### `performance-budget.config.json`

Main budget configuration file. Contains:
- Budget thresholds with warnings
- Metric descriptions and rationales
- Platform-specific exemptions (Electron vs Web)
- Lighthouse category budgets

### `performance-budget.schema.json`

JSON schema for budget configuration. Validates:
- Required fields
- Value ranges
- Data types

### `regression-alerts.config.json`

Alert configuration. Contains:
- Notification channel settings
- Thresholds and rules
- Exemptions
- Baseline storage configuration
- Notification templates

### `regression-alerts.schema.json`

JSON schema for alert configuration.

## Best Practices

### Preventing Regressions

1. **Check budgets before committing**:
   ```bash
   bun run scripts/performance-budget.js
   ```

2. **Profile bundle size changes**:
   ```bash
   # Build and analyze
   bun run build
   npx vite-bundle-visualizer out/renderer
   ```

3. **Use code splitting**:
   ```typescript
   // Split heavy components
   const HeavyComponent = lazy(() => import('./HeavyComponent'))
   ```

4. **Optimize imports**:
   ```typescript
   // Use tree-shakeable imports
   import { Button } from '@/components/ui/button'
   // Not: import * as UI from '@/components/ui'
   ```

5. **Compress assets**:
   ```bash
   # Use WebP with compression
   convert image.png -quality 85 image.webp
   ```

### Responding to Alerts

1. **Review the PR comments** - Details about which metrics failed
2. **Check the metrics table** - Identify the root cause
3. **Optimize** - Apply best practices to fix the issue
4. **Re-run CI** - Push changes to trigger new performance check
5. **Update baseline** - After merge, update baseline if improved

### Updating Budgets

To change a budget threshold:

1. Edit `apps/frontend/performance-budget.config.json`
2. Update the `budget` and/or `warning` values
3. Update `rationale` if the reason changed
4. Commit and document the change

Example:
```json
{
  "timeToInteractive": {
    "budget": 3000,
    "warning": 2500,
    "unit": "ms",
    "description": "Time to Interactive (TTI)",
    "rationale": "Increased to 3s to account for new analytics integration"
  }
}
```

## Troubleshooting

### Budget checks fail locally

**Issue**: `Performance budgets failed` message

**Solutions**:
- Ensure you've built the project: `bun run build`
- Check build output exists in `out/renderer/`
- Verify `performance-budget.config.json` is valid JSON

### Lighthouse fails in CI

**Issue**: Lighthouse job fails with error

**Solutions**:
- Check build artifacts uploaded correctly
- Verify HTTP server started on port 3000
- Review Lighthouse logs in CI artifacts

### False positive regressions

**Issue**: Regression detected but performance seems fine

**Solutions**:
- Check if baseline is outdated
- Manually update baseline: `bun run performance-budget.js --save-baseline`
- Add exemption for the PR if it's a known case

### Missing metrics in dashboard

**Issue**: Some metrics show 0 or "N/A"

**Solutions**:
- Run app in production mode (dev mode has different performance)
- Ensure PerformanceObserver APIs are available
- Check browser console for errors

## References

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [Core Web Vitals](https://web.dev/articles/vitals/)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance/)
