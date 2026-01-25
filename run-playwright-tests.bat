@echo off
REM Run Playwright Web UI Tests
REM This script starts the web server and runs all Playwright tests

echo ========================================
echo Running Playwright Web UI Tests
echo ========================================
echo.

cd apps\frontend

echo Starting tests...
echo.

call npx playwright test --config=e2e\playwright.web.config.ts %*

echo.
echo ========================================
echo Tests complete!
echo ========================================
echo.
echo To view the report, run: npx playwright show-report
echo.

pause
