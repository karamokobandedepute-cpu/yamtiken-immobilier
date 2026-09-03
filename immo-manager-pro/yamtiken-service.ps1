# YAMTIKEN SERVICE - PowerShell Watchdog
# Ce script peut être configuré comme service Windows avec NSSM
# ou exécuté au démarrage de Windows

param(
    [string]$Action = "start",  # start, stop, status, install
    [switch]$AutoRestart = $true
)

$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_PORT = 5000
$FRONTEND_PORT = 5173
$CHECK_INTERVAL = 10  # secondes
$LOG_DIR = Join-Path $PROJECT_ROOT "logs"

# Créer le dossier logs
if (!(Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine
    Add-Content -Path (Join-Path $LOG_DIR "watchdog.log") -Value $logLine
}

function Test-PortOpen {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return $connection.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Get-ProcessByPort {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

function Start-YamtikenBackend {
    Write-Log "Démarrage du backend..."
    
    $backendScript = @"
cd /d "$PROJECT_ROOT\server"
:LOOP
echo [%date% %time%] Démarrage backend...
node server.js >> "$LOG_DIR\backend.log" 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] Crash détecté, redémarrage dans 3s...
    timeout /t 3 /nobreak >nul
    goto LOOP
)
"@
    
    $batPath = Join-Path $LOG_DIR "backend-loop.bat"
    $backendScript | Out-File -FilePath $batPath -Encoding ASCII
    
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$batPath`"" -WindowStyle Minimized -PassThru
    
    # Attendre le démarrage
    $attempts = 0
    while (!(Test-PortOpen -Port $BACKEND_PORT) -and $attempts -lt 30) {
        Start-Sleep -Seconds 1
        $attempts++
    }
    
    if (Test-PortOpen -Port $BACKEND_PORT) {
        Write-Log "Backend démarré avec succès (PID: $($proc.Id))" "SUCCESS"
        return $proc
    } else {
        Write-Log "Échec du démarrage backend" "ERROR"
        return $null
    }
}

function Start-YamtikenFrontend {
    Write-Log "Démarrage du frontend..."
    
    $frontendScript = @"
cd /d "$PROJECT_ROOT\client"
npm run dev >> "$LOG_DIR\frontend.log" 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] Frontend crash, redémarrage dans 5s...
    timeout /t 5 /nobreak >nul
    cd /d "$PROJECT_ROOT\client"
    npm run dev >> "$LOG_DIR\frontend.log" 2>&1
)
"@
    
    $batPath = Join-Path $LOG_DIR "frontend-loop.bat"
    $frontendScript | Out-File -FilePath $batPath -Encoding ASCII
    
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$batPath`"" -WindowStyle Minimized -PassThru
    
    # Attendre le démarrage
    $attempts = 0
    while (!(Test-PortOpen -Port $FRONTEND_PORT) -and $attempts -lt 30) {
        Start-Sleep -Seconds 1
        $attempts++
    }
    
    if (Test-PortOpen -Port $FRONTEND_PORT) {
        Write-Log "Frontend démarré avec succès (PID: $($proc.Id))" "SUCCESS"
        return $proc
    } else {
        Write-Log "Échec du démarrage frontend" "ERROR"
        return $null
    }
}

function Stop-Yamtiken {
    Write-Log "Arrêt des services..."
    
    # Arrêter les processus sur les ports
    $backendProc = Get-ProcessByPort -Port $BACKEND_PORT
    $frontendProc = Get-ProcessByPort -Port $FRONTEND_PORT
    
    if ($backendProc) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
        Write-Log "Backend arrêté (PID: $($backendProc.Id))" "SUCCESS"
    }
    
    if ($frontendProc) {
        Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
        Write-Log "Frontend arrêté (PID: $($frontendProc.Id))" "SUCCESS"
    }
    
    # Arrêter les processus node restants
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
        $_.MainWindowTitle -match "YAMTIKEN" -or $_.Parent.Id -eq $PID 
    } | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Watch-Yamtiken {
    Write-Log "Démarrage de la surveillance..."
    Write-Log "Backend: http://localhost:$BACKEND_PORT"
    Write-Log "Frontend: http://localhost:$FRONTEND_PORT"
    Write-Log "Appuyez sur Ctrl+C pour arrêter"
    
    $backendProc = $null
    $frontendProc = $null
    
    # Démarrer les services
    if (!(Test-PortOpen -Port $BACKEND_PORT)) {
        $backendProc = Start-YamtikenBackend
    } else {
        Write-Log "Backend déjà en cours" "SUCCESS"
    }
    
    if (!(Test-PortOpen -Port $FRONTEND_PORT)) {
        $frontendProc = Start-YamtikenFrontend
    } else {
        Write-Log "Frontend déjà en cours" "SUCCESS"
    }
    
    # Boucle de surveillance
    try {
        while ($true) {
            Start-Sleep -Seconds $CHECK_INTERVAL
            
            # Vérifier backend
            if (!(Test-PortOpen -Port $BACKEND_PORT)) {
                Write-Log "Backend hors ligne ! Redémarrage..." "WARNING"
                $backendProc = Start-YamtikenBackend
            }
            
            # Vérifier frontend
            if (!(Test-PortOpen -Port $FRONTEND_PORT)) {
                Write-Log "Frontend hors ligne ! Redémarrage..." "WARNING"
                $frontendProc = Start-YamtikenFrontend
            }
            
            # Log périodique
            Write-Log "Surveillance active - Tous les services OK" "DEBUG"
        }
    } catch {
        Write-Log "Surveillance interrompue" "WARNING"
    }
}

function Install-AutoStart {
    Write-Log "Configuration du démarrage automatique..."
    
    # Créer le raccourci dans le dossier Startup
    $startupPath = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupPath "YAMTIKEN-Service.lnk"
    $targetPath = $MyInvocation.MyCommand.Path
    
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-WindowStyle Minimized -ExecutionPolicy Bypass -File `"$targetPath`" -Action start"
    $Shortcut.WorkingDirectory = $PROJECT_ROOT
    $Shortcut.IconLocation = "powershell.exe,0"
    $Shortcut.Save()
    
    Write-Log "Démarrage automatique configuré !" "SUCCESS"
    Write-Log "Le service démarrera à chaque ouverture de session Windows" "INFO"
}

# Exécution principale
switch ($Action) {
    "start" { Watch-Yamtiken }
    "stop" { Stop-Yamtiken }
    "status" {
        $backendStatus = if (Test-PortOpen -Port $BACKEND_PORT) { "✅ EN LIGNE" } else { "❌ HORS LIGNE" }
        $frontendStatus = if (Test-PortOpen -Port $FRONTEND_PORT) { "✅ EN LIGNE" } else { "❌ HORS LIGNE" }
        Write-Log "Backend: $backendStatus"
        Write-Log "Frontend: $frontendStatus"
    }
    "install" { Install-AutoStart }
    default { Write-Log "Usage: .\yamtiken-service.ps1 -Action [start|stop|status|install]" }
}
