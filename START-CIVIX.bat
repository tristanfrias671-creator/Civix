@echo off
title CIVIX Launcher
color 0E
echo ============================================
echo  CIVIX - Starting all services...
echo ============================================
echo.
echo [1/2] Starting Backend (Port 5000)...
start "CIVIX Backend" cmd /k "cd /d "%~dp0server" && :loop & node index.js & echo Restarting... & timeout /t 3 /nobreak >nul & goto loop"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend (Port 3000)...
start "CIVIX Frontend" cmd /k "cd /d "%~dp0client" && npm start"

echo.
echo ============================================
echo  Both services are starting!
echo  Open: http://localhost:3000
echo  Keep both windows open during demo.
echo ============================================
echo.
pause
