const WebSocket = require('ws');

// Import ServerNpcManager (usando require per compatibilità)
let ServerNpcManager;
try {
  // In produzione il file sarà compilato
  ServerNpcManager = require('./server/npc/ServerNpcManager.ts');
} catch (e) {
  // Fallback per development - simuliamo la classe base
  ServerNpcManager = class {
    constructor() { this.npcs = new Map(); }
    createNpc(type, x, y) {
      const id = `npc_${Math.random().toString(36).substr(2, 9)}`;
      const npc = {
        id,
        type,
        position: { x: x || Math.random() * 20000, y: y || Math.random() * 12500, rotation: 0 },
        health: type === 'Scouter' ? 800 : 1200,
        maxHealth: type === 'Scouter' ? 800 : 1200,
        shield: type === 'Scouter' ? 560 : 840,
        maxShield: type === 'Scouter' ? 560 : 840,
        behavior: 'cruise',
        lastUpdate: Date.now()
      };
      this.npcs.set(id, npc);
      console.log(`🆕 [SERVER] Created NPC ${id} (${type})`);
      return id;
    }
    getAllNpcs() { return Array.from(this.npcs.values()); }
    getNpcsNeedingUpdate(since) {
      return this.getAllNpcs().filter(npc => npc.lastUpdate > since);
    }
  };
}

// Crea server WebSocket sulla porta 3000
const wss = new WebSocket.Server({ port: 3000 });

// Stato dei giocatori connessi
const connectedPlayers = new Map();

// Gestione NPC centralizzata
const npcManager = new ServerNpcManager();

// Queue per aggiornamenti posizione per ridurre race conditions
const positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti
const PROCESS_INTERVAL = 50; // Processa aggiornamenti ogni 50ms

// Processa la queue degli aggiornamenti posizione
setInterval(() => {
  processPositionUpdates();
}, PROCESS_INTERVAL);

console.log('🚀 WebSocket server started on ws://localhost:3000');

/**
 * Processa la queue degli aggiornamenti posizione per ridurre race conditions
 */
// Inizializza NPC del mondo
npcManager.initializeWorldNpcs(25, 25); // 25 Scouter + 25 Frigate

function processPositionUpdates() {
  // Per ogni client che ha aggiornamenti in queue
  for (const [clientId, updates] of positionUpdateQueue) {
    if (updates.length === 0) continue;

    // Prendi l'ultimo aggiornamento (più recente)
    const latestUpdate = updates[updates.length - 1];

    // Broadcasting: inoltra l'ultimo aggiornamento a tutti gli altri client
    const positionBroadcast = {
      type: 'remote_player_update',
      clientId: clientId,
      position: latestUpdate.position,
      rotation: latestUpdate.rotation,
      tick: latestUpdate.tick,
      nickname: latestUpdate.nickname,
      playerId: latestUpdate.playerId
    };

    // Invia a tutti i client connessi tranne quello che ha inviato l'aggiornamento
    let broadcastCount = 0;
    wss.clients.forEach(client => {
      if (client !== latestUpdate.senderWs && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(positionBroadcast));
        broadcastCount++;
      }
    });

    if (broadcastCount > 0) {
      console.log(`📡 [SERVER] Broadcasted position update from ${clientId} to ${broadcastCount} clients`);
    }

    // Svuota la queue per questo client
    positionUpdateQueue.delete(clientId);
  }
}

// Broadcasting NPC periodico (ogni 200ms)
function broadcastNpcUpdates() {
  const npcsToUpdate = npcManager.getNpcsNeedingUpdate(Date.now() - 1000); // NPC aggiornati negli ultimi 1s

  if (npcsToUpdate.length === 0) return;

  const npcBulkUpdate = {
    type: 'npc_bulk_update',
    npcs: npcsToUpdate.map(npc => ({
      id: npc.id,
      position: npc.position,
      health: { current: npc.health, max: npc.maxHealth },
      behavior: npc.behavior
    })),
    timestamp: Date.now()
  };

  // Broadcast a tutti i client connessi
  let broadcastCount = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(npcBulkUpdate));
      broadcastCount++;
    }
  });

  if (broadcastCount > 0) {
    console.log(`🌍 [SERVER] Broadcasted ${npcsToUpdate.length} NPC updates to ${broadcastCount} clients`);
  }
}

// Sistema di movimento NPC semplice (server-side)
function updateNpcMovements() {
  const allNpcs = npcManager.getAllNpcs();

  for (const npc of allNpcs) {
    // Movimento semplice basato sul comportamento
    switch (npc.behavior) {
      case 'cruise':
        // Movimento lineare semplice
        npc.position.x += Math.cos(npc.position.rotation) * 50 * 0.016; // 50 units/second * deltaTime
        npc.position.y += Math.sin(npc.position.rotation) * 50 * 0.016;
        break;

      case 'aggressive':
        // Movimento più veloce quando aggressivi
        npc.position.x += Math.cos(npc.position.rotation) * 100 * 0.016;
        npc.position.y += Math.sin(npc.position.rotation) * 100 * 0.016;
        break;

      case 'flee':
        // Movimento di fuga (indietro)
        npc.position.x -= Math.cos(npc.position.rotation) * 80 * 0.016;
        npc.position.y -= Math.sin(npc.position.rotation) * 80 * 0.016;
        break;
    }

    // Rotazione casuale occasionale per rendere il movimento più naturale
    if (Math.random() < 0.02) { // 2% probabilità ogni frame
      npc.position.rotation += (Math.random() - 0.5) * 0.5; // ±0.25 radianti
    }

    // Mantieni rotazione in range [0, 2π]
    npc.position.rotation = ((npc.position.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    npc.lastUpdate = Date.now();
  }
}

// Avvia movimento NPC (60 FPS)
setInterval(updateNpcMovements, 1000 / 60);

// Avvia broadcasting NPC
setInterval(broadcastNpcUpdates, 200);

wss.on('connection', (ws) => {
  console.log('✅ New client connected');
  let playerData = null;

  // Gestisce messaggi dal client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Risponde ai messaggi di join
      if (data.type === 'join') {
        playerData = {
          clientId: data.clientId,
          nickname: data.nickname,
          playerId: data.playerId,
          userId: data.userId,
          connectedAt: new Date().toISOString(),
          lastInputAt: null
        };

        connectedPlayers.set(data.clientId, playerData);

        console.log(`🎮 [SERVER] Player joined: ${data.clientId}`);
        console.log(`   📝 Nickname: ${data.nickname}`);
        console.log(`   🔢 Player ID: ${data.playerId}`);
        console.log(`   👤 User ID: ${data.userId}`);
        console.log(`👥 [SERVER] Total connected players: ${connectedPlayers.size}`);

        // Notifica a tutti gli altri giocatori che è arrivato un nuovo player
        const newPlayerBroadcast = {
          type: 'player_joined',
          clientId: data.clientId,
          nickname: data.nickname,
          playerId: data.playerId
        };

        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(newPlayerBroadcast));
          }
        });

        // Invia le posizioni di tutti i giocatori già connessi al nuovo giocatore
        connectedPlayers.forEach((playerData, existingClientId) => {
          if (existingClientId !== data.clientId && playerData.position) {
            const existingPlayerBroadcast = {
              type: 'remote_player_update',
              clientId: existingClientId,
              position: playerData.position,
              rotation: 0,
              tick: 0,
              nickname: playerData.nickname,
              playerId: playerData.playerId
            };
            ws.send(JSON.stringify(existingPlayerBroadcast));
            console.log(`📍 [SERVER] Sent position of existing player ${existingClientId} to new player ${data.clientId}`);
          }
        });

        // Invia tutti gli NPC esistenti al nuovo giocatore
        const allNpcs = npcManager.getAllNpcs();
        if (allNpcs.length > 0) {
          const initialNpcsMessage = {
            type: 'initial_npcs',
            npcs: allNpcs.map(npc => ({
              id: npc.id,
              type: npc.type,
              position: npc.position,
              health: { current: npc.health, max: npc.maxHealth },
              shield: { current: npc.shield, max: npc.maxShield },
              behavior: npc.behavior
            })),
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(initialNpcsMessage));
          console.log(`🌍 [SERVER] Sent ${allNpcs.length} initial NPCs to new player ${data.clientId}`);
        }

        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: data.clientId,
          message: `Welcome ${data.nickname}! Connected to server.`
        }));

        // Invia la posizione del nuovo giocatore a tutti gli altri giocatori
        if (data.position) {
          const newPlayerPositionBroadcast = {
            type: 'remote_player_update',
            clientId: data.clientId,
            position: data.position,
            rotation: data.position.rotation || 0,
            tick: 0,
            nickname: data.nickname,
            playerId: data.playerId
          };

          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(newPlayerPositionBroadcast));
              console.log(`📍 [SERVER] Sent initial position of ${data.clientId} to existing player`);
            }
          });
        }

        console.log(`👋 [SERVER] Sent welcome to ${data.clientId}`);
      }

      // Gestisce aggiornamenti posizione del player
      if (data.type === 'position_update') {
        if (playerData) {
          playerData.lastInputAt = new Date().toISOString();
          playerData.position = data.position;

          // Log posizione aggiornata (limitato per evitare spam)
          if (Math.random() < 0.1) { // Log solo il 10% degli aggiornamenti
            console.log(`📍 [SERVER] Position from ${data.clientId}: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
          }

          // Aggiungi alla queue invece di broadcastare immediatamente
          if (!positionUpdateQueue.has(data.clientId)) {
            positionUpdateQueue.set(data.clientId, []);
          }

          positionUpdateQueue.get(data.clientId).push({
            position: data.position,
            rotation: data.rotation,
            tick: data.tick,
            nickname: playerData.nickname,
            playerId: playerData.playerId,
            senderWs: ws,
            timestamp: Date.now()
          });

          // Limita la dimensione della queue per client (max 5 aggiornamenti recenti)
          const clientQueue = positionUpdateQueue.get(data.clientId);
          if (clientQueue.length > 5) {
            clientQueue.shift(); // Rimuovi il più vecchio
          }
        }

        // Echo back acknowledgment
        ws.send(JSON.stringify({
          type: 'position_ack',
          clientId: data.clientId,
          tick: data.tick
        }));
      }

      // Gestisce heartbeat
      if (data.type === 'heartbeat') {
        // Rispondi al heartbeat per confermare connessione viva
        ws.send(JSON.stringify({
          type: 'heartbeat_ack',
          clientId: data.clientId,
          serverTime: Date.now()
        }));
      }

    } catch (error) {
      console.error('❌ [SERVER] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    if (playerData) {
      console.log(`❌ [SERVER] Player disconnected: ${playerData.clientId} (${playerData.nickname})`);

      // Notifica a tutti gli altri giocatori che questo player se n'è andato
      const playerLeftBroadcast = {
        type: 'player_left',
        clientId: playerData.clientId
      };

      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(playerLeftBroadcast));
        }
      });

      connectedPlayers.delete(playerData.clientId);

      // Rimuovi anche dalla queue degli aggiornamenti posizione
      positionUpdateQueue.delete(playerData.clientId);

      console.log(`👥 [SERVER] Remaining players: ${connectedPlayers.size}`);
    } else {
      console.log('❌ [SERVER] Unknown client disconnected');
    }
  });

  ws.on('error', (error) => {
    console.error('🔌 [SERVER] WebSocket error:', error);
  });
});

// Gestisce chiusura server
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  wss.close();
  process.exit(0);
});
