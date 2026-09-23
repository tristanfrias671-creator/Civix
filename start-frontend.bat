@echo off
title CIVIX Frontend (Port 3000)
color 0B
echo ============================================
echo  CIVIX Frontend - http://localhost:3000
echo ============================================
echo.
echo Starting frontend... Keep this window open!
echo.
cd /d "%~dp0client"
npm start
pause
