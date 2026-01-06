#!/usr/bin/env node

/**
 * Starfield Online Server Launcher
 * Avvia il server di gioco e crea automaticamente un tunnel ngrok per giocare con amici
 */

const { spawn } = require('child_process');
const ngrok = require('ngrok');

const SERVER_PORT = 3000;

async function startOnlineServer() {
  console.log('🚀 Avvio Starfield Online Server...');
  console.log('🌐 Creazione tunnel pubblico con ngrok...\n');

  try {
    // Avvia il server di gioco
    console.log('🎮 Avvio server di gioco...');
    const serverProcess = spawn('node', ['server.cjs'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Aspetta un po' che il server si avvii
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Crea tunnel ngrok
    console.log('🔗 Creazione tunnel ngrok...');
    const url = await ngrok.connect({
      proto: 'http',
      addr: SERVER_PORT,
      region: 'eu' // Europa per latenza minore
    });

    console.log('\n🎉 === STARFIELD ONLINE PRONTO! === 🎉');
    console.log('🌐 URL da condividere con gli amici:');
    console.log(`   ${url}`);
    console.log('\n📋 Istruzioni per gli amici:');
    console.log('   1. Aprire il browser');
    console.log('   2. Andare all\'URL sopra');
    console.log('   3. Inserire un nickname');
    console.log('   4. Giocare insieme!');
    console.log('\n⚠️  Premi Ctrl+C per fermare il server');
    console.log('🔄 Il tunnel si chiuderà automaticamente\n');

    // Gestisci chiusura pulita
    process.on('SIGINT', async () => {
      console.log('\n🛑 Chiusura server e tunnel...');
      serverProcess.kill();
      await ngrok.disconnect();
      await ngrok.kill();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Chiusura server e tunnel...');
      serverProcess.kill();
      await ngrok.disconnect();
      await ngrok.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Errore nell\'avvio del server online:', error.message);
    console.log('\n💡 Possibili soluzioni:');
    console.log('   1. Assicurati che ngrok sia installato: npm install -g ngrok');
    console.log('   2. Registra un account gratuito su ngrok.com per tunnel stabili');
    console.log('   3. Controlla che la porta 3000 sia libera');
    process.exit(1);
  }
}

// Avvia tutto
startOnlineServer().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});
