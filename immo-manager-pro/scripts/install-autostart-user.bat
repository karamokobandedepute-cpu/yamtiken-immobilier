@echo off
chcp 65001 >nul
title YAMTIKEN - Demarrage Auto Utilisateur
setlocal EnableDelayedExpansion

echo ╔══════════════════════════════════════════════════════════════╗
echo ║  INSTALLATION DEMARRAGE AUTO - SANS DROITS ADMINISTRATEUR   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Ce script configure YAMTIKEN pour demarrer automatiquement
echo quand vous ouvrez votre session Windows (sans droits admin).
echo.

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo [INFO] Repertoire du projet : %PROJECT_ROOT%
echo [INFO] Repertoire demarrage  : %STARTUP_DIR%
echo.

:: Créer le script de lancement invisible
set "VBS_LAUNCHER=%PROJECT_ROOT%\launch-invisible.vbs"
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""%PROJECT_ROOT%\yamtiken-service.ps1"" -Action start", 0
echo Set WshShell = Nothing
) > "%VBS_LAUNCHER%"

echo [OK] Launcher invisible cree

:: Créer le raccourci dans le dossier Startup
set "SHORTCUT=%STARTUP_DIR%\YAMTIKEN-AutoStart.lnk"

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT%'); $Shortcut.TargetPath = '%VBS_LAUNCHER%'; $Shortcut.WorkingDirectory = '%PROJECT_ROOT%'; $Shortcut.IconLocation = '%SystemRoot%\System32\shell32.dll,21'; $Shortcut.Save()"

echo [OK] Raccourci cree dans le dossier Demarrage
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║          CONFIGURATION TERMINEE !                            ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo YAMTIKEN va maintenant demarrer automatiquement a chaque
echo ouverture de session Windows.
echo.
echo Le service s'executera en ARRIERE-PLAN (icone dans la barre des taches)
echo.
echo Pour desactiver le demarrage auto :
echo   1. Win + R
echo   2. Tapez : shell:startup
echo   3. Supprimez le raccourci YAMTIKEN-AutoStart
echo.
echo Voulez-vous demarrer YAMTIKEN maintenant ?
choice /C YN /M "Demarrer maintenant"
if %errorlevel% == 1 (
    echo.
    echo [INFO] Demarrage de YAMTIKEN...
    wscript "%VBS_LAUNCHER%"
    timeout /t 5 >nul
    
    :: Vérifier le démarrage
    netstat -ano | findstr :5000 | findstr LISTENING >nul
    if !errorlevel! == 0 (
        echo [OK] Backend demarre !
    ) else (
        echo [ATTENTE] Demarrage en cours...
    )
    
    netstat -ano | findstr :5173 | findstr LISTENING >nul
    if !errorlevel! == 0 (
        echo [OK] Frontend demarre !
    ) else (
        echo [ATTENTE] Demarrage en cours...
    )
    
    echo.
    start http://localhost:5173
)

echo.
pause
