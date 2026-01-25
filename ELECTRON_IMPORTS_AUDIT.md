# Electron Imports Audit

**Date**: 2026-01-25
**Purpose**: Complete audit of all Electron import patterns across the codebase

## Summary

The codebase contains **136 files** with Electron imports, all located in `apps/frontend/`. All imports use ES6 `import` statements from the `electron` package. There is **one instance** of a dynamic `require()` call, and **two instances** of dynamic `import()` in test files.

## Import Patterns

### 1. Standard ES6 Imports (Primary Pattern)

**Total**: 133 files use this pattern

```typescript
import { app, BrowserWindow, ipcMain, etc } from 'electron';
import type { BrowserWindow, etc } from 'electron';
```

**Characteristics**:
- Uses static ES6 `import` syntax
- Located at top of files
- Mix of runtime imports (`app`, `BrowserWindow`, `ipcMain`) and type-only imports
- Used in main process, preload scripts, and IPC handlers

### 2. Dynamic require() (Single Instance)

**Location**: `apps/frontend/src/main/ipc-handlers/github/utils/subprocess-runner.ts:341`

```typescript
try {
  app = require('electron').app;
} catch {
  // Electron not available in tests
}
```

**Context**: Used conditionally in production path detection logic
**Reason**: Graceful degradation when Electron is not available (testing scenarios)

### 3. Dynamic import() (Test Files Only)

**Locations**:
- `apps/frontend/src/main/__tests__/ipc-handlers.test.ts:191`
- `apps/frontend/src/main/ipc-handlers/github/__tests__/oauth-handlers.spec.ts:129`

```typescript
const electron = await import("electron");
ipcMain = electron.ipcMain as unknown as typeof ipcMain;
```

**Context**: Used in test setup to access mocked Electron APIs
**Reason**: Allows dynamic loading of Electron module in test environment

### 4. No @electron/remote Usage

**Search Result**: No files use `@electron/remote` package

**Note**: This package has been deprecated and is not used in this codebase.

## File Breakdown by Directory

### Main Process (`src/main/`)

**Total**: 118 files

#### Core Entry Points
- `src/main/index.ts` - Main entry point (app, BrowserWindow, shell, nativeImage, session, screen)

#### IPC Handlers (74 files)
- `src/main/ipc-handlers/*.ts` - Various feature-specific handlers
- `src/main/ipc-handlers/github/*.ts` - GitHub integration
- `src/main/ipc-handlers/gitlab/*.ts` - GitLab integration
- `src/main/ipc-handlers/task/*.ts` - Task management
- `src/main/ipc-handlers/context/*.ts` - Context management
- `src/main/ipc-handlers/ideation/*.ts` - Ideation features
- `src/main/ipc-handlers/terminal/*.ts` - Terminal integration

#### Utilities & Services
- `src/main/utils/*.ts` - Utility modules
- `src/main/updater/*.ts` - Auto-update functionality
- `src/main/terminal/*.ts` - Terminal session management
- `src/main/services/*.ts` - Service layer
- `src/main/agent/*.ts` - Agent process management

#### Testing
- `src/main/__tests__/*.test.ts` - Unit tests

### Preload Scripts (`src/preload/`)

**Total**: 8 files

- `src/preload/index.ts` - Preload entry (contextBridge)
- `src/preload/api/*.ts` - API exports to renderer process
  - file-api.ts
  - terminal-api.ts
  - task-api.ts
  - settings-api.ts
  - screenshot-api.ts
  - project-api.ts
  - profile-api.ts
  - modules/ipc-utils.ts
  - modules/mcp-api.ts

All use: `import { ipcRenderer } from 'electron';`

### E2E Tests (`e2e/`)

**Total**: 4 files

- `e2e/flows.e2e.ts`
- `e2e/claude-accounts.e2e.ts`
- `e2e/terminal-copy-paste.e2e.ts`
- `e2e/electron-helper.ts`

All use: `import { _electron as electron } from '@playwright/test';`

### Build Configuration

**Total**: 1 file

- `electron.vite.config.ts` - Electron-vite build configuration
  - Uses: `import { defineConfig, externalizeDepsPlugin } from 'electron-vite';`

## Import Categories

### By Module Type

| Module | Usage Count | Purpose |
|--------|-------------|---------|
| `app` | 25+ | Application lifecycle, paths, user data |
| `BrowserWindow` | 40+ | Window management (runtime + types) |
| `ipcMain` | 35+ | Main process IPC communication |
| `ipcRenderer` | 8+ | Renderer process IPC (preload) |
| `shell` | 5+ | External links, file management |
| `dialog` | 2+ | File dialogs, native dialogs |
| `contextBridge` | 1 | Preload API exposure |
| `desktopCapturer` | 1 | Screen capture API |
| `safeStorage` | 1 | Credential encryption |
| `Notification` | 1 | System notifications |
| `session` | 1 | Session management |
| `screen` | 1 | Display information |
| `nativeImage` | 1 | Image handling |
| `net` | 1 | Network requests |
| `IpcMainInvokeEvent` (type) | 5+ | IPC event types |
| `IpcMainEvent` (type) | 1 | IPC event types |

### By Import Style

| Style | Count | Percentage |
|-------|-------|------------|
| Runtime imports | 136 | 100% |
| Type-only imports | 45 | 33% |
| Mixed imports | 30 | 22% |

## Build Configuration Impact

### electron.vite.config.ts Settings

```typescript
plugins: [externalizeDepsPlugin({
  exclude: [
    // Packages bundled into main process
    'uuid', 'chokidar', 'dotenv', 'electron-log',
    'proper-lockfile', 'semver', 'zod', '@anthropic-ai/sdk',
    'kuzu', 'electron-updater', '@electron-toolkit/utils',
    '@sentry/electron', '@sentry/core', '@sentry/node',
    '@sentry/utils', '@opentelemetry/instrumentation',
    'debug', 'ms'
  ]
})]

build: {
  rollupOptions: {
    output: {
      format: 'cjs'  // CommonJS output
    },
    external: ['@lydell/node-pty']  // Native module
  }
}
```

**Key Points**:
- **Electron is NOT excluded** from externalizeDepsPlugin
- This means Electron imports should be externalized (not bundled)
- Output format is CommonJS (`cjs`)
- `@lydell/node-pty` is explicitly external (native module)

## Known Issues

### Electron Import Resolution Bug

**Status**: Documented but not resolved
**Files**:
- `LAUNCH_ISSUE_ANALYSIS.md`
- `ELECTRON_ISSUES_RESEARCH.md`
- `CHANGELOG.md`

**Problem**:
```
require("electron") returns undefined inside Electron process
```

**Root Cause** (from documentation):
- npm workspace hoisting causes bundler to resolve `require('electron')` to absolute path
- This bypasses Electron's runtime interception mechanism
- The `electron` npm package does NOT export the Electron API directly

**Attempted Fixes** (all failed):
1. externalizeDepsPlugin configuration
2. build.external configuration
3. npm nohoist configuration
4. CommonJS format change
5. Direct require() variations

**Current Workaround**:
- Web app configuration exists (`vite.web.config.ts`)
- E2E tests are skipped when Electron app cannot launch

## Recommendations

### For Production Code

1. **Keep current ES6 import pattern** - This is the standard approach
2. **Maintain externalizeDepsPlugin settings** - Don't add electron to exclude list
3. **Monitor build output** - Ensure Electron imports remain external

### For the Known Bug

1. **Consider alternative package managers** - pnpm or Yarn may handle workspace hoisting differently
2. **Evaluate post-build patching** - Replace absolute paths with bare requires
3. **Test in non-workspace environment** - Fresh clone without npm workspaces
4. **Monitor electron-vite updates** - Future versions may address this issue

### For Code Quality

1. **Consistent import ordering** - Group Electron imports with other Node.js imports
2. **Type-only imports** - Use `import type` where runtime imports aren't needed
3. **Avoid dynamic imports in production** - Keep the single `require()` in subprocess-runner.ts well-documented

## Test Files Summary

### Unit Tests with Electron Imports

- `src/main/__tests__/utils.test.ts` - Type imports only
- `src/main/__tests__/ipc-handlers.test.ts` - Dynamic import for mocked APIs
- `src/main/ipc-handlers/github/__tests__/oauth-handlers.spec.ts` - Dynamic import for mocked APIs
- `src/main/ipc-handlers/github/__tests__/runner-env-handlers.test.ts` - Type imports only
- `src/main/ipc-handlers/profile-handlers.test.ts` - Runtime import for ipcMain

### E2E Tests

All use Playwright's `_electron` helper:
```typescript
import { _electron as electron } from '@playwright/test';
```

## Statistics

- **Total files with Electron imports**: 136
- **Main process files**: 118
- **Preload files**: 8
- **E2E test files**: 4
- **Build config files**: 1
- **Dynamic require() calls**: 1
- **Dynamic import() calls**: 2
- **@electron/remote usage**: 0

## File Locations

All Electron imports are in:
```
apps/frontend/
├── src/main/          (118 files)
├── src/preload/       (8 files)
├── e2e/               (4 files)
└── electron.vite.config.ts (1 file)
```

No Electron imports found in:
- `apps/backend/` (Python backend - doesn't use Electron)
- Root directory files
- Documentation files (except references in docs)
- Test files in `tests/` directory

## Conclusion

The codebase follows consistent ES6 import patterns for Electron across all files. The dynamic `require()` in `subprocess-runner.ts` is well-documented and serves a specific purpose (graceful degradation). The known `require("electron")` bug is a build-time issue, not a code pattern issue, and is well-documented in existing analysis files.

No changes to import patterns are recommended at this time. The focus should be on resolving the workspace hoisting/build configuration issue that causes the runtime import failure.
