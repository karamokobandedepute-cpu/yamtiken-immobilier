@echo off
chcp 65001 >nul

:: ============================================================
:: START INDESTRUCTIBLE - Lance l'écosystème complet
:: PM2 + Surveillance automatique
:: ============================================================

echo ============================================
echo  🛡️  IMMO MANAGER PRO - MODE INDESTRUCTIBLE
echo ============================================
echo.

:: Vérifier Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js n'est pas installé !
    echo 📥 https://nodejs.org
    pause
    exit /b 1
)

:: Créer dossier logs
if not exist logs mkdir logs

:: ============================================================
:: ÉTAPE 1: Vérifier/Installer PM2
:: ============================================================
echo 🔍 Vérification de PM2...
where pm2 >nul 2>&1
if errorlevel 1 (
    echo 📦 Installation de PM2...
    npm install -g pm2
    if errorlevel 1 (
        echo ❌ Échec installation PM2
        pause
        exit /b 1
    )
    echo ✅ PM2 installé
) else (
    echo ✅ PM2 déjà installé
)

:: ============================================================
:: ÉTAPE 2: Nettoyer les processus existants
:: ============================================================
echo 🧹 Nettoyage des processus existants...
pm2 delete all 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

:: ============================================================
:: ÉTAPE 3: Démarrer avec PM2
:: ============================================================
echo 🚀 Démarrage de l'écosystème PM2...
pm2 start ecosystem.dev.config.js

if errorlevel 1 (
    echo ❌ Échec démarrage PM2
    echo 🔄 Tentative avec Docker...
    goto :docker_mode
)

echo.
echo ✅ Écosystème démarré avec PM2 !
echo.

:: ============================================================
:: ÉTAPE 4: Lancer le moniteur
:: ============================================================
echo 👁️  Lancement du moniteur de surveillance...
start "Surveillance" cmd /k "%~dp0monitor_servers.bat"

:: ============================================================
:: ÉTAPE 5: Afficher le dashboard PM2
:: ============================================================
echo 📊 Ouverture du dashboard PM2...
start "PM2 Dashboard" cmd /k "pm2 monit"

goto :finish

:docker_mode
echo 🐳 Mode Docker...
where docker >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker n'est pas installé
    echo 📥 https://docker.com
    pause
    exit /b 1
)

echo 🚀 Démarrage avec Docker Compose...
docker-compose up -d --build

echo.
echo ✅ Containers Docker démarrés !
echo.

:: Lancer moniteur
start "Surveillance" cmd /k "%~dp0monitor_servers.bat"

:finish
echo ============================================
echo  🎉 APPLICATION INDESTRUCTIBLE LANCÉE !
echo ============================================
echo.
echo 🌐 Frontend: http://localhost:5177
echo 🔌 Backend:  http://localhost:5002
echo.
echo 📋 Commandes utiles:
echo    pm2 status       - Voir l'état
echo    pm2 logs         - Voir les logs
echo    pm2 restart all  - Redémarrer tout
echo    pm2 stop all     - Arrêter tout
echo.
echo 💡 Tips:
echo    - Le moniteur redémarre auto en cas de crash
echo    - PM2 redémarre auto quand vous modifiez le code
echo    - Logs dans: logs/
echo.
echo ❌ Pour arrêter: FERMEZ toutes les fenêtres ou tapez Ctrl+C
echo.
pause
