@echo off
echo ==========================================
echo   YAMTIKEN IMMO MANAGER PRO - DEMARRAGE
echo ==========================================
echo.

:: Couleur verte
color 0A

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" set "PATH=%NODE_DIR%;%PATH%"

:: Aller dans le dossier server
echo [1/2] Demarrage du Backend (port 5000)...
cd /d "%~dp0..\server"
start "YAMTIKEN Backend" cmd /k "node server.js"

:: Attendre 3 secondes
timeout /t 3 /nobreak > nul

:: Aller dans le dossier client
echo [2/2] Demarrage du Frontend (port 5173)...
cd /d "%~dp0..\client"
start "YAMTIKEN Frontend" cmd /k "npm run dev"

echo.
echo ==========================================
echo   DEMARRAGE TERMINE !
echo ==========================================
echo.
echo Backend  : http://localhost:5000
echo Frontend : http://localhost:5173
echo.
echo Pour vous connecter :
echo   Email    : munokolive@gmail.com
echo   Password : 77916407@@Mu
echo.
echo Les fenetres du serveur sont ouvertes.
echo Ne fermez pas ces fenetres pendant l'utilisation.
echo.
pause
