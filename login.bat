@echo off
cd /d "%~dp0"

echo ======================================
echo Threads Login
echo ======================================
echo.

call npm run login
set "loginExitCode=%errorlevel%"

pause
exit /b %loginExitCode%
