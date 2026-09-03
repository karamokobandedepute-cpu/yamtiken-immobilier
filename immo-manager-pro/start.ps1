# ============================================================
# IMMO MANAGER PRO - Script de demarrage complet YAMTIKEN
# Double-clic ou : powershell -ExecutionPolicy Bypass -File start.ps1
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   IMMO MANAGER PRO - YAMTIKEN 2026     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 1. Verification et configuration du PATH pour Node.js & npm
$nodeDir = "C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if (Test-Path $nodeDir) {
    if ($env:Path -notlike "*$nodeDir*") {
        $env:Path = "$nodeDir;$env:Path"
    }
}
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";$nodeDir"

# 2. Arret force de tous les processus precedents
Write-Host "Nettoyage et arret force des anciens serveurs..." -ForegroundColor Yellow

# Tuer les processus ecoutant sur les ports 5000 et 5173
@(5000, 5173) | ForEach-Object {
    $port = $_
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -and $conn.OwningProcess -ne 0) {
            Write-Host "  -> Fermeture du processus PID $($conn.OwningProcess) sur le port $port" -ForegroundColor Yellow
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

# Tuer tous les processus Node et Electron existants
Get-Process -Name node, electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  [OK] Processus precedents arretes et ports 5000/5173 liberes" -ForegroundColor Cyan

# Dossiers
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }
$server = Join-Path $root "server"
$client = Join-Path $root "client"

# 3. Demarrage du Backend
Write-Host ""
Write-Host "Demarrage du Backend API (port 5000)..." -ForegroundColor Green
$backendCmd = "set PATH=$nodeDir;%PATH% && cd /d `"$server`" && node server.js"
Start-Process cmd -ArgumentList "/k", "title YAMTIKEN Backend (Port 5000) && $backendCmd" -WindowStyle Normal

# Attente de la disponibilite du port 5000
$backendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $backendConn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
    if ($backendConn) {
        $backendReady = $true
        break
    }
}
if ($backendReady) {
    Write-Host "  [OK] Backend connecte sur http://localhost:5000" -ForegroundColor Cyan
} else {
    Write-Host "  [ATTENTE] Le backend demarre..." -ForegroundColor Yellow
}

# 4. Demarrage du Frontend
Write-Host ""
Write-Host "Demarrage du Frontend Web (port 5173)..." -ForegroundColor Green
$frontendCmd = "set PATH=$nodeDir;%PATH% && cd /d `"$client`" && npm run dev"
Start-Process cmd -ArgumentList "/k", "title YAMTIKEN Frontend (Port 5173) && $frontendCmd" -WindowStyle Normal

# Attente de la disponibilite du port 5173
$frontendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $frontendConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    if ($frontendConn) {
        $frontendReady = $true
        break
    }
}
if ($frontendReady) {
    Write-Host "  [OK] Frontend pret sur http://localhost:5173" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   APPLICATION YAMTIKEN PRETE !        " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend  : http://localhost:5000" -ForegroundColor Cyan
Write-Host "  Health   : http://localhost:5000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Identifiants de connexion :" -ForegroundColor White
Write-Host "  Email    : munokolive@gmail.com" -ForegroundColor Yellow
Write-Host "  Mdp      : 77916407@@Mu" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Ouverture automatique du navigateur..." -ForegroundColor Green

Start-Process "http://localhost:5173"

