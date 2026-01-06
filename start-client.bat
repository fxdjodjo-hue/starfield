@echo off
echo ============================================
echo    🎮 AVVIO CLIENT STARFIELD
echo ============================================
echo.

cd /d "%~dp0"

echo Avvio client Vite...
start "" npm run dev

echo.
echo Attendo che il server sia pronto...
timeout /t 5 /nobreak > nul

echo Apertura browser...
start http://localhost:5173

echo.
echo Client avviato! Premi Ctrl+C nella finestra del terminale per fermare.
echo.
