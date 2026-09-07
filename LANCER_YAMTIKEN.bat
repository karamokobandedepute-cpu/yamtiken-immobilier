@echo off
chcp 65001 >nul
title YAMTIKEN IMMOBILIER 2026 - DEMARRAGE STABLE (PM2)

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" (
    set "PATH=%NODE_DIR%;%PATH%"
)

cd /d "%~dp0immo-manager-pro"

echo ============================================================
echo         LANCEMENT DE L'APPLICATION YAMTIKEN 2026
echo ============================================================
echo.
echo Mode: Arriere-plan stable (Aucune fenetre a garder ouverte)
echo.

echo 1. Arret complet de PM2 et nettoyage des processus...
call npx pm2 kill 2>nul
timeout /t 2 /nobreak >nul

echo 2. Liberation des ports 5000 et 5173 (processus zombie)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    echo    Arret du processus PID %%a sur le port 5000...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo    Arret du processus PID %%a sur le port 5173...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo 3. Demarrage des serveurs Frontend et Backend ensemble...
call npx pm2 start ecosystem.config.cjs

echo.
echo ============================================================
echo   APPLICATION YAMTIKEN LANCEE AVEC SUCCES !
echo ============================================================
echo.
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:5000
echo.
echo ============================================================
echo Ouverture automatique du navigateur dans 3 secondes...
echo.
echo  ATTENTION : NE FERMEZ PAS CETTE FENETRE NOIRE !
echo  Elle maintient le serveur YAMTIKEN en vie. Si vous la fermez,
echo  l'application affichera Serveur injoignable.
echo ============================================================
echo.

timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Affichage des logs en direct (Appuyez sur Ctrl+C pour quitter)...
call npx pm2 logs

