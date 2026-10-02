@echo off
chcp 65001 >nul

set "NODE_DIR=C:\Users\munok\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" (
    set "PATH=%NODE_DIR%;%PATH%"
)

set "BASE_DIR=%~dp0immo-manager-pro"

:: Nettoyage
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

:: Demarrage du Backend en arriere-plan complet via script VBS temporaire
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\run_backend.vbs"
echo WshShell.Run "cmd /c cd /d """%BASE_DIR%\server""" && node server.js", 0 >> "%TEMP%\run_backend.vbs"
cscript //nologo "%TEMP%\run_backend.vbs"
del "%TEMP%\run_backend.vbs"

:: Attente de l'initialisation du backend
:wait_backend
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if errorlevel 1 (
    ping 127.0.0.1 -n 2 >nul
    goto wait_backend
)

:: Demarrage du Frontend synchronise en arriere-plan
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\run_frontend.vbs"
echo WshShell.Run "cmd /c cd /d """%BASE_DIR%\client""" && npm run dev", 0 >> "%TEMP%\run_frontend.vbs"
cscript //nologo "%TEMP%\run_frontend.vbs"
del "%TEMP%\run_frontend.vbs"

:: Attente de l'initialisation du frontend
:wait_frontend
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
    ping 127.0.0.1 -n 2 >nul
    goto wait_frontend
)
