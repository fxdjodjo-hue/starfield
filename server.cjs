require('dotenv').config(); // Load environment variables

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Sistema di logging
const { logger, messageCount } = require('./server/logger.cjs');

// Supabase client per il server
const supabaseUrl = process.env.SUPABASE_URL || 'https://euvlanwkqzhqnbwbvwis.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

console.log('🔍 [SERVER] SUPABASE CONFIG:');
console.log('   URL:', supabaseUrl);
console.log('   KEY starts with:', supabaseServiceKey.substring(0, 20) + '...');
console.log('   KEY length:', supabaseServiceKey.length);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database è configurato correttamente - le policy RLS sono applicate
console.log('✅ [SERVER] Database configured with service role access');

// Carica configurazioni centralizzate
const { SERVER_CONSTANTS, NPC_CONFIG } = require('./server/config/constants.cjs');

// Managers
const ServerNpcManager = require('./server/managers/npc-manager.cjs');
const ServerCombatManager = require('./server/managers/combat-manager.cjs');
const ServerProjectileManager = require('./server/managers/projectile-manager.cjs');

// Core
const MapServer = require('./server/core/map-server.cjs');
const WebSocketConnectionManager = require('./server/core/websocket-manager.cjs');


// Crea server HTTP per healthcheck e WebSocket sulla stessa porta
const PORT = process.env.PORT || 3000;
const http = require('http');

// Crea server HTTP
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Crea server WebSocket sullo stesso server HTTP
const wss = new WebSocket.Server({
  server: server,
  host: '0.0.0.0'
});

// Avvia il server sulla porta configurata
server.listen(parseInt(PORT), '0.0.0.0', () => {
  logger.info('SERVER', `🚀 Server started on 0.0.0.0:${PORT}`);
  logger.info('SERVER', `🌐 WebSocket available at ws://0.0.0.0:${PORT}`);
  logger.info('SERVER', `💚 Health check available at http://0.0.0.0:${PORT}/health`);
});

const PROCESS_INTERVAL = 50; // Processa aggiornamenti ogni 50ms

// Tick unificato MapServer (20 Hz - ogni 50ms)
setInterval(() => {
  mapServer.tick();
}, 50);

// Il messaggio di avvio è già nel callback di server.listen()


// Istanza della mappa principale
const mapServer = new MapServer('default_map');
mapServer.initialize();

// Aggiungi combat manager alla mappa
mapServer.combatManager = new ServerCombatManager(mapServer);

/**
 * Processa la queue degli aggiornamenti posizione per ridurre race conditions
 */




// Inizializza WebSocket Connection Manager
const wsManager = new WebSocketConnectionManager(wss, mapServer, messageCount);

// Gestisce chiusura server
process.on('SIGINT', () => {
  logger.info('SERVER', '🛑 Shutting down server...');

  // Lascia che il WebSocketManager gestisca la chiusura delle connessioni
  // Il WebSocketManager ha già configurato il suo SIGINT handler

  // Chiudi il server HTTP
  server.close(() => {
    logger.info('SERVER', '✅ Server shut down gracefully');
    process.exit(0);
  });
});
