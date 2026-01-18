@echo off
echo ============================================
echo    🚀 AVVIO SERVER STARFIELD
echo ============================================
echo.

cd /d "%~dp0"

echo Attivo Global Game Monitor...
set GLOBAL_MONITOR=true

echo Avvio server Node.js...
node server.cjs

echo.
echo Server fermato. Premi un tasto per chiudere...
pause > nul





