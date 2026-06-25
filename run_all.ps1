# run_all.ps1 - Startup script for the entire Vocal Remover App
$winPath = $PSScriptRoot
$wslPath = $winPath.Replace("C:", "/mnt/c").Replace("c:", "/mnt/c").Replace("\", "/")

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting Vocal Remover App Stack..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Start PostgreSQL and Redis inside WSL
Write-Host "[1/4] Starting Databases in WSL..." -ForegroundColor Green
wsl sudo service postgresql start
wsl sudo service redis-server stop
wsl redis-server --bind 0.0.0.0 --protected-mode no --daemonize yes

# 2. Start Backend API Server
Write-Host "[2/4] Starting Backend API Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "wsl bash -c 'cd $wslPath/backend && npm run dev'"

# 3. Start Queue Worker
Write-Host "[3/4] Start Queue Worker..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "wsl bash -c 'cd $wslPath/backend && npm run worker'"

# 4. Start Next.js Frontend
Write-Host "[4/4] Starting Next.js Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$winPath\frontend'; npm run dev"

Write-Host "`nAll components started! You can access the web UI at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Server API is running at: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Keep the spawned terminal windows open. Close them to stop the servers." -ForegroundColor Gray
