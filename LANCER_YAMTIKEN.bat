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

echo 1. Nettoyage des anciens processus...
call npx pm2 stop ecosystem.config.cjs 2>nul
call npx pm2 delete ecosystem.config.cjs 2>nul

echo 2. Demarrage des serveurs Frontend et Backend...
call npx pm2 start ecosystem.config.cjs

echo.
echo ============================================================
echo   APPLICATION YAMTIKEN LANCEE AVEC SUCCES !
echo ============================================================
echo.
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:5000
echo.
echo  Identifiants de connexion :
echo  Email    : munokolive@gmail.com
echo  Mdp      : 77916407@@Mu
echo.
echo ============================================================
echo Ouverture automatique du navigateur...
echo.
echo  VOUS POUVEZ FERMER CETTE FENETRE EN TOUTE SECURITE.
echo  Les serveurs continueront de tourner en arriere-plan.
echo ============================================================
echo.

start http://localhost:5173

pause
