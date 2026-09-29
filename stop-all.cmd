@echo off
REM ---------------------------------------------------------------------
REM  Samaj Drishti - stop every service started by start-all.cmd
REM ---------------------------------------------------------------------
echo Stopping Samaj Drishti services...

powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($port in 5000,5001,5173,5174) { $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; foreach ($conn in $conns) { Write-Host ('  stopping port ' + $port + '  (pid ' + $conn.OwningProcess + ')'); Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } }"

echo.
echo All Samaj Drishti services are stopped.
echo.
pause

