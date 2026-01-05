const WebSocket = require('ws');

// ServerNpcManager - Gestione centralizzata degli NPC
class ServerNpcManager {
  constructor() {
    this.npcs = new Map();
    this.npcIdCounter = 0;

    // Confini del mondo (coerenti con CONFIG nel client)
    this.WORLD_WIDTH = 21000;
    this.WORLD_HEIGHT = 13100;
    this.WORLD_LEFT = -this.WORLD_WIDTH / 2;    // -10500
    this.WORLD_RIGHT = this.WORLD_WIDTH / 2;    // +10500
    this.WORLD_TOP = -this.WORLD_HEIGHT / 2;    // -6550
    this.WORLD_BOTTOM = this.WORLD_HEIGHT / 2;  // +6550
  }

  /**
   * Crea un nuovo NPC nel mondo
   */
  createNpc(type, x, y) {
    const npcId = `npc_${this.npcIdCounter++}`;

    // Se non specificate, genera posizioni casuali ENTRO i confini del mondo
    const finalX = x ?? (Math.random() * (this.WORLD_RIGHT - this.WORLD_LEFT) + this.WORLD_LEFT);
    const finalY = y ?? (Math.random() * (this.WORLD_BOTTOM - this.WORLD_TOP) + this.WORLD_TOP);

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

// Gestione proiettili per combattimento multiplayer
class ServerProjectileManager {
  constructor() {
    this.projectiles = new Map(); // projectileId -> projectile data
    this.collisionChecks = new Map(); // clientId -> last collision check time
  }

  /**
   * Registra un nuovo proiettile sparato da un giocatore
   */
  addProjectile(projectileId, playerId, position, velocity, damage, projectileType = 'laser') {
    const projectile = {
      id: projectileId,
      playerId,
      position: { ...position },
      velocity: { ...velocity },
      damage,
      projectileType,
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };

    this.projectiles.set(projectileId, projectile);
    console.log(`🚀 [SERVER] Projectile ${projectileId} added for player ${playerId}`);

    // Broadcast a tutti i client tranne quello che ha sparato
    this.broadcastProjectileFired(projectile, playerId);
  }

  /**
   * Aggiorna posizione di un proiettile
   */
  updateProjectile(projectileId, position) {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    projectile.position = { ...position };
    projectile.lastUpdate = Date.now();
  }

  /**
   * Rimuove un proiettile (distrutto o fuori schermo)
   */
  removeProjectile(projectileId, reason = 'unknown') {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    this.projectiles.delete(projectileId);
    console.log(`💥 [SERVER] Projectile ${projectileId} removed (${reason})`);

    // Broadcast distruzione a tutti i client
    this.broadcastProjectileDestroyed(projectileId, reason);
  }

  /**
   * Verifica collisioni tra proiettili e NPC/giocatori
   */
  checkCollisions() {
    const now = Date.now();
    const projectilesToRemove = [];

    for (const [projectileId, projectile] of this.projectiles.entries()) {
      // Simula movimento del proiettile (aggiorna posizione)
      const deltaTime = (now - projectile.lastUpdate) / 1000; // secondi
      projectile.position.x += projectile.velocity.x * deltaTime;
      projectile.position.y += projectile.velocity.y * deltaTime;
      projectile.lastUpdate = now;

      // Verifica collisioni con NPC
      const hitNpc = this.checkNpcCollision(projectile);
      if (hitNpc) {
        // Applica danno all'NPC
        const npcDead = npcManager.damageNpc(hitNpc.id, projectile.damage, projectile.playerId);

        // Notifica danno
        this.broadcastEntityDamaged(hitNpc, projectile);

        // Se NPC morto, broadcast distruzione
        if (npcDead) {
          this.broadcastEntityDestroyed(hitNpc, projectile.playerId);
        }

        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica collisioni con giocatori (TODO: implementare quando aggiunto health dei giocatori)

      // Verifica se proiettile è fuori dai confini del mondo
      if (this.isOutOfBounds(projectile.position)) {
        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica timeout (proiettili troppo vecchi vengono rimossi)
      if (now - projectile.createdAt > 10000) { // 10 secondi
        projectilesToRemove.push(projectileId);
        continue;
      }
    }

    // Rimuovi proiettili distrutti
    projectilesToRemove.forEach(id => this.removeProjectile(id, 'collision'));
  }

  /**
   * Verifica collisione con NPC
   */
  checkNpcCollision(projectile) {
    const npcs = npcManager.getAllNpcs();
    for (const npc of npcs) {
      const distance = Math.sqrt(
        Math.pow(projectile.position.x - npc.position.x, 2) +
        Math.pow(projectile.position.y - npc.position.y, 2)
      );

      // Collisione se distanza < 50 pixel (dimensione nave)
      if (distance < 50) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Verifica se posizione è fuori dai confini del mondo
   */
  isOutOfBounds(position) {
    const worldSize = 25000; // Raggio del mondo
    return Math.abs(position.x) > worldSize || Math.abs(position.y) > worldSize;
  }

  /**
   * Broadcast creazione proiettile
   */
  broadcastProjectileFired(projectile, excludeClientId) {
    const message = {
      type: 'projectile_fired',
      projectileId: projectile.id,
      playerId: projectile.playerId,
      position: projectile.position,
      velocity: projectile.velocity,
      damage: projectile.damage,
      projectileType: projectile.projectileType
    };

    this.broadcastToAll(message, excludeClientId);
  }

  /**
   * Broadcast distruzione proiettile
   */
  broadcastProjectileDestroyed(projectileId, reason) {
    const message = {
      type: 'projectile_destroyed',
      projectileId,
      reason
    };

    this.broadcastToAll(message);
  }

  /**
   * Broadcast danno a entità
   */
  broadcastEntityDamaged(npc, projectile) {
    const message = {
      type: 'entity_damaged',
      entityId: npc.id,
      entityType: 'npc',
      damage: projectile.damage,
      attackerId: projectile.playerId,
      newHealth: npc.health,
      newShield: npc.shield,
      position: npc.position
    };

    this.broadcastToAll(message);
  }

  /**
   * Broadcast distruzione entità
   */
  broadcastEntityDestroyed(npc, destroyerId) {
    const message = {
      type: 'entity_destroyed',
      entityId: npc.id,
      entityType: 'npc',
      destroyerId,
      position: npc.position,
      rewards: this.calculateRewards(npc)
    };

    this.broadcastToAll(message);
  }

  /**
   * Calcola ricompense per distruzione NPC
   */
  calculateRewards(npc) {
    const baseRewards = {
      Scouter: { credits: 50, experience: 10, honor: 5 },
      Frigate: { credits: 100, experience: 20, honor: 10 }
    };

    return baseRewards[npc.type] || { credits: 25, experience: 5, honor: 2 };
  }

  /**
   * Broadcast messaggio a tutti i client (opzionalmente escludendo uno)
   */
  broadcastToAll(message, excludeClientId = null) {
    for (const [clientId, client] of connectedPlayers.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;

      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[SERVER] Error broadcasting to ${clientId}:`, error);
      }
    }
  }

  /**
   * Statistiche proiettili attivi
   */
  getStats() {
    return {
      activeProjectiles: this.projectiles.size,
      projectilesByType: Array.from(this.projectiles.values()).reduce((acc, proj) => {
        acc[proj.projectileType] = (acc[proj.projectileType] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

// Gestione proiettili
const projectileManager = new ServerProjectileManager();

// Queue per aggiornamenti posizione per ridurre race conditions
const positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti
const PROCESS_INTERVAL = 50; // Processa aggiornamenti ogni 50ms

// Processa collisioni proiettili ogni 100ms
setInterval(() => {
  try {
    projectileManager.checkCollisions();
  } catch (error) {
    console.error('❌ [SERVER] Error checking projectile collisions:', error);
  }
}, 100); // Ogni 100ms per collisioni precise

// Aggiorna NPC ogni 200ms (movimento autonomo)
setInterval(() => {
  try {
    // Aggiorna movimento NPC mantenendoli entro i confini
    updateNpcMovements();

    // Broadcast aggiornamenti NPC se necessario
    const now = Date.now();
    const npcsNeedingUpdate = npcManager.getNpcsNeedingUpdate(now - 1000); // Ultimo secondo

    if (npcsNeedingUpdate.length > 0) {
      const message = {
        type: 'npc_bulk_update',
        npcs: npcsNeedingUpdate.map(npc => {
          console.log(`[SERVER] Broadcasting NPC ${npc.id}: rot=${npc.position.rotation.toFixed(2)}`);
          return {
            id: npc.id,
            position: npc.position,
            health: { current: npc.health, max: npc.maxHealth },
            shield: { current: npc.shield, max: npc.maxShield },
            behavior: npc.behavior
          };
        })
      };

      // Broadcast a tutti i client
      for (const [clientId, client] of connectedPlayers.entries()) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`[SERVER] Error broadcasting NPC updates to ${clientId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ [SERVER] Error updating NPCs:', error);
  }
}, 200); // Ogni 200ms per aggiornamenti NPC

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
    let deltaX = 0;
    let deltaY = 0;

    // Movimento semplice basato sul comportamento
    switch (npc.behavior) {
      case 'cruise':
        // Movimento lineare semplice
        deltaX = Math.cos(npc.position.rotation) * 50 * 0.016; // 50 units/second * deltaTime
        deltaY = Math.sin(npc.position.rotation) * 50 * 0.016;
        break;

      case 'aggressive':
        // Movimento più veloce quando aggressivi
        deltaX = Math.cos(npc.position.rotation) * 100 * 0.016;
        deltaY = Math.sin(npc.position.rotation) * 100 * 0.016;
        break;

      case 'flee':
        // Movimento di fuga (indietro)
        deltaX = -Math.cos(npc.position.rotation) * 80 * 0.016;
        deltaY = -Math.sin(npc.position.rotation) * 80 * 0.016;
        break;
    }

    // Calcola nuova posizione
    const newX = npc.position.x + deltaX;
    const newY = npc.position.y + deltaY;

    // Controlla confini del mondo e applica movimento solo se entro i limiti
    if (newX >= npcManager.WORLD_LEFT && newX <= npcManager.WORLD_RIGHT) {
      npc.position.x = newX;
    } else {
      // Se uscirebbe dai confini, cambia direzione
      npc.position.rotation += Math.PI; // 180 gradi, direzione opposta
    }

    if (newY >= npcManager.WORLD_TOP && newY <= npcManager.WORLD_BOTTOM) {
      npc.position.y = newY;
    } else {
      // Se uscirebbe dai confini, cambia direzione
      npc.position.rotation += Math.PI; // 180 gradi, direzione opposta
    }

    // Calcola rotazione basata sulla direzione del movimento (più realistico!)
    if (deltaX !== 0 || deltaY !== 0) {
      // Se l'NPC si sta muovendo, aggiorna la rotazione per puntare nella direzione del movimento
      npc.position.rotation = Math.atan2(deltaY, deltaX);

      // Debug: mostra quando la rotazione cambia per movimento
      console.log(`[SERVER] NPC ${npc.id} direction change: rot=${npc.position.rotation.toFixed(2)} (dx=${deltaX.toFixed(2)}, dy=${deltaY.toFixed(2)})`);
    }

    // Rotazione casuale occasionale per rendere il movimento più naturale (meno frequente)
    if (Math.random() < 0.005) { // 0.5% probabilità ogni frame
      npc.position.rotation += (Math.random() - 0.5) * 0.3; // ±0.15 radianti, più sottile
    }

    // Mantieni rotazione in range [0, 2π]
    npc.position.rotation = ((npc.position.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Aggiorna lastSignificantMove per ogni movimento (anche piccolo)
    // Questo assicura che gli NPC in movimento vengano trasmessi regolarmente
    npc.lastSignificantMove = Date.now();
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

      // Gestisce spari di proiettili
      if (data.type === 'projectile_fired') {
        console.log(`🔫 [SERVER] Projectile fired: ${data.projectileId} by ${data.playerId}`);

        // Registra il proiettile nel server
        projectileManager.addProjectile(
          data.projectileId,
          data.playerId,
          data.position,
          data.velocity,
          data.damage,
          data.projectileType || 'laser'
        );
      }

      // Gestisce creazione esplosioni
      if (data.type === 'explosion_created') {
        console.log(`💥 [SERVER] Explosion created: ${data.explosionType} for ${data.entityType} ${data.entityId}`);

        // Broadcast l'esplosione a tutti gli altri client
        const message = {
          type: 'explosion_created',
          explosionId: data.explosionId,
          entityId: data.entityId,
          entityType: data.entityType,
          position: data.position,
          explosionType: data.explosionType
        };

        // Broadcast a tutti i client (incluso quello che ha creato l'esplosione per conferma)
        for (const [clientId, client] of connectedPlayers.entries()) {
          try {
            client.ws.send(JSON.stringify(message));
          } catch (error) {
            console.error(`[SERVER] Error broadcasting explosion to ${clientId}:`, error);
          }
        }
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
