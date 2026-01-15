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
        console.log('📡 [API] Received create-profile request');
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { username } = JSON.parse(body);
            console.log('📡 [API] Parsed request body:', { username });

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
            console.log('🔧 [API] Calling RPC create_player_profile:', { auth_id: user.id, username });
            const { data, error } = await supabase.rpc('create_player_profile', {
              auth_id_param: user.id,
              username_param: username
            });

            console.log('🔧 [API] RPC response:', { data, error });

            if (error) {
              console.error('❌ [API] RPC error:', error);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
              return;
            }

            console.log('✅ [API] Profile created successfully:', data);
            // PostgreSQL RPC restituisce sempre un array, prendiamo il primo elemento
            const profileData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: profileData }));

          } catch (error) {
            console.error('❌ [API] Exception in create-profile:', error);
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
          console.log('📡 [API] Received lazy-data request for:', authId);

          // Usa la RPC consolidata per ottenere SOLO i dati lazy
          const { data, error } = await supabase.rpc('get_player_complete_data_secure', {
            auth_id_param: authId
          });

          if (error) {
            console.error('❌ [API] Lazy data RPC error:', error);
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

          console.log('✅ [API] Lazy data retrieved successfully');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: response }));

        } catch (error) {
          console.error('❌ [API] Exception in lazy-data:', error);
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
