@echo off
setlocal
cd /d "%~dp0"
title AgriNexus - Local Launcher

echo ==================================================
echo   AgriNexus - Post-Harvest Decision Intelligence
echo ==================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed on this PC.
  echo Please install Node.js v20+ from: https://nodejs.org/
  echo After installing Node.js, double-click this file again.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example.
    echo [TIP]  Open .env in Notepad and add your GEMINI_API_KEY for live AI Assist.
  )
)

if not exist "node_modules" (
  echo [INFO] First-time setup: installing dependencies ^(this may take 1-2 minutes^)...
  call npm install
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo [INFO] Starting AgriNexus server on http://localhost:3000 ...
echo [INFO] Your browser will open automatically in a few seconds.
echo [INFO] Keep this window open while using AgriNexus ^(press Ctrl+C to stop^).
echo.

start "" /B cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
call npm run dev

pause
