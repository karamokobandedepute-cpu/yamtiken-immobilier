@echo off
chcp 65001 >nul
title YAMTIKEN - Panneau de Controle
setlocal EnableDelayedExpansion

:MENU
cls
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              YAMTIKEN - PANNEAU DE CONTROLE                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Vérifier le statut
set "BACKEND_STATUS=❌ ARRETE"
set "FRONTEND_STATUS=❌ ARRETE"

netstat -ano | findstr :5000 | findstr LISTENING >nul
if !errorlevel! == 0 set "BACKEND_STATUS=✅ EN LIGNE"

netstat -ano | findstr :5173 | findstr LISTENING >nul
if !errorlevel! == 0 set "FRONTEND_STATUS=✅ EN LIGNE"

echo   Statut actuel :
echo     Backend  : %BACKEND_STATUS%
echo     Frontend : %FRONTEND_STATUS%
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                        ACTIONS                               ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  [1] Demarrer YAMTIKEN (avec surveillance)                   ║
echo ║  [2] Arreter YAMTIKEN                                        ║
echo ║  [3] Redemarrer YAMTIKEN                                     ║
echo ║  [4] Ouvrir URLs (navigateur)                                ║
echo ║  [5] Voir les logs                                           ║
echo ║  [6] Installer demarrage auto (utilisateur)                  ║
echo ║  [7] Installer service Windows (admin requis)                ║
echo ║  [8] Desinstaller demarrage auto                             ║
echo ║  [0] Quitter                                                 ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set /p choice="Choisissez une option (0-8) : "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto RESTART
if "%choice%"=="4" goto OPEN_URLS
if "%choice%"=="5" goto VIEW_LOGS
if "%choice%"=="6" goto INSTALL_USER
if "%choice%"=="7" goto INSTALL_SERVICE
if "%choice%"=="8" goto UNINSTALL
if "%choice%"=="0" goto EXIT
goto MENU

:START
echo.
echo [INFO] Demarrage de YAMTIKEN avec surveillance...
start "YAMTIKEN-WATCHDOG" cmd /c "%~dp0autostart-watchdog.bat"
timeout /t 3 >nul
echo [OK] Surveillance demarree dans une nouvelle fenetre
echo.
pause
goto MENU

:STOP
echo.
echo [INFO] Arret de YAMTIKEN...
taskkill /F /FI "WINDOWTITLE eq YAMTIKEN*" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul
echo [OK] Services arretes
echo.
pause
goto MENU

:RESTART
echo.
echo [INFO] Redemarrage de YAMTIKEN...
taskkill /F /FI "WINDOWTITLE eq YAMTIKEN*" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 >nul
start "YAMTIKEN-WATCHDOG" cmd /c "%~dp0autostart-watchdog.bat"
timeout /t 3 >nul
echo [OK] Redemarrage en cours
echo.
pause
goto MENU

:OPEN_URLS
echo.
echo [INFO] Ouverture des URLs...
start http://localhost:5173
timeout /t 1 >nul
start http://localhost:5000
echo [OK] Navigateurs ouverts
echo.
pause
goto MENU

:VIEW_LOGS
echo.
if exist "%~dp0..\logs" (
    echo [INFO] Ouverture du dossier logs...
    explorer "%~dp0..\logs"
) else if exist "%~dp0logs" (
    echo [INFO] Ouverture du dossier logs...
    explorer "%~dp0logs"
) else (
    echo [INFO] Aucun log disponible encore
)
echo.
pause
goto MENU

:INSTALL_USER
echo.
echo [INFO] Installation demarrage auto utilisateur...
call "%~dp0install-autostart-user.bat"
goto MENU

:INSTALL_SERVICE
echo.
echo [INFO] Installation service Windows...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Droits administrateur requis !
    echo Cliquez droit sur ce fichier : Executer en tant qu'administrateur
    pause
    goto MENU
)
call "%~dp0install-service.bat"
goto MENU

:UNINSTALL
echo.
echo [INFO] Desinstallation du demarrage auto...
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP_DIR%\YAMTIKEN-AutoStart.lnk" >nul 2>&1
net stop YAMTIKEN >nul 2>&1
if exist "%~dp0nssm.exe" (
    "%~dp0nssm.exe" stop YAMTIKEN >nul 2>&1
    "%~dp0nssm.exe" remove YAMTIKEN confirm >nul 2>&1
)
echo [OK] Demarrage auto desinstalle
echo.
pause
goto MENU

:EXIT
echo.
echo Au revoir !
timeout /t 2 >nul
exit /b 0
