@echo off
chcp 65001 >nul
title YAMTIKEN IMMOBILIER 2026 - DEMARRAGE
color 0A

echo ============================================================
echo         LANCEMENT DE L'APPLICATION YAMTIKEN 2026
echo ============================================================
echo.

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" (
    set "PATH=%NODE_DIR%;%PATH%"
)

cd /d "%~dp0immo-manager-pro"
powershell -ExecutionPolicy Bypass -File "start.ps1"

pause
