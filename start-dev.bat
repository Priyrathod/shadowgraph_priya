@echo off
echo ===================================================
echo Starting ShadowGraph Backend and Frontend Services
echo ===================================================

REM Launch Backend API on port 8000
start "ShadowGraph Backend (Port 8000)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

REM Launch Frontend Vite Dev Server
start "ShadowGraph Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo Both servers have been launched in separate terminal windows!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo ===================================================
