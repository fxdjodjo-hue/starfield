const WebSocket = require('ws');

// ServerNpcManager - Gestione centralizzata degli NPC
class ServerNpcManager {
  constructor() {
    this.npcs = new Map();
    this.npcIdCounter = 0;
  }

  /**
   * Crea un nuovo NPC nel mondo
   */
  createNpc(type, x, y) {
    const npcId = `npc_${this.npcIdCounter++}`;

    // Se non specificate, genera posizioni casuali distribuite
    const finalX = x ?? (Math.random() - 0.5) * 20000;
    const finalY = y ?? (Math.random() - 0.5) * 12500;

    // Statistiche base per tipo
    const stats = type === 'Scouter'
      ? { health: 800, shield: 560, damage: 500, speed: 200 }
      : { health: 1200, shield: 840, damage: 750, speed: 150 };

    const npc = {
      id: npcId,
      type,
      position: { x: finalX, y: finalY, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: stats.health,
      maxHealth: stats.health,
      shield: stats.shield,
      maxShield: stats.shield,
      behavior: 'cruise',
      lastUpdate: Date.now(),
      lastSignificantMove: Date.now()
    };

    this.npcs.set(npcId, npc);
    console.log(`🆕 [SERVER] Created NPC ${npcId} (${type}) at (${finalX.toFixed(0)}, ${finalY.toFixed(0)})`);

    return npcId;
  }

  /**
   * Aggiorna lo stato di un NPC
   */
  updateNpc(npcId, updates) {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      console.warn(`[SERVER] Attempted to update non-existent NPC: ${npcId}`);
      return;
    }

    // Controlla se ci sono movimenti significativi
    const hasSignificantMovement = updates.position &&
      (Math.abs(updates.position.x - npc.position.x) > 5 ||
       Math.abs(updates.position.y - npc.position.y) > 5);

    Object.assign(npc, updates);
    npc.lastUpdate = Date.now();

    if (hasSignificantMovement) {
      npc.lastSignificantMove = Date.now();
    }
  }

  /**
   * Ottiene lo stato di un NPC specifico
   */
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }

  /**
   * Ottiene tutti gli NPC
   */
  getAllNpcs() {
    return Array.from(this.npcs.values());
  }

  /**
   * Ottiene NPC che si sono mossi significativamente dall'ultimo controllo
   */
  getNpcsNeedingUpdate(since) {
    return this.getAllNpcs().filter(npc => npc.lastSignificantMove > since);
  }

  /**
   * Applica danno a un NPC
   */
  damageNpc(npcId, damage, attackerId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return false;

    // Prima danneggia lo scudo
    if (npc.shield > 0) {
      const shieldDamage = Math.min(damage, npc.shield);
      npc.shield -= shieldDamage;
      damage -= shieldDamage;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      npc.health = Math.max(0, npc.health - damage);
    }

    npc.lastUpdate = Date.now();

    console.log(`💥 [SERVER] NPC ${npcId} damaged: ${npc.health}/${npc.maxHealth} HP, ${npc.shield}/${npc.maxShield} shield`);

    // Se morto, rimuovi l'NPC
    if (npc.health <= 0) {
      this.removeNpc(npcId);
      return true; // NPC morto
    }

    return false; // NPC sopravvissuto
  }

  /**
   * Rimuove un NPC dal mondo
   */
  removeNpc(npcId) {
    const existed = this.npcs.delete(npcId);
    if (existed) {
      console.log(`💥 [SERVER] Removed NPC ${npcId}`);
    }
    return existed;
  }

  /**
   * Statistiche del manager
   */
  getStats() {
    const allNpcs = this.getAllNpcs();
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const frigates = allNpcs.filter(npc => npc.type === 'Frigate').length;

    return {
      totalNpcs: allNpcs.length,
      scouters,
      frigates
    };
  }

  /**
   * Inizializza NPC del mondo (chiamato all'avvio del server)
   */
  initializeWorldNpcs(scouterCount = 25, frigateCount = 25) {
    console.log(`🌍 [SERVER] Initializing world NPCs: ${scouterCount} Scouters, ${frigateCount} Frigates`);

    // Distribuisci uniformemente gli NPC nel mondo
    for (let i = 0; i < scouterCount; i++) {
      this.createNpc('Scouter');
    }

    for (let i = 0; i < frigateCount; i++) {
      this.createNpc('Frigate');
    }

    const stats = this.getStats();
    console.log(`✅ [SERVER] World initialization complete: ${stats.totalNpcs} NPCs (${stats.scouters} Scouters, ${stats.frigates} Frigates)`);
  }
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
