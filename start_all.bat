@echo off
title Protoplasm SAR Swarm Launcher
echo ========================================================
echo   Starting Protoplasm: Stigmergic SAR Swarm System
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Launching Python Backend API Server (Port 8080)...
start "Protoplasm Backend API" cmd /k "if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) & python src/api_server.py"

timeout /t 2 >nul

echo [2/2] Launching React Frontend GUI (Port 5173)...
start "Protoplasm Frontend GUI" cmd /k "npm run dev"

echo.
echo Both services launched!
echo Open your browser to: http://localhost:5173/
echo.
timeout /t 5 >nul
exit
