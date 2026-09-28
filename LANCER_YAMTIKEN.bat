@echo off
chcp 65001 >nul
title YAMTIKEN IMMOBILIER 2026 - DEMARRAGE STABLE

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" (
    set "PATH=%NODE_DIR%;%PATH%"
)

cd /d "%~dp0immo-manager-pro"

echo ============================================================
echo         LANCEMENT DE L'APPLICATION YAMTIKEN 2026
echo ============================================================
echo.
echo 1. Nettoyage et liberation des ports 5000 et 5173...
call npx --yes pm2 kill >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo 2. Demarrage du Backend (Serveur)...
start "YAMTIKEN BACKEND (NE PAS FERMER)" cmd /k "cd server && node server.js"

echo 3. Demarrage du Frontend (Client)...
start "YAMTIKEN FRONTEND (NE PAS FERMER)" cmd /k "cd client && npm run dev"

echo.
echo ============================================================
echo   APPLICATION YAMTIKEN LANCEE AVEC SUCCES !
echo ============================================================
echo Ouverture automatique du navigateur dans 4 secondes...
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo ATTENTION : Deux nouvelles fenetres ont ete ouvertes.
echo Laissez-les ouvertes ou reduites pour que le site fonctionne.
echo Vous pouvez maintenant fermer cette fenetre principale.
pause
