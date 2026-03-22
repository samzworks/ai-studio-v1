@echo off
setlocal
title Alfia Production Launcher

echo ==========================================
echo   Building and Starting Alfia (Production)
echo ==========================================

:: Load environment variables from .env
if exist .env (
    echo Loading .env...
    for /f "usebackq tokens=*" %%a in (".env") do set %%a
)

echo.
echo Building application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Starting Production Server...
echo Open http://localhost:5000 in your browser.
call npm run start

pause
