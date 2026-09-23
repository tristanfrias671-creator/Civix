# CIVIX Startup Script
# Run: .\start.ps1

Write-Host "Starting CIVIX..." -ForegroundColor Cyan

# Start backend
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\server'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\client'; npm start" -WindowStyle Normal

Write-Host "Waiting for React to compile (about 30-60 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 45
Start-Process "http://localhost:3000/login"

Write-Host "Backend: http://localhost:5000" -ForegroundColor Green
Write-Host "Login:   http://localhost:3000/login" -ForegroundColor Green
Write-Host ""
Write-Host "Demo Accounts:" -ForegroundColor Yellow
Write-Host "  Admin:   admin@civix.gov / admin123"
Write-Host "  Citizen: citizen@test.com / citizen123"
