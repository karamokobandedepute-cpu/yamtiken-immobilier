@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ==========================================
echo   YAMTIKEN - DEMARRAGE ROBUSTE
echo ==========================================
echo.

:: Configuration des couleurs
color 0A

:: Vérifier que Node.js est installé
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERREUR] Node.js n'est pas installé ou pas dans le PATH
    echo Veuillez installer Node.js depuis https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js détecté

:: Tuer tous les processus node existants pour éviter les conflits
echo [1/5] Nettoyage des processus existants...
taskkill /F /IM node.exe /IM npx.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Processus nettoyés

:: Aller dans le dossier server
echo [2/5] Demarrage du Backend (port 5000)...
cd /d "%~dp0\server"

:: Démarrer le backend en arrière-plan avec log
start "YAMTIKEN Backend" cmd /c "node server.js 2>&1 | tee backend.log"

:: Attendre que le backend soit prêt (max 30 secondes)
echo [3/5] Attente du demarrage backend...
set /a attempts=0
:check_backend
ping -n 1 127.0.0.1 >nul 2>&1
timeout /t 1 /nobreak >nul
set /a attempts+=1

:: Vérifier si le port 5000 est ouvert
netstat -ano | findstr :5000 | findstr LISTENING >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Backend demarre avec succes !
    goto backend_ok
)

if %attempts% geq 30 (
    color 0C
    echo [ERREUR] Le backend n'a pas demarre apres 30 secondes
    echo Verifiez le fichier server\backend.log
    pause
    exit /b 1
)

goto check_backend

:backend_ok
timeout /t 2 /nobreak >nul

:: Aller dans le dossier client
echo [4/5] Demarrage du Frontend (port 5173)...
cd /d "%~dp0\client"

:: Vérifier que node_modules existe
if not exist "node_modules" (
    echo [INFO] Installation des dependances...
    npm install
    if errorlevel 1 (
        color 0C
        echo [ERREUR] Impossible d'installer les dependances
        pause
        exit /b 1
    )
)

:: Démarrer le frontend
start "YAMTIKEN Frontend" cmd /k "npm run dev"

:: Attendre que le frontend soit prêt
echo [5/5] Attente du demarrage frontend...
set /a attempts=0
:check_frontend
timeout /t 1 /nobreak >nul
set /a attempts+=1

netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Frontend demarre avec succes !
    goto frontend_ok
)

if %attempts% geq 20 (
    color 0C
    echo [AVERTISSEMENT] Le frontend met du temps a demarrer
    echo Continuez quand meme...
)

goto check_frontend

:frontend_ok
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo   DEMARRAGE TERMINE AVEC SUCCES !
echo ==========================================
echo.
echo Backend  : http://localhost:5000
echo Frontend : http://localhost:5173
echo.
echo Pour vous connecter :
echo   Email    : munokolive@gmail.com
echo   Password : 77916407@@Mu
echo.
echo Les fenetres sont ouvertes :
echo - Fenetre 1 : Backend (ne pas fermer)
echo - Fenetre 2 : Frontend (ne pas fermer)
echo.
echo Logs disponibles dans :
echo   server\backend.log
echo.

:: Ouvrir automatiquement le navigateur
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Ouverture du navigateur...
echo.
echo Appuyez sur une touche pour quitter ce script (les serveurs continueront a tourner)
pause >nul
