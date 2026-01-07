@echo off
echo ============================================
echo    🌟 AVVIO COMPLETO STARFIELD
echo    (Server + Client in locale)
echo ============================================
echo.

cd /d "%~dp0"

echo Avvio server in background...
start "Starfield Server" cmd /c "node server.cjs"

echo Attendo che il server sia pronto...
timeout /t 3 /nobreak > nul

echo Avvio client...
start "Starfield Client" cmd /c "npm run dev"

echo Attendo che il client sia pronto...
timeout /t 5 /nobreak > nul

echo Apertura browser...
start http://localhost:5173

echo.
echo ============================================
echo    ✅ Tutto avviato!
echo    - Server: localhost:3000
echo    - Client: localhost:5173
echo ============================================
echo.
echo Premi un tasto per chiudere (server e client continuano in background)...
pause > nul

