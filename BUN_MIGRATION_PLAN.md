# Bun Migration Plan

## Overview

This document outlines the complete migration from npm to Bun for the Auto Claude Marketing Hub project.

**Date:** 2026-02-05
**Approach:** Full Migration (replace npm with Bun for all operations)

## Migration Goals

1. Replace npm with Bun as the primary package manager
2. Update all scripts to use `bun` instead of `npm`
3. Update CI/CD pipelines to use Bun
4. Update all documentation to reference Bun commands
5. Remove all npm-specific files (package-lock.json)

## Pre-Migration Checklist

- [x] Bun is installed (v1.1.37 confirmed)
- [x] Backup current working state (git commit)
- [ ] Test Bun compatibility with Electron
- [ ] Test native module compilation (@lydell/node-pty)

## Migration Steps

### Phase 1: Lockfile Migration

**Status:** Pending
**Risk:** Low

1. Run `bun install` in root directory to generate `bun.lockb`
2. Verify all dependencies are installed correctly
3. Remove `package-lock.json` files
4. Commit changes

**Files affected:**
- `package-lock.json` (root)
- `apps/frontend/package-lock.json`
- `.design-system/package-lock.json`

### Phase 2: Package.json Scripts

**Status:** Pending
**Risk:** Low

Update all package.json scripts to use `bun` instead of `npm`:

**Root package.json:**
- `install:frontend`: `cd apps/frontend && bun install`
- `install:all`: `bun run install:backend && bun run install:frontend`
- All other scripts: `npm run` → `bun run`

**Frontend package.json:**
- All scripts remain the same (they use direct commands like `electron-vite dev`)
- Exception: `test:e2e*` scripts using `npx` → `bunx`

**Files affected:**
- `package.json` (root)
- `apps/frontend/package.json`
- `.design-system/package.json`

### Phase 3: Postinstall Scripts

**Status:** Pending
**Risk:** Medium

Update hardcoded `npx` references to `bunx`:

**apps/frontend/scripts/postinstall.cjs:**
```javascript
// Line 64: Change npx to bunx
- const npx = isWindows ? 'npx.cmd' : 'npx';
+ const bunx = isWindows ? 'bunx.exe' : 'bunx';
```

**Files affected:**
- `apps/frontend/scripts/postinstall.cjs`
- `apps/frontend/scripts/download-prebuilds.cjs` (if it uses npx)
- `apps/frontend/scripts/verify-python-bundling.cjs` (error messages)

### Phase 4: CI/CD Migration

**Status:** Pending
**Risk:** Medium

**.github/workflows/ci.yml:**
- Update test-frontend job to use Bun
- Replace `npm run` commands with `bun run`

**.github/actions/setup-node-frontend/action.yml:**
- Rename to `setup-bun-frontend`
- Use `oven-sh/setup-bun` action instead of `actions/setup-node`
- Update Bun cache configuration
- Update bun install commands

**Files affected:**
- `.github/workflows/ci.yml`
- `.github/actions/setup-node-frontend/action.yml`

### Phase 5: Documentation Updates

**Status:** Pending
**Risk:** Low

Update all documentation to reference Bun commands:

**README.md:**
- Replace all `npm` commands with `bun`
- Update installation instructions
- Update development commands

**CLAUDE.md:**
- Update all npm references to bun
- Update quick reference section

**Other documentation:**
- `guides/` directory files
- Any markdown files with npm commands

**Files affected:**
- `README.md`
- `CLAUDE.md`
- `guides/*.md`
- Any other documentation files

### Phase 6: Cleanup

**Status:** Pending
**Risk:** Low

1. Delete all `package-lock.json` files
2. Verify `.npmrc` doesn't exist (or remove if present)
3. Update `.gitignore` to ignore `package-lock.json` (if not already)

**Files to delete:**
- `package-lock.json` (root)
- `apps/frontend/package-lock.json`
- `.design-system/package-lock.json`
- Any other `package-lock.json` files in the project

### Phase 7: Testing

**Status:** Pending
**Risk:** High

**Development workflow:**
```bash
bun install                    # Install dependencies
bun run dev:web               # Start web UI
bun run dev                   # Start Electron dev
bun run test                  # Run tests
bun run lint                  # Run linter
bun run typecheck             # TypeScript check
```

**Build workflow:**
```bash
bun run build                 # Build application
bun run package               # Package for current platform
bun run package:win           # Package for Windows
bun run package:mac           # Package for macOS
bun run package:linux         # Package for Linux
```

**Tests to verify:**
1. [ ] Dependencies install correctly
2. [ ] Web UI starts and runs (`bun run dev:web`)
3. [ ] Electron dev mode works (`bun run dev`)
4. [ ] TypeScript compilation works
5. [ ] Tests run successfully
6. [ ] Build succeeds
7. [ ] Packaging produces working binaries

## Known Issues & Risks

### electron-builder Compatibility

**Issue:** Bun has known issues with electron-builder
- GitHub Issue #9895: "Does not work with electron-builder"
- GitHub Issue #13422: Installation errors

**Mitigation:**
- Test packaging early in migration
- May need to wait for Bun fixes or use workarounds
- Consider keeping npm for packaging only if issues persist

### Native Module Compilation

**Issue:** @lydell/node-pty requires native compilation
- Postinstall script uses `npx electron-rebuild`
- Bun's native module support is still maturing

**Mitigation:**
- Update postinstall.cjs to use `bunx`
- Test native module rebuild thoroughly
- May need to adjust rebuild process

### CI/CD Changes

**Issue:** GitHub Actions needs Bun setup
- Currently uses `actions/setup-node@v4`
- Need to switch to `oven-sh/setup-bun`

**Mitigation:**
- Use official Bun setup action
- Update cache configuration
- Test in feature branch before merging

## Rollback Plan

If migration fails:

1. Revert to previous commit (before migration)
2. Restore `package-lock.json` files from git
3. Document what failed and why
4. Decide whether to retry with hybrid approach or wait for Bun fixes

## Post-Migration Checklist

- [ ] All tests pass
- [ ] Development workflow works
- [ ] Electron build succeeds
- [ ] Packaging produces working binaries
- [ ] CI/CD passes on all platforms
- [ ] Documentation updated
- [ ] Team notified of new commands

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Bun + Electron](https://bun.sh/docs/runtime/electron)
- [Bun + Vite](https://bun.sh/guides/ecosystem/vite)
- [electron-builder Bun Issues](https://github.com/oven-sh/bun/issues?q=electron-builder)

## Sign-off

**Migration Author:** Claude AI
**Review Status:** Pending
**Date:** 2026-02-05
