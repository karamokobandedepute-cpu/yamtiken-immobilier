@echo off
chcp 65001 >nul
title YAMTIKEN IMMOBILIER 2026 - DEMARRAGE SYNCHRONISE

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" (
    set "PATH=%NODE_DIR%;%PATH%"
)

cd /d "%~dp0immo-manager-pro"

echo ============================================================
echo         LANCEMENT DE L'APPLICATION YAMTIKEN 2026
echo             (Connexion Synchro Ultra-Rapide)
echo ============================================================
echo.
echo 1. Nettoyage et liberation des ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo 2. Demarrage du Backend (Serveur) en arriere-plan...
start /min "YAMTIKEN BACKEND (NE PAS FERMER)" cmd /k "cd server && node server.js"

echo ⏳ Attente de l'initialisation du serveur...
:wait_backend
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if errorlevel 1 (
    ping 127.0.0.1 -n 2 >nul
    goto wait_backend
)
echo ✅ Backend 100%% en ligne et pret !

echo.
echo 3. Demarrage du Frontend (Client) de maniere synchronisee...
start /min "YAMTIKEN FRONTEND (NE PAS FERMER)" cmd /k "cd client && npm run dev"

echo ⏳ Connexion de l'interface en cours...
:wait_frontend
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
    ping 127.0.0.1 -n 2 >nul
    goto wait_frontend
)
echo ✅ Frontend 100%% en ligne et lie au serveur !

echo.
echo ============================================================
echo   APPLICATION YAMTIKEN LANCEE ET SYNCHRONISEE !
echo ============================================================
echo Ouverture automatique de votre session (qui n'expire jamais)...
timeout /t 1 /nobreak >nul
start http://localhost:5173

echo.
echo ATTENTION : Deux processus ont ete ouverts et reduits dans la barre des taches.
echo Laissez-les ouverts pour que le site fonctionne.
echo Vous pouvez maintenant fermer cette fenetre principale.
pause
