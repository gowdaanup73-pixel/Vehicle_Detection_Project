@echo off
title Vehicle Detection Platform
cd /d "%~dp0"

echo ===================================================
echo   Launching Vehicle Detection Project
echo ===================================================

if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" run_platform.py
) else if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" run_platform.py
) else (
    python run_platform.py
)

pause

