@echo off
cd /d "%~dp0"

echo ======================================
echo Threads Session
echo ======================================
echo 1. Morning
echo 2. Afternoon
echo.

choice /c 12 /n /m "Select a session (1/2): "
if errorlevel 2 (set "slot=afternoon") else (set "slot=morning")
echo Keep this window open until the session finishes.
call npm run session -- %slot%
set "result=%errorlevel%"

pause
exit /b %result%
