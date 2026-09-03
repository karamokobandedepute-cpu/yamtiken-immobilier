@echo off
chcp 65001 >nul
title YAMTIKEN - Installation Service Windows
setlocal EnableDelayedExpansion

echo ╔══════════════════════════════════════════════════════════════╗
echo ║     INSTALLATION SERVICE WINDOWS - YAMTIKEN BEHEMOTH        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Ce script va installer YAMTIKEN comme service Windows.
echo Le serveur démarrera automatiquement au boot de Windows.
echo.

:: Vérifier les droits administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Droits administrateur requis !
    echo Veuillez cliquer droit sur ce fichier et selectionner "Executer en tant qu'administrateur"
    pause
    exit /b 1
)

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo [INFO] Repertoire d'installation : %PROJECT_ROOT%
echo.

:: Vérifier NSSM
where nssm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] NSSM (Non-Sucking Service Manager) n'est pas installe.
    echo [INFO] Telechargement de NSSM...
    
    :: Télécharger NSSM
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip'"
    
    if exist "%TEMP%\nssm.zip" (
        echo [OK] NSSM telecharge
        echo [INFO] Extraction...
        powershell -Command "Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%PROJECT_ROOT%\tools' -Force"
        
        :: Copier le bon nssm selon l'architecture
        if exist "%PROJECT_ROOT%\tools\nssm-2.24\win64\nssm.exe" (
            copy "%PROJECT_ROOT%\tools\nssm-2.24\win64\nssm.exe" "%PROJECT_ROOT%\nssm.exe" >nul
        ) else (
            copy "%PROJECT_ROOT%\tools\nssm-2.24\win32\nssm.exe" "%PROJECT_ROOT%\nssm.exe" >nul
        )
        
        echo [OK] NSSM installe
    ) else (
        echo [ERREUR] Impossible de telecharger NSSM
        echo Veuillez le telecharger manuellement depuis https://nssm.cc/
        pause
        exit /b 1
    )
)

:: Créer le script de démarrage
set "START_SCRIPT=%PROJECT_ROOT%\start-minimal.bat"
(
echo @echo off
echo chcp 65001 ^>nul
echo cd /d "%~dp0"
echo.
echo :: Tuer les processus existants
echo taskkill /F /IM node.exe /IM npx.exe ^>nul 2^>^&1
echo timeout /t 2 /nobreak ^>nul
echo.
echo :: Démarrer backend en arriere-plan
echo start /MIN "YAMTIKEN-BACKEND" cmd /c "cd server ^&^& node server.js"
echo.
echo :: Attendre backend
echo :WAIT_BACKEND
echo timeout /t 1 /nobreak ^>nul
echo netstat -ano ^| findstr :5000 ^| findstr LISTENING ^>nul
echo if %%errorlevel%% neq 0 goto WAIT_BACKEND
echo.
echo :: Démarrer frontend en arriere-plan
echo start /MIN "YAMTIKEN-FRONTEND" cmd /c "cd client ^&^& npm run dev"
echo.
echo :: Garder le service actif
echo :LOOP
echo timeout /t 30 /nobreak ^>nul
echo.
echo :: Verifier backend
echo netstat -ano ^| findstr :5000 ^| findstr LISTENING ^>nul
echo if %%errorlevel%% neq 0 (
echo     taskkill /F /IM node.exe ^>nul 2^>^&1
echo     timeout /t 3 /nobreak ^>nul
echo     start /MIN "YAMTIKEN-BACKEND" cmd /c "cd server ^&^& node server.js"
echo ^)
echo.
echo :: Verifier frontend
echo netstat -ano ^| findstr :5173 ^| findstr LISTENING ^>nul
echo if %%errorlevel%% neq 0 (
echo     start /MIN "YAMTIKEN-FRONTEND" cmd /c "cd client ^&^& npm run dev"
echo ^)
echo.
echo goto LOOP
) > "%START_SCRIPT%"

echo [OK] Script de demarrage cree : %START_SCRIPT%
echo.

:: Supprimer l'ancien service s'il existe
net stop YAMTIKEN >nul 2>&1
"%PROJECT_ROOT%\nssm.exe" stop YAMTIKEN >nul 2>&1
"%PROJECT_ROOT%\nssm.exe" remove YAMTIKEN confirm >nul 2>&1
timeout /t 2 >nul

:: Créer le service
"%PROJECT_ROOT%\nssm.exe" install YAMTIKEN "%START_SCRIPT%"
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN DisplayName "YAMTIKEN Immo Manager Pro"
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN Description "Service de gestion immobiliere YAMTIKEN BEHEMOTH"
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN Start SERVICE_AUTO_START
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN AppDirectory "%PROJECT_ROOT%"
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN AppStdout "%PROJECT_ROOT%\logs\service.log"
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN AppStderr "%PROJECT_ROOT%\logs\service-error.log"
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN AppRotateFiles 1
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN AppRotateSeconds 86400
"%PROJECT_ROOT%\nssm.exe" set YAMTIKEN AppRotateBytes 10485760

echo [OK] Service YAMTIKEN installe !
echo.

:: Démarrer le service
"%PROJECT_ROOT%\nssm.exe" start YAMTIKEN
echo [OK] Service demarre !
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║               INSTALLATION TERMINEE !                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Le service YAMTIKEN va maintenant : 
echo   - Demarrer automatiquement au boot de Windows
echo   - Redemarrer automatiquement en cas de crash
echo   - Ecrire les logs dans %PROJECT_ROOT%\logs\
echo.
echo Commandes de gestion :
echo   - net start YAMTIKEN    (demarrer)
echo   - net stop YAMTIKEN     (arreter)
echo   - services.msc          (interface graphique)
echo.
echo URLs :
echo   Backend  : http://localhost:5000
echo   Frontend : http://localhost:5173
echo.

:: Ouvrir services.msc pour voir le service
timeout /t 3 >nul
start services.msc

pause
