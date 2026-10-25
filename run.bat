@echo off
setlocal EnableExtensions
title KODE_FINAL Setup

REM ============================================================
REM  KODE_FINAL - Windows Setup & Run Script
REM
REM  Usage:
REM    run.bat          Install dependencies, start backend, open browser
REM    run.bat --check  CI mode: install dependencies, verify server boots
REM ============================================================

pushd "%~dp0SoftDev\backend" || goto :fail

echo.
echo [1/4] Checking Node.js installation...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo         Download the LTS version from https://nodejs.org, then run this file again.
    goto :fail
)
for /f "delims=" %%v in ('node --version') do set "NODE_VERSION=%%v"
echo        Found Node.js %NODE_VERSION%
echo.

echo [2/4] Installing backend dependencies. This may take a minute...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo [ERROR] npm install failed.
    echo         - Check your internet connection, then run this file again.
    echo         - If you see node-gyp or MSBuild errors, install the Node.js LTS
    echo           version from https://nodejs.org - it ships prebuilt binaries.
    goto :fail
)
echo.

echo [3/4] Preparing .env configuration...
if exist ".env" (
    echo        Existing .env found - keeping it.
    goto :env_ready
)
(
    echo PORT=3000
    echo API_KEY=KODE_IOT_SECRET_KEY_2024
) > ".env"
echo        Created .env with default settings.
:env_ready
echo.

if /i "%~1"=="--check" goto :ci_check

echo [4/4] Starting server - backend API + frontend dashboard on http://localhost:3000 ...
echo        Keep this window open. Press Ctrl+C to stop the server.
echo.
start "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"
call npm start
goto :done

REM ------------------------------------------------------------
REM  CI CHECK MODE - executed by GitHub Actions on windows-latest
REM  Boots the server, polls /api/health, then shuts down cleanly.
REM ------------------------------------------------------------
:ci_check
echo [4/4] CI mode: booting server and polling /api/health ...
powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList 'server.js' -PassThru -RedirectStandardOutput 'server-out.log' -RedirectStandardError 'server-err.log'; Set-Content -Path '.server.pid' -Value $p.Id"
set /a POLL_TRIES=0

:poll_loop
ping -n 3 127.0.0.1 >nul
curl -s -f --max-time 5 -o nul http://localhost:3000/api/health
if not errorlevel 1 goto :ci_ok
set /a POLL_TRIES+=1
if %POLL_TRIES% lss 15 goto :poll_loop
echo [ERROR] Server did not respond on http://localhost:3000/api/health within 30 seconds.
if exist "server-err.log" type "server-err.log"
goto :ci_fail

:ci_ok
echo        Server responded OK on /api/health.
curl -s -f --max-time 5 -o nul http://localhost:3000/
if errorlevel 1 (
    echo [ERROR] Frontend did not respond on http://localhost:3000/
    goto :ci_fail
)
echo        Frontend responded OK on http://localhost:3000/
call :kill_server
echo [OK] All checks passed - run.bat works on Windows.
goto :done

:ci_fail
call :kill_server
goto :fail

:kill_server
if not exist ".server.pid" goto :kill_done
for /f "usebackq delims=" %%p in (".server.pid") do taskkill /pid %%p /t /f >nul 2>nul
del ".server.pid" >nul 2>nul
:kill_done
if exist "server-out.log" del "server-out.log" >nul 2>nul
if exist "server-err.log" del "server-err.log" >nul 2>nul
exit /b 0

:fail
popd 2>nul
echo.
echo [FAILED] Setup did not complete. See messages above.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1

:done
popd 2>nul
endlocal
exit /b 0
