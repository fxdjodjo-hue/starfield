#!/usr/bin/env node

/**
 * Starfield Online Server Launcher
 * Avvia il server di gioco e crea automaticamente un tunnel ngrok per giocare con amici
 */

const { spawn } = require('child_process');
const ngrok = require('ngrok');

const SERVER_PORT = 3000;

async function checkNgrok() {
  return new Promise((resolve) => {
    const ngrokProcess = spawn('ngrok', ['version'], { stdio: 'pipe' });
    ngrokProcess.on('close', (code) => {
      resolve(code === 0);
    });
    ngrokProcess.on('error', () => {
      resolve(false);
    });
  });
}

async function startOnlineServer() {

  // Verifica se ngrok è installato
  const ngrokAvailable = await checkNgrok();

  if (!ngrokAvailable) {
    return;
  }


  try {
    // Avvia il server di gioco
    const serverProcess = spawn('node', ['server.cjs'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Aspetta un po' che il server si avvii
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Crea tunnel ngrok
    const url = await ngrok.connect({
      proto: 'http',
      addr: SERVER_PORT,
      region: 'eu' // Europa per latenza minore
    });


    // Gestisci chiusura pulita
    process.on('SIGINT', async () => {
      serverProcess.kill();
      try {
        await ngrok.disconnect();
        await ngrok.kill();
      } catch (e) {
        // Ignora errori durante la chiusura
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      serverProcess.kill();
      try {
        await ngrok.disconnect();
        await ngrok.kill();
      } catch (e) {
        // Ignora errori durante la chiusura
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Errore nell\'avvio del server online:', error.message);
    process.exit(1);
  }
}

// Avvia tutto
startOnlineServer().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});
