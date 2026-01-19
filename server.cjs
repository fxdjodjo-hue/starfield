require('dotenv').config(); // Load environment variables

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Sistema di logging
const { logger, messageCount } = require('./server/logger.cjs');
const ServerLoggerWrapper = require('./server/core/infrastructure/ServerLoggerWrapper.cjs');

// Supabase client per il server
const supabaseUrl = process.env.SUPABASE_URL || 'https://euvlanwkqzhqnbwbvwis.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';


const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database è configurato correttamente - le policy RLS sono applicate

// Carica configurazioni centralizzate
const { SERVER_CONSTANTS, NPC_CONFIG } = require('./server/config/constants.cjs');

// Managers
const ServerNpcManager = require('./server/managers/npc-manager.cjs');
const ServerCombatManager = require('./server/managers/combat-manager.cjs');
const ServerProjectileManager = require('./server/managers/projectile-manager.cjs');
const RepairManager = require('./server/managers/repair-manager.cjs');

// Core
const MapServer = require('./server/core/map-server.cjs');
const WebSocketConnectionManager = require('./server/core/websocket-manager.cjs');


// Crea server HTTP per healthcheck e WebSocket sulla stessa porta
const PORT = process.env.PORT || 3000;
const http = require('http');

// Crea server HTTP con API endpoints sicuri
const server = http.createServer(async (req, res) => {
  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // API endpoints sicuri
  if (req.url?.startsWith('/api/')) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Parse URL
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(p => p);

      // POST /api/create-profile - Crea profilo giocatore
      if (pathParts[0] === 'api' && pathParts[1] === 'create-profile' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { username } = JSON.parse(body);

            // Verifica autenticazione
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }

            const token = authHeader.substring(7);

            // Verifica token con Supabase
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid token' }));
              return;
            }

            // Crea profilo usando RPC sicura
            const { data, error } = await supabase.rpc('create_player_profile', {
              auth_id_param: user.id,
              username_param: username
            });


            if (error) {
              ServerLoggerWrapper.warn('API', `RPC error creating player profile: ${error.message}`);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
              return;
            }

            // PostgreSQL RPC restituisce sempre un array, prendiamo il primo elemento
            const profileData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: profileData }));

          } catch (error) {
            ServerLoggerWrapper.error('API', `Exception in create-profile: ${error.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // GET /api/player-lazy-data/:authId - Ottieni dati lazy-loaded (inventory, upgrades, quests)
      if (pathParts[0] === 'api' && pathParts[1] === 'player-lazy-data' && req.method === 'GET') {
        const authId = pathParts[2];

        if (!authId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid auth ID' }));
          return;
        }

        // Verifica autenticazione
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {

          // Usa la RPC consolidata per ottenere SOLO i dati lazy
          const { data, error } = await supabase.rpc('get_player_complete_data_secure', {
            auth_id_param: authId
          });

          if (error) {
            ServerLoggerWrapper.warn('API', `Lazy data RPC error: ${error.message}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
            return;
          }

          // Estrai solo i dati lazy-loaded
          const lazyData = Array.isArray(data) && data.length > 0 ? data[0] : data;

          const response = {
            inventory: lazyData.currencies_data ? JSON.parse(lazyData.currencies_data) : { credits: 1000, cosmos: 100, experience: 0, honor: 0, skill_points_current: 0, skill_points_total: 0 },
            upgrades: lazyData.upgrades_data ? JSON.parse(lazyData.upgrades_data) : { hpUpgrades: 0, shieldUpgrades: 0, speedUpgrades: 0, damageUpgrades: 0 },
            quests: lazyData.quests_data ? JSON.parse(lazyData.quests_data) : []
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: response }));

        } catch (error) {
          ServerLoggerWrapper.error('API', `Exception in lazy-data: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // GET /api/player-data/:authId - Ottieni dati giocatore
      if (pathParts[0] === 'api' && pathParts[1] === 'player-data' && req.method === 'GET') {
        const authId = pathParts[2];

        if (!authId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid auth ID' }));
          return;
        }

        // Verifica autenticazione
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          // Usa RPC sicura per ottenere dati
          const { data, error } = await supabase.rpc('get_player_data_secure', {
            auth_id_param: authId
          });

          if (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
            return;
          }

          // Trasforma i dati JSONB in oggetti
          const playerData = {
            profile: data.profile_data ? JSON.parse(data.profile_data) : null,
            stats: data.stats_data ? JSON.parse(data.stats_data) : null,
            upgrades: data.upgrades_data ? JSON.parse(data.upgrades_data) : null,
            currencies: data.currencies_data ? JSON.parse(data.currencies_data) : null,
            quests: data.quests_data ? JSON.parse(data.quests_data) : []
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: playerData }));

        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // PUT /api/player-data/:authId - Salva dati giocatore
      if (pathParts[0] === 'api' && pathParts[1] === 'player-data' && req.method === 'PUT') {
        const authId = pathParts[2];

        if (!authId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid auth ID' }));
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const playerData = JSON.parse(body);

            // Usa RPC sicura per salvare dati
            const { data, error } = await supabase.rpc('update_player_data_secure', {
              auth_id_param: authId,
              stats_data: playerData.stats ? JSON.stringify(playerData.stats) : null,
              upgrades_data: playerData.upgrades ? JSON.stringify(playerData.upgrades) : null,
              currencies_data: playerData.currencies ? JSON.stringify(playerData.currencies) : null,
              quests_data: playerData.quests ? JSON.stringify(playerData.quests) : null
            });

            if (error) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: { success: true } }));

          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
      return;
    }
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Crea server WebSocket sullo stesso server HTTP
const wss = new WebSocket.Server({
  server: server,
  host: '0.0.0.0'
});

// Avvia il server sulla porta configurata
server.listen(parseInt(PORT), '0.0.0.0', () => {
  ServerLoggerWrapper.info('SERVER', `Server started on port ${PORT} with WebSocket and health check endpoints`);
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

// Aggiungi repair manager alla mappa
mapServer.repairManager = new RepairManager(mapServer);

ServerLoggerWrapper.info('SERVER', 'Map system initialized with combat and repair managers');

/**
 * Processa la queue degli aggiornamenti posizione per ridurre race conditions
 */




// Inizializza WebSocket Connection Manager
const wsManager = new WebSocketConnectionManager(wss, mapServer, messageCount);
// Collega websocketManager a mapServer per accesso dai managers
mapServer.websocketManager = wsManager;

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
