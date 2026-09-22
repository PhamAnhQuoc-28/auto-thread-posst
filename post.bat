@echo off
cd /d "%~dp0"

echo ======================================
echo Threads Auto Post
echo ======================================
echo.

call npm run post

echo.
echo ======================================
echo Process finished
echo ======================================

pause
