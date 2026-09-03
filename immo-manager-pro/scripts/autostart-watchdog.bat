@echo off
chcp 65001 >nul
title YAMTIKEN WATCHDOG - Surveillance Auto
setlocal EnableDelayedExpansion

:: CONFIGURATION
set "PROJECT_ROOT=%~dp0..\"
set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" set "PATH=%NODE_DIR%;%PATH%"
set "BACKEND_PORT=5000"
set "FRONTEND_PORT=5173"
set "CHECK_INTERVAL=10"
set "MAX_RESTARTS=5"
set "RESTART_COUNT=0"

:START
cls
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           YAMTIKEN WATCHDOG - SURVEILLANCE AUTO              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo [INFO] Démarrage du système de surveillance...
echo [INFO] Vérification toutes les %CHECK_INTERVAL% secondes
echo [INFO] Redémarrage auto si crash (max %MAX_RESTARTS% fois)
echo.

:: Vérifier que Node.js est installé
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js non trouvé !
    pause
    exit /b 1
)

:: Créer les dossiers de logs
if not exist "%PROJECT_ROOT%logs" mkdir "%PROJECT_ROOT%logs"

echo [1/2] Démarrage du BACKEND...

:: Vérifier si backend déjà en cours
netstat -ano | findstr :%BACKEND_PORT% | findstr LISTENING >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Backend déjà en cours (port %BACKEND_PORT%)
) else (
    :: Démarrer le backend avec boucle de survie
    start "YAMTIKEN-BACKEND" cmd /c "cd /d "%PROJECT_ROOT%server" ^&^& :LOOP_BACKEND ^&^& node server.js ^>^> "%PROJECT_ROOT%logs\backend.log" 2^>^&1 ^&^& timeout /t 3 /nobreak ^>nul ^&^& goto LOOP_BACKEND"
    
    :: Attendre le démarrage
    set /a attempts=0
    :WAIT_BACKEND
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr :%BACKEND_PORT% | findstr LISTENING >nul 2>&1
    if %errorlevel% == 0 (
        echo [OK] Backend démarré sur port %BACKEND_PORT%
    ) else (
        set /a attempts+=1
        if !attempts! lss 15 goto WAIT_BACKEND
        echo [ERREUR] Backend ne démarre pas !
    )
)

echo.
echo [2/2] Démarrage du FRONTEND...

:: Vérifier si frontend déjà en cours
netstat -ano | findstr :%FRONTEND_PORT% | findstr LISTENING >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Frontend déjà en cours (port %FRONTEND_PORT%)
) else (
    :: Démarrer le frontend avec boucle de survie
    start "YAMTIKEN-FRONTEND" cmd /c "cd /d "%PROJECT_ROOT%client" ^&^& :LOOP_FRONTEND ^&^& npm run dev ^>^> "%PROJECT_ROOT%logs\frontend.log" 2^>^&1 ^&^& timeout /t 5 /nobreak ^>nul ^&^& set /a RESTART_COUNT+=1 ^&^& if !RESTART_COUNT! lss %MAX_RESTARTS% goto LOOP_FRONTEND"
    
    :: Attendre le démarrage
    set /a attempts=0
    :WAIT_FRONTEND
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr :%FRONTEND_PORT% | findstr LISTENING >nul 2>&1
    if %errorlevel% == 0 (
        echo [OK] Frontend démarré sur port %FRONTEND_PORT%
    ) else (
        set /a attempts+=1
        if !attempts! lss 20 goto WAIT_FRONTEND
        echo [ERREUR] Frontend ne démarre pas !
    )
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  SURVEILLANCE ACTIVE - Appuyez sur une touche pour arrêter  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Logs disponibles dans : %PROJECT_ROOT%logs\
echo.
echo URLs :
echo   Backend  : http://localhost:%BACKEND_PORT%
echo   Frontend : http://localhost:%FRONTEND_PORT%
echo.

:: Boucle de surveillance
:WATCHDOG_LOOP
    timeout /t %CHECK_INTERVAL% /nobreak >nul
    
    :: Vérifier backend
    netstat -ano | findstr :%BACKEND_PORT% | findstr LISTENING >nul 2>&1
    if %errorlevel% neq 0 (
        echo [%date% %time%] ⚠️ BACKEND HORS LIGNE - Redémarrage...
        taskkill /F /FI "WINDOWTITLE eq YAMTIKEN-BACKEND*" >nul 2>&1
        timeout /t 2 >nul
        start "YAMTIKEN-BACKEND" cmd /c "cd /d "%PROJECT_ROOT%server" ^&^& :LB ^&^& node server.js ^>^> "%PROJECT_ROOT%logs\backend.log" 2^>^&1 ^&^& timeout /t 3 ^>nul ^&^& goto LB"
        echo [%date% %time%] ✅ Backend redémarré
    )
    
    :: Vérifier frontend
    netstat -ano | findstr :%FRONTEND_PORT% | findstr LISTENING >nul 2>&1
    if %errorlevel% neq 0 (
        echo [%date% %time%] ⚠️ FRONTEND HORS LIGNE - Redémarrage...
        taskkill /F /FI "WINDOWTITLE eq YAMTIKEN-FRONTEND*" >nul 2>&1
        timeout /t 2 >nul
        start "YAMTIKEN-FRONTEND" cmd /c "cd /d "%PROJECT_ROOT%client" ^&^& :LF ^&^& npm run dev ^>^> "%PROJECT_ROOT%logs\frontend.log" 2^>^&1 ^&^& timeout /t 5 ^>nul ^&^& goto LF"
        echo [%date% %time%] ✅ Frontend redémarré
    )
    
    :: Vérifier si l'utilisateur veut arrêter
    if exist "%PROJECT_ROOT%.stop-watchdog" (
        del "%PROJECT_ROOT%.stop-watchdog"
        goto CLEANUP
    )
    
goto WATCHDOG_LOOP

:CLEANUP
echo.
echo [ARRET] Fermeture des services...
taskkill /F /FI "WINDOWTITLE eq YAMTIKEN-BACKEND*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq YAMTIKEN-FRONTEND*" >nul 2>&1
echo [OK] Services arrêtés
timeout /t 2 >nul
exit /b 0
