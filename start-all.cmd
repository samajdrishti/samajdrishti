@echo off
REM ---------------------------------------------------------------------
REM  Samaj Drishti - start every service for a demo
REM  Double-click this file, or run it from a terminal.
REM  Each service opens in its own window so you can see its logs.
REM ---------------------------------------------------------------------
setlocal
set "ROOT=%~dp0"

echo.
echo  ==============================================================
echo   Samaj Drishti - Ministry of Social Justice ^& Empowerment
echo  ==============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found on PATH. Install Node 18+ and re-run.
  pause & exit /b 1
)

if not exist "%ROOT%backend\node_modules" (
  echo [ERROR] Backend dependencies missing. Run:  cd backend ^& npm install
  pause & exit /b 1
)
if not exist "%ROOT%admin\node_modules" (
  echo [ERROR] Dashboard dependencies missing. Run:  cd admin ^& npm install
  pause & exit /b 1
)
if not exist "%ROOT%mobile-web\node_modules" (
  echo [ERROR] Field app dependencies missing. Run:  cd mobile-web ^& npm install
  pause & exit /b 1
)
if not exist "%ROOT%ai-engine\.venv\Scripts\python.exe" (
  echo [ERROR] AI engine virtualenv missing. Run:
  echo         cd ai-engine
  echo         python -m venv .venv
  echo         .venv\Scripts\python.exe -m pip install -r requirements.txt
  pause & exit /b 1
)

echo Starting API on port 5000 ...
start "Samaj Drishti API (5000)" cmd /k "cd /d ""%ROOT%backend"" && node src\index.js"

echo Starting AI engine on port 5001 ...
start "Samaj Drishti AI Engine (5001)" cmd /k "cd /d ""%ROOT%ai-engine"" && .venv\Scripts\python.exe app.py"

echo Starting department dashboard on port 5173 ...
start "Samaj Drishti Dashboard (5173)" cmd /k "cd /d ""%ROOT%admin"" && npm run dev"

echo Starting field app (PWA) on port 5174 ...
start "Samaj Drishti Field App (5174)" cmd /k "cd /d ""%ROOT%mobile-web"" && npm run dev"

echo.
echo  Give it 10-20 seconds, then open:
echo.
echo    Field app (officials)  http://localhost:5174   - tap "Field official"
echo    Dashboard (back office) http://localhost:5173  - tap "Admin"
echo.
echo  Phone on the same Wi-Fi? Use http://^<your-lan-ip^>:5174
echo.
echo  To shut everything down, run  stop-all.cmd
echo.
pause
