@echo off
cd /d "%~dp0"
echo Building Threads Studio...
call npm run build:ui
if errorlevel 1 (
  echo Could not build the editor.
  pause
  exit /b 1
)
echo Starting Threads Studio. Keep this window open while editing.
call npm run editor
set "result=%errorlevel%"
pause
exit /b %result%
