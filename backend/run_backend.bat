@echo off
title GuardianApp Python/Flask Backend Server
echo ===================================================
echo     GuardianApp - Python / Flask Backend Server
echo     SQLite Database + AI/ML Verifier + Firebase Sync
echo ===================================================
echo.

cd /d "%~dp0"

echo [*] Checking Python installation...
set "PYTHON_CMD=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)

%PYTHON_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python is not found in PATH or standard directory.
    echo [*] Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [*] Starting Flask REST Server on http://localhost:5000 ...
echo [*] SQLite database location: %~dp0guardian.db
echo.
%PYTHON_CMD% app.py

pause

