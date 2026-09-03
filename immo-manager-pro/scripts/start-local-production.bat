@echo off
REM ============================================
REM IMMO MANAGER PRO - Démarrage local PRODUCTION
REM Naviguer sur http://localhost:5000 dans le navigateur
REM ============================================

echo.
echo ==========================================
echo   IMMO MANAGER PRO - Mode Production
echo ==========================================
echo.

cd /d "%~dp0"

REM Vérifier que le build existe
if not exist "client\dist\index.html" (
    echo [ERREUR] Le build frontend n'existe pas !
    echo Lancement du build...
    cd client
    call npm run build
    cd ..
)

echo [1/2] Demarrage du serveur...
cd server

REM Charger le .env
set NODE_ENV=production
set PORT=5000

echo [2/2] Serveur demarre sur http://localhost:5000
echo.
echo   Ouvrez votre navigateur sur : http://localhost:5000
echo   Ctrl+C pour arreter
echo.

node server.js
pause
