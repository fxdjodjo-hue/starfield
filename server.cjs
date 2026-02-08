require('dotenv').config(); // Load environment variables

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { createSupabaseClient, validateSupabaseEnv } = require('./server/config/supabase.cjs');

// Sistema di logging
const { logger, messageCount } = require('./server/logger.cjs');
const ServerLoggerWrapper = require('./server/core/infrastructure/ServerLoggerWrapper.cjs');

// Supabase client per il server (fail-fast se env mancante)
validateSupabaseEnv();
const supabase = createSupabaseClient();

// Database è configurato correttamente - le policy RLS sono applicate

// Carica configurazioni centralizzate
const { SERVER_CONSTANTS, NPC_CONFIG } = require('./server/config/constants.cjs');

// Managers
const ServerNpcManager = require('./server/managers/npc-manager.cjs');
const ServerCombatManager = require('./server/managers/combat-manager.cjs');
const ServerProjectileManager = require('./server/managers/projectile-manager.cjs');
const RepairManager = require('./server/managers/repair-manager.cjs');
const HazardManager = require('./server/managers/hazard-manager.cjs');

// Core
const MapServer = require('./server/core/map-server.cjs');
const MapManager = require('./server/core/MapManager.cjs');
const WebSocketConnectionManager = require('./server/core/websocket-manager.cjs');
const FixedLoop = require('./server/core/infrastructure/FixedLoop.cjs');


// Crea server HTTP per healthcheck e WebSocket sulla stessa porta
const PORT = process.env.PORT || 3000;
const IS_PLAYTEST = process.env.IS_PLAYTEST === 'true';
const PLAYTEST_CODE = process.env.PLAYTEST_CODE;
const MAX_ACCOUNTS = parseInt(process.env.MAX_ACCOUNTS || '20');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const AUTH_AUDIT_LOGS = process.env.AUTH_AUDIT_LOGS === 'true';

// Simple in-memory rate limiter for login/register
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const userData = rateLimitMap.get(ip) || { count: 0, firstRequest: now };

  if (now - userData.firstRequest > RATE_LIMIT_WINDOW) {
    userData.count = 1;
    userData.firstRequest = now;
  } else {
    userData.count++;
  }

  rateLimitMap.set(ip, userData);
  return userData.count <= MAX_REQUESTS_PER_WINDOW;
}

async function auditAuthIdMismatch(req, authId, contextLabel) {
  if (!AUTH_AUDIT_LOGS) return;
  const authHeader = req.headers.authorization;
  const ip = req.socket?.remoteAddress || 'unknown';
  if (!authHeader?.startsWith('Bearer ')) {
    ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] Missing Bearer token for ${contextLabel} authId=${authId} ip=${ip}`);
    return;
  }

  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] Invalid token for ${contextLabel} authId=${authId} ip=${ip} error=${error?.message || 'unknown'}`);
      return;
    }

    if (user.id !== authId) {
      ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] authId mismatch for ${contextLabel} authId=${authId} tokenUser=${user.id} ip=${ip}`);
    }
  } catch (error) {
    ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] Token verification failed for ${contextLabel} authId=${authId} ip=${ip} error=${error.message}`);
  }
}

const http = require('http');

// Crea server HTTP con API endpoints sicuri
const server = http.createServer(async (req, res) => {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle global OPTIONS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // API endpoints sicuri
  if (req.url?.startsWith('/api/')) {
    try {
      // Parse URL
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(p => p);

      // POST /api/create-profile - Crea profilo giocatore
      if (pathParts[0] === 'api' && pathParts[1] === 'create-profile' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        if (!checkRateLimit(ip)) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { username, playtestCode } = JSON.parse(body);

            // PLAYTEST GATE: Verify playtest code if enabled
            if (IS_PLAYTEST && PLAYTEST_CODE) {
              if (playtestCode !== PLAYTEST_CODE) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid playtest code.' }));
                return;
              }
            }

            // PLAYTEST GATE: Check max accounts
            if (IS_PLAYTEST) {
              const { count, error: countError } = await supabase
                .from('players')
                .select('*', { count: 'exact', head: true });

              if (!countError && count >= MAX_ACCOUNTS) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Maximum account limit reached for this playtest.' }));
                return;
              }
            }

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

      // POST /api/verify-playtest-code - Verifica codice accesso playtest
      if (pathParts[0] === 'api' && pathParts[1] === 'verify-playtest-code' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { code } = JSON.parse(body);
            if (!IS_PLAYTEST || !PLAYTEST_CODE) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (code === PLAYTEST_CODE) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } else {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Invalid playtest code' }));
            }
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
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
          await auditAuthIdMismatch(req, authId, 'GET /api/player-lazy-data');

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
            inventory: lazyData.currencies_data ? JSON.parse(lazyData.currencies_data) : { credits: 1000, cosmos: 100, experience: 0, honor: 0 },
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
          await auditAuthIdMismatch(req, authId, 'GET /api/player-data');
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

          res.end(JSON.stringify({ data: playerData }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // POST /api/player-data/:authId/quest-progress - Aggiorna progresso quest specifica
      if (pathParts[0] === 'api' && pathParts[1] === 'player-data' && pathParts[3] === 'quest-progress' && req.method === 'POST') {
        const authId = pathParts[2];

        if (!authId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid auth ID' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            await auditAuthIdMismatch(req, authId, 'POST /api/player-data/:authId/quest-progress');
            if (!body) throw new Error('Empty request body');
            const { questId, progress } = JSON.parse(body);

            // 1. Fetch current data
            const { data: rawData, error: fetchError } = await supabase.rpc('get_player_data_secure', {
              auth_id_param: authId
            });

            if (fetchError) throw fetchError;
            const currentData = Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : rawData;

            // 2. Parse existing quests
            let quests = {};
            if (currentData && currentData.quests_data) {
              quests = typeof currentData.quests_data === 'string'
                ? JSON.parse(currentData.quests_data)
                : currentData.quests_data;
            }

            // Migration handling
            if (Array.isArray(quests)) {
              const questsMap = {};
              quests.forEach(q => { if (q.id || q.quest_id) questsMap[q.id || q.quest_id] = q; });
              quests = questsMap;
            }

            // NEW: Fetch Quest Config for rewards
            const QUESTS_CONFIG = require(`./shared/quests.json`);

            // 3. Update specific quest and check for completion reward
            const wasCompletedBefore = quests[questId]?.is_completed || false;
            const isNewlyCompleted = progress.is_completed && !wasCompletedBefore;

            quests[questId] = { id: questId, ...progress };

            // 4. Authoritative table save
            await supabase.from('quest_progress').upsert({
              auth_id: authId,
              quest_id: questId,
              objectives: progress.objectives || [],
              is_completed: progress.is_completed || false,
              started_at: progress.started_at || new Date().toISOString(),
              completed_at: progress.completed_at || (progress.is_completed ? new Date().toISOString() : null)
            }, { onConflict: 'auth_id,quest_id' });

            // 5. Award rewards if newly completed
            let currenciesUpdated = false;
            if (isNewlyCompleted) {
              const questConfig = QUESTS_CONFIG[questId];
              if (questConfig && questConfig.rewards) {
                ServerLoggerWrapper.info('REWARDS', `Quest ${questId} completed! Awarding rewards to ${authId}`);

                // Initialize currencies if missing
                if (!currentData.currencies_data) {
                  currentData.currencies_data = { credits: 0, cosmos: 0, experience: 0, honor: 0 };
                }

                // Apply each reward
                questConfig.rewards.forEach(reward => {
                  const type = reward.type.toLowerCase();
                  const amount = Number(reward.amount || 0);

                  if (type === 'credits') currentData.currencies_data.credits = (Number(currentData.currencies_data.credits) || 0) + amount;
                  else if (type === 'cosmos') currentData.currencies_data.cosmos = (Number(currentData.currencies_data.cosmos) || 0) + amount;
                  else if (type === 'experience') currentData.currencies_data.experience = (Number(currentData.currencies_data.experience) || 0) + amount;
                  else if (type === 'honor') currentData.currencies_data.honor = (Number(currentData.currencies_data.honor) || 0) + amount;
                });

                currenciesUpdated = true;
              }
            }

            // 6. Update JSON columns
            await supabase.rpc('update_player_data_secure', {
              auth_id_param: authId,
              stats_data: currentData.stats_data,
              upgrades_data: currentData.upgrades_data,
              currencies_data: currentData.currencies_data,
              quests_data: JSON.stringify(quests),
              profile_data: currentData.profile_data,
              position_data: currentData.position_data
            });

            // 7. Sincronizzazione Memoria Game Server (se il player è online)
            if (typeof mapServer !== 'undefined' && mapServer.players) {
              const playerInMemory = Array.from(mapServer.players.values()).find(p => p.userId === authId);
              if (playerInMemory) {
                // Sync quests
                if (!playerInMemory.quests) playerInMemory.quests = [];
                if (Array.isArray(playerInMemory.quests)) {
                  const idx = playerInMemory.quests.findIndex(q => (q.id || q.quest_id) === questId);
                  const questObj = { id: questId, quest_id: questId, ...progress };
                  if (idx >= 0) playerInMemory.quests[idx] = questObj;
                  else playerInMemory.quests.push(questObj);
                }

                // Sync currencies if updated
                if (currenciesUpdated) {
                  playerInMemory.inventory = {
                    ...playerInMemory.inventory,
                    ...currentData.currencies_data
                  };

                  // Notify client about state update
                  if (playerInMemory.ws && playerInMemory.ws.readyState === WebSocket.OPEN) {
                    playerInMemory.ws.send(JSON.stringify({
                      type: 'player_state_update',
                      inventory: playerInMemory.inventory,
                      source: `quest_complete_${questId}`
                    }));
                  }
                }

                ServerLoggerWrapper.info('API', `Quest memory and rewards synchronized for user ${authId}`);
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: { success: true } }));
          } catch (error) {
            ServerLoggerWrapper.error('API', `Exception in POST quest-progress: ${error.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // DELETE /api/player-data/:authId/quest-progress - Rimuovi progresso quest (abbandono)
      if (pathParts[0] === 'api' && pathParts[1] === 'player-data' && pathParts[3] === 'quest-progress' && req.method === 'DELETE') {
        const authId = pathParts[2];
        const questId = url.searchParams.get('questId');

        if (!authId || !questId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing authId or questId' }));
          return;
        }

        try {
          await auditAuthIdMismatch(req, authId, 'DELETE /api/player-data/:authId/quest-progress');
          ServerLoggerWrapper.info('API', `Deleting quest ${questId} for user ${authId}`);

          // 1. Rimuovi dalla tabella quest_progress
          const { error: deleteError } = await supabase
            .from('quest_progress')
            .delete()
            .match({ auth_id: authId, quest_id: questId });

          if (deleteError) {
            throw new Error(`Table delete error: ${deleteError.message}`);
          }

          // 2. Aggiorna il JSON cache in players table
          const { data: rawData, error: fetchError } = await supabase.rpc('get_player_data_secure', {
            auth_id_param: authId
          });

          if (fetchError) throw fetchError;
          const currentData = Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : rawData;

          if (currentData && currentData.quests_data) {
            let quests = typeof currentData.quests_data === 'string'
              ? JSON.parse(currentData.quests_data)
              : currentData.quests_data;

            // Handle array vs object
            if (Array.isArray(quests)) {
              quests = quests.filter(q => (q.id || q.quest_id) !== questId);
            } else {
              delete quests[questId];
            }

            // Salva JSON aggiornato
            await supabase.rpc('update_player_data_secure', {
              auth_id_param: authId,
              stats_data: currentData.stats_data,
              upgrades_data: currentData.upgrades_data,
              currencies_data: currentData.currencies_data,
              quests_data: JSON.stringify(quests),
              profile_data: currentData.profile_data,
              position_data: currentData.position_data
            });

            // 3. Sincronizzazione Memoria Game Server (se il player è online)
            if (typeof mapServer !== 'undefined' && mapServer.players) {
              const playerInMemory = Array.from(mapServer.players.values()).find(p => p.userId === authId);
              if (playerInMemory && playerInMemory.quests) {
                if (Array.isArray(playerInMemory.quests)) {
                  playerInMemory.quests = playerInMemory.quests.filter(q => (q.id || q.quest_id) !== questId);
                }
                ServerLoggerWrapper.info('API', `Quest memory synchronized (DELETE) for user ${authId}`);
              }
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: { success: true } }));

        } catch (error) {
          ServerLoggerWrapper.error('API', `Exception in delete quest-progress: ${error.message}`);
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
            await auditAuthIdMismatch(req, authId, 'PUT /api/player-data/:authId');
            const playerData = JSON.parse(body);

            // Usa RPC sicura per salvare dati
            const { data, error } = await supabase.rpc('update_player_data_secure', {
              auth_id_param: authId,
              stats_data: playerData.stats ? JSON.stringify(playerData.stats) : null,
              upgrades_data: playerData.upgrades ? JSON.stringify(playerData.upgrades) : null,
              currencies_data: playerData.currencies ? JSON.stringify(playerData.currencies) : null,
              quests_data: playerData.quests ? JSON.stringify(playerData.quests) : null,
              profile_data: playerData.profile ? JSON.stringify(playerData.profile) : null,
              position_data: playerData.position ? JSON.stringify(playerData.position) : null
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

// ...

// Initialize MapManager (which initializes all MapServers)
MapManager.initializeMaps();

// Tick unificato MapManager con FixedLoop (20 Hz)
const serverLoop = new FixedLoop(20, () => {
  MapManager.tick();
});

serverLoop.start();

// Inizializza WebSocket Connection Manager
// Passiamo MapManager invece di mapServer
const wsManager = new WebSocketConnectionManager(wss, MapManager, messageCount);

// Default map for initial join sync (backward compatibility for managers that expect a mapServer)
const defaultMap = MapManager.getMap('default_map');
if (defaultMap) {
  // Inizializza i manager per ogni mappa (se non inizializzati internamente)
  // Nota: Sarebbe meglio se MapServer li inizializzasse internamente, verifichiamo MapServer.cjs
}

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

// Global Error Handling to prevent crashes
process.on('uncaughtException', (error) => {
  ServerLoggerWrapper.error('FATAL', `Uncaught Exception: ${error.message}`);
  ServerLoggerWrapper.error('FATAL', error.stack);
  // Optional: Graceful shutdown or alert
});

process.on('unhandledRejection', (reason, promise) => {
  ServerLoggerWrapper.error('FATAL', `Unhandled Rejection at: ${promise}, reason: ${reason}`);
});
