@echo off
title CIVIX Backend (Port 5000)
color 0A
echo ============================================
echo  CIVIX Backend Server - Port 5000
echo ============================================
echo.
echo Starting backend... Keep this window open!
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0server"
:restart
node index.js
echo.
echo !! Backend stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto restart
