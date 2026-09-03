@echo off
chcp 65001 >nul
echo ============================================
echo  🏢 IMMO MANAGER PRO - Démarrage
echo ============================================
echo.

:: Vérifier si Node.js est installé
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js n'est pas installé !
    echo 📥 Téléchargez-le sur: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js détecté
echo.

:: Arrêter les processus existants
echo 🛑 Arrêt des serveurs existants...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

:: Démarrer le backend
echo 🚀 Démarrage du Backend (Port 5002)...
start "Backend Server" cmd /k "cd /d %~dp0server && set PORT=5002 && node server.js"

:: Attendre que le backend démarre
timeout /t 5 /nobreak >nul

:: Démarrer le frontend
echo 🌐 Démarrage du Frontend (Port 5177)...
start "Frontend Server" cmd /k "cd /d %~dp0client && npx vite --host --port 5177"

:: Attendre que le frontend démarre
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo  ✅ Serveurs démarrés avec succès !
echo ============================================
echo.
echo 📱 Frontend: http://localhost:5177
echo 🔌 Backend:  http://localhost:5001
echo.
echo 📝 Les fenêtres de commande restent ouvertes.
echo ❌ Pour arrêter: fermez les fenêtres ou tapez Ctrl+C
echo.
pause
