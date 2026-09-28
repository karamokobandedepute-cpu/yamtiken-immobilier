@echo off
chcp 65001 >nul

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" (
    set "PATH=%NODE_DIR%;%PATH%"
)

cd /d "%~dp0immo-manager-pro"

:: Nettoyage
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

:: Demarrage en arriere-plan
start /B cmd /c "cd server && node server.js"
start /B cmd /c "cd client && npm run dev"
