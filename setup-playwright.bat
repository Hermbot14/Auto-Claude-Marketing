@echo off
REM Playwright Setup Script for Windows
REM This script installs Playwright browsers and verifies the setup

echo ========================================
echo Playwright Browser Testing Setup
echo ========================================
echo.

cd apps\frontend

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Installing Chromium browser...
call npx playwright install chromium
if errorlevel 1 (
    echo WARNING: Had trouble installing Chromium
    echo You may need to run this command as administrator
)

echo.
echo Step 3: Verifying setup...
call node e2e\verify-playwright-setup.mjs

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo Next steps:
echo   1. Run web UI tests: npm run test:e2e:web
echo   2. Run exploration: npm run test:web:explore
echo   3. View documentation: e2e\PLAYWRIGHT_SETUP.md
echo.

pause
