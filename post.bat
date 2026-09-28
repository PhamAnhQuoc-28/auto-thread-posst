@echo off
cd /d "%~dp0"

echo ======================================
echo Threads Auto Post
echo ======================================
echo 1. Morning product session
echo 2. Afternoon product session
echo 3. One-off pending post
echo.

choice /c 123 /n /m "Select (1/2/3): "
if errorlevel 3 goto oneoff
if errorlevel 2 goto afternoon
call npm run session -- morning
goto finished

:afternoon
call npm run session -- afternoon
goto finished

:oneoff
call npm run post

:finished
set "postExitCode=%errorlevel%"

echo.
echo ======================================
echo Process finished
echo ======================================

pause
exit /b %postExitCode%
