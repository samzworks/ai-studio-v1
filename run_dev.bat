@echo off
setlocal
title Alfia Dev Launcher

echo ==========================================
echo   Starting Alfia Dev Environment
echo ==========================================

:: Load environment variables from .env
:: Env vars are loaded by the scripts themselves
echo Starting services...

:: Start Backend with local environment variables passed correctly
echo Starting Backend Server...
start "Alfia Server" cmd /k "npm run dev:server"

:: Start Frontend
echo Starting Frontend Client...
start "Alfia Client" cmd /k "npm run dev:client"

echo.
echo Waiting 8 seconds for services to initialize...
timeout /t 8 >nul

echo Opening Browser...
start http://localhost:5173

echo.
echo ==========================================
echo   Alfia is running!
echo ==========================================
pause
