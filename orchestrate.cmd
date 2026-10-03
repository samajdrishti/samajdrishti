@echo off
REM ===========================================================================
REM  Samaj Drishti - master orchestrator
REM
REM  One control plane for every folder in the repo:
REM    backend-java\ Spring Boot API     :5000
REM    ai-engine\    Python ML/LLM       :5001
REM    admin\        React dashboard     :5173
REM    mobile-web\   PWA field app       :5174
REM
REM  Usage (from a terminal, in this folder):
REM    orchestrate.cmd            start all web services
REM    orchestrate.cmd start      start all web services
REM    orchestrate.cmd stop       stop all services + emulator
REM    orchestrate.cmd status     show what is listening + open URLs
REM    orchestrate.cmd emulator   boot the Android emulator
REM ===========================================================================
setlocal
set "ROOT=%~dp0"

if /i "%1"=="" set "CMD=start"
if /i "%1"=="start" set "CMD=start"
if /i "%1"=="stop" set "CMD=stop"
if /i "%1"=="status" set "CMD=status"
if /i "%1"=="emulator" set "CMD=emulator"

REM --- shared env ------------------------------------------------------------
set "JAVA_HOME=C:\Users\prema\.jdks\azul-17.0.19"
set "ANDROID_HOME=%ROOT%tools\android"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\cmdline-tools\bin;%PATH%"

REM ===========================================================================
if "%CMD%"=="start" goto :start
if "%CMD%"=="stop" goto :stop
if "%CMD%"=="status" goto :status
if "%CMD%"=="emulator" goto :emulator
goto :help

REM ---------------------------------------------------------------------------
:start
echo.
echo  Starting web services ...

where java >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Java not found on PATH.
  goto :end
)

REM each folder in its own window so logs stay visible
if exist "%ROOT%backend-java\target\samaj-drishti-api.jar" (
  start "SD API :5000" cmd /k "cd /d "%ROOT%backend-java" && java -jar target\samaj-drishti-api.jar"
  echo   - API on 5000
) else (
  echo   - API skipped (run: cd backend-java ^& mvn package -DskipTests)
)

if exist "%ROOT%ai-engine\.venv\Scripts\python.exe" (
  start "SD AI :5001" cmd /k "cd /d "%ROOT%ai-engine" && .venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 5001"
  echo   - AI engine on 5001
) else (
  echo   - AI engine skipped (no .venv)
)

if exist "%ROOT%admin\node_modules" (
  start "SD Dashboard :5173" cmd /k "cd /d "%ROOT%admin" && npm run dev"
  echo   - Dashboard on 5173
) else (
  echo   - Dashboard skipped (run: cd admin && npm install)
)

if exist "%ROOT%mobile-web\node_modules" (
  start "SD Field App :5174" cmd /k "cd /d "%ROOT%mobile-web" && npm run dev"
  echo   - Field app (PWA) on 5174
) else (
  echo   - Field app skipped (run: cd mobile-web && npm install)
)

echo.
echo  Started. Give it 10-20s, then:
echo    Dashboard  http://localhost:5173   (tap Admin)
echo    Field PWA  http://localhost:5174   (tap Field official)
echo.
goto :end

REM ---------------------------------------------------------------------------
:stop
echo Stopping services on 5000,5001,5173,5174 ...
powershell -NoProfile -Command "foreach ($p in 5000,5001,5173,5174) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; foreach ($x in $c) { Write-Host ('  stopping port '+$p+' (pid '+$x.OwningProcess+')'); Stop-Process -Id $x.OwningProcess -Force -ErrorAction SilentlyContinue } }"
if "%1"=="" (
  REM plain stop-all also shuts the emulator
  where adb >nul 2>&1
  if not errorlevel 1 (
    echo Stopping Android emulator ...
    "%ANDROID_HOME%\emulator\emulator.exe" -kill-all >nul 2>&1
  )
)
echo Done.
goto :end

REM ---------------------------------------------------------------------------
:status
echo.
echo  === Service status ===
for %%P in (5000 5001 5173 5174) do (
  powershell -NoProfile -Command "$c = Test-NetConnection -ComputerName 127.0.0.1 -Port %%P -WarningAction SilentlyContinue; if ($c.TCPTestSucceeded) { Write-Host ('  port %%P : UP')} else { Write-Host ('  port %%P : down') }"
)
echo.
echo  === Android emulator ===
where adb >nul 2>&1
if errorlevel 1 (
  echo   adb not on PATH
) else (
  adb devices | findstr /V "^$"
)
echo.
echo  Open:
echo   http://localhost:5173  (dashboard)
echo   http://localhost:5174  (field PWA)
goto :end

REM ---------------------------------------------------------------------------
:emulator
echo Booting Android emulator (AVD sd_api34) ...
REM quick hypervisor diagnostic up front
if not defined ANDROID_HOME set "ANDROID_HOME=%ROOT%tools\android"
if not exist "%ANDROID_HOME%\emulator\emulator.exe" (
  echo [ERROR] Emulator not installed. Run install-android.cmd first.
  goto :end
)
"%ANDROID_HOME%\emulator\emulator.exe" -avd sd_api34 -no-audio -no-snapshot
if errorlevel 1 (
  echo.
  echo  If the window above said "no accelerator / HAXM not working / WHPX unavailable":
  echo    Intel VT-x (or AMD-V) is disabled in your BIOS.
  echo    Reboot, enter BIOS (usually DEL/F2 at startup), enable
  echo    "Intel Virtualization Technology" (or "AMD-V"), save, reboot,
  echo    then re-run:  orchestrate.cmd emulator
)
goto :end

REM ---------------------------------------------------------------------------
:help
echo.
echo  orchestrate.cmd  [start|stop|status|emulator]
echo    start     launch backend, ai-engine, admin, mobile-web
echo    stop      stop all services (add a bare call to also kill the emulator)
echo    status    show listening ports + emulator devices
echo    emulator  boot the Android emulator (needs Intel VT-x enabled in BIOS)
goto :end

:end
endlocal
