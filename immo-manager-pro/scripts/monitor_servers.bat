@echo off
chcp 65001 >nul

:: ============================================================
:: SCRIPT DE SURVEILLANCE WINDOWS - INFRASTRUCTURE INCREVABLE
:: Vérifie les ports toutes les 10s et redémarre si nécessaire
:: ============================================================

:: Configuration
set BACKEND_PORT=5002
set FRONTEND_PORT=5177
set CHECK_INTERVAL=10
set LOG_FILE=logs\monitor.log

:: Créer le dossier logs
if not exist logs mkdir logs

:: ============================================================
:: FONCTIONS
:: ============================================================

:log
    echo [%date% %time%] %~1 >> %LOG_FILE%
    echo [%date% %time%] %~1
    goto :eof

:check_port
    :: Vérifier si un port est ouvert avec PowerShell
    powershell -Command "
        $port = %1
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) { exit 0 } else { exit 1 }
    "
    goto :eof

:restart_pm2
    call :log "WARN - Tentative de redémarrage %~1 avec PM2..."
    pm2 restart %~1
    if %errorlevel% equ 0 (
        call :log "INFO - %~1 redémarré avec succès via PM2"
    ) else (
        call :log "ERROR - Échec du redémarrage PM2 de %~1"
    )
    goto :eof

:restart_docker
    call :log "WARN - Tentative de redémarrage %~1 avec Docker..."
    docker restart %~1
    if %errorlevel% equ 0 (
        call :log "INFO - %~1 redémarré avec succès via Docker"
        timeout /t 5 /nobreak >nul
    ) else (
        call :log "ERROR - Échec du redémarrage Docker de %~1"
    )
    goto :eof

:start_backend
    call :log "WARN - Backend arrêté - Démarrage..."
    where pm2 >nul 2>&1
    if %errorlevel% equ 0 (
        pm2 start ecosystem.dev.config.js --only immo-backend
    ) else (
        where docker >nul 2>&1
        if %errorlevel% equ 0 (
            docker-compose up -d backend
        ) else (
            start "Backend" cmd /k "cd server && set PORT=5002 && node server.js"
        )
    )
    goto :eof

:start_frontend
    call :log "WARN - Frontend arrêté - Démarrage..."
    where pm2 >nul 2>&1
    if %errorlevel% equ 0 (
        pm2 start ecosystem.dev.config.js --only immo-frontend
    ) else (
        where docker >nul 2>&1
        if %errorlevel% equ 0 (
            docker-compose up -d frontend
        ) else (
            start "Frontend" cmd /k "cd client && npx vite --host --port 5177"
        )
    )
    goto :eof

:: ============================================================
:: SCRIPT PRINCIPAL
:: ============================================================

call :log "============================================================"
call :log "🚀 DÉMARRAGE DU MONITEUR DE SURVEILLANCE"
call :log "============================================================"
call :log "Backend: port %BACKEND_PORT%"
call :log "Frontend: port %FRONTEND_PORT%"
call :log "Intervalle: %CHECK_INTERVAL%s"
call :log "Logs: %LOG_FILE%"
call :log "============================================================"

:: Boucle infinie
:loop
    set BACKEND_OK=0
    set FRONTEND_OK=0

    :: Vérifier Backend
    call :check_port %BACKEND_PORT%
    if %errorlevel% equ 0 (
        set BACKEND_OK=1
        call :log "DEBUG - Backend (port %BACKEND_PORT%) OK"
    ) else (
        call :log "WARN - Backend (port %BACKEND_PORT%) NE RÉPOND PAS"
    )

    :: Vérifier Frontend
    call :check_port %FRONTEND_PORT%
    if %errorlevel% equ 0 (
        set FRONTEND_OK=1
        call :log "DEBUG - Frontend (port %FRONTEND_PORT%) OK"
    ) else (
        call :log "WARN - Frontend (port %FRONTEND_PORT%) NE RÉPOND PAS"
    )

    :: Actions si services down
    if %BACKEND_OK% equ 0 (
        call :log "ERROR - CRITIQUE: Backend hors ligne !"
        
        where pm2 >nul 2>&1
        if %errorlevel% equ 0 (
            pm2 list | findstr "immo-backend" >nul
            if %errorlevel% equ 0 call :restart_pm2 "immo-backend"
        )
        
        where docker >nul 2>&1
        if %errorlevel% equ 0 (
            docker ps | findstr "immo-backend" >nul
            if %errorlevel% equ 0 call :restart_docker "immo-backend"
        )
        
        if %BACKEND_OK% equ 0 call :start_backend
    )

    if %FRONTEND_OK% equ 0 (
        call :log "ERROR - CRITIQUE: Frontend hors ligne !"
        
        where pm2 >nul 2>&1
        if %errorlevel% equ 0 (
            pm2 list | findstr "immo-frontend" >nul
            if %errorlevel% equ 0 call :restart_pm2 "immo-frontend"
        )
        
        where docker >nul 2>&1
        if %errorlevel% equ 0 (
            docker ps | findstr "immo-frontend" >nul
            if %errorlevel% equ 0 call :restart_docker "immo-frontend"
        )
        
        if %FRONTEND_OK% equ 0 call :start_frontend
    )

    :: Rapport final
    if %BACKEND_OK% equ 1 if %FRONTEND_OK% equ 1 (
        call :log "INFO - ✅ Tous les services sont opérationnels"
    )

    :: Attendre
    timeout /t %CHECK_INTERVAL% /nobreak >nul
    
    goto loop
