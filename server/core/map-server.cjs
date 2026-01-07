// MapServer - Contesto per ogni mappa del gioco
// Dipendenze consentite: logger.cjs, managers (npc, combat, projectile)

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');
const ServerNpcManager = require('../managers/npc-manager.cjs');
const ServerCombatManager = require('../managers/combat-manager.cjs');
const ServerProjectileManager = require('../managers/projectile-manager.cjs');

class MapServer {
  constructor(mapId, config = {}) {
    this.mapId = mapId;

    // Dimensioni mappa (configurabili per mappe diverse)
    this.WORLD_WIDTH = config.WORLD_WIDTH || 21000;
    this.WORLD_HEIGHT = config.WORLD_HEIGHT || 13100;

    // Managers specifici della mappa
    this.npcManager = new ServerNpcManager(this);
    this.projectileManager = new ServerProjectileManager(this);

    // Players connessi a questa mappa
    this.players = new Map();

    // Queue per aggiornamenti posizione per ridurre race conditions
    this.positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti

    // Configurazione NPC per questa mappa
    this.npcConfig = config.npcConfig || { scouterCount: 25, frigateCount: 25 };
  }

  // Inizializzazione della mappa
  initialize() {
    logger.info('MAP', `Initializing map ${this.mapId}...`);
    this.npcManager.initializeWorldNpcs(
      this.npcConfig.scouterCount,
      this.npcConfig.frigateCount
    );
  }

  // Gestione giocatori
  addPlayer(clientId, playerData) {
    this.players.set(clientId, playerData);
    logger.info('MAP', `Player ${clientId} joined map ${this.mapId}`);
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
    logger.info('MAP', `Player ${clientId} left map ${this.mapId}`);
  }

  // Metodi delegati ai managers
  getAllNpcs() { return this.npcManager.getAllNpcs(); }
  getNpc(npcId) { return this.npcManager.getNpc(npcId); }
  createNpc(type, x, y) { return this.npcManager.createNpc(type, x, y); }

  // Tick unificato per la mappa (20 Hz)
  tick() {
    try {
      // 1. Movimento NPC
      this.updateNpcMovements();

      // 2. Logica di combat NPC (attacchi automatici)
      if (this.combatManager) {
        this.combatManager.updateCombat();
      }

      // 3. Collisioni proiettili
      this.projectileManager.checkCollisions();

      // 4. Broadcast aggiornamenti NPC significativi
      this.broadcastNpcUpdates();

      // 5. Processa aggiornamenti posizione giocatori
      this.processPositionUpdates();

    } catch (error) {
      console.error(`❌ [MapServer:${this.mapId}] Error in tick:`, error);
    }
  }

  // Broadcasting specifico della mappa
  broadcastToMap(message, excludeClientId = null) {
    const payload = JSON.stringify(message);

    for (const [clientId, playerData] of this.players.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;

      if (playerData.ws.readyState === WebSocket.OPEN) {
        playerData.ws.send(payload);
      }
    }
  }

  // Broadcasting con interest radius (solo giocatori entro il raggio)
  broadcastNear(position, radius, message, excludeClientId = null) {
    const payload = JSON.stringify(message);
    const radiusSq = radius * radius; // Evita sqrt per performance

    for (const [clientId, playerData] of this.players.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Calcola distanza quadrata
      const dx = playerData.position.x - position.x;
      const dy = playerData.position.y - position.y;
      const distSq = dx * dx + dy * dy;

      // Invia solo se entro il raggio
      if (distSq <= radiusSq) {
        playerData.ws.send(payload);
      }
    }
  }

  // Sistema di movimento NPC semplice (server-side)
  updateNpcMovements() {
    const allNpcs = this.npcManager.getAllNpcs();

    for (const npc of allNpcs) {
      const deltaTime = 1000 / 60; // Fixed timestep per fisica server

      // Salva posizione iniziale per calcolare movimento significativo
      const startX = npc.position.x;
      const startY = npc.position.y;

    // Movimento semplice con velocity
    const speed = NPC_CONFIG[npc.type].stats.speed;
      let deltaX = npc.velocity.x * (deltaTime / 1000) * (speed / 100); // Normalizza velocità base
      let deltaY = npc.velocity.y * (deltaTime / 1000) * (speed / 100);

      // Modifica velocità basata sul comportamento
      switch (npc.behavior) {
        case 'aggressive':
          deltaX *= 2;
          deltaY *= 2;
          break;
        case 'flee':
          deltaX *= -1.5;
          deltaY *= -1.5;
          break;
      }

      // Calcola nuova posizione
      const newX = npc.position.x + deltaX;
      const newY = npc.position.y + deltaY;

      // Applica movimento e controlla confini
      if (newX >= this.npcManager.WORLD_LEFT && newX <= this.npcManager.WORLD_RIGHT) {
        npc.position.x = newX;
      } else {
        // Rimbalza sui confini X
        npc.velocity.x = -npc.velocity.x;
        npc.position.x = Math.max(this.npcManager.WORLD_LEFT, Math.min(this.npcManager.WORLD_RIGHT, newX));
      }

      if (newY >= this.npcManager.WORLD_TOP && newY <= this.npcManager.WORLD_BOTTOM) {
        npc.position.y = newY;
      } else {
        // Rimbalza sui confini Y
        npc.velocity.y = -npc.velocity.y;
        npc.position.y = Math.max(this.npcManager.WORLD_TOP, Math.min(this.npcManager.WORLD_BOTTOM, newY));
      }

      // Calcola movimento significativo (solo se spostamento > 5px)
      const dx = npc.position.x - startX;
      const dy = npc.position.y - startY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 25) { // 5px threshold
        npc.lastSignificantMove = Date.now();
      }

      // Aggiorna rotazione dello sprite per riflettere la direzione del movimento
      if (deltaX !== 0 || deltaY !== 0) {
        npc.position.rotation = Math.atan2(deltaY, deltaX) + Math.PI / 2;
      }

      npc.lastUpdate = Date.now();
    }
  }

  // Broadcast aggiornamenti NPC
  broadcastNpcUpdates() {
    const npcs = this.npcManager.getAllNpcs();
    if (npcs.length === 0) return;

    const radius = SERVER_CONSTANTS.NETWORK.WORLD_RADIUS; // Raggio del mondo
    const radiusSq = radius * radius;

    // Per ogni giocatore connesso, invia NPC nel suo raggio di interesse ampio
    for (const [clientId, playerData] of this.players.entries()) {
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Filtra NPC entro il raggio ampio
      const relevantNpcs = npcs.filter(npc => {
        const dx = npc.position.x - playerData.position.x;
        const dy = npc.position.y - playerData.position.y;
        return (dx * dx + dy * dy) <= radiusSq;
      });

      if (relevantNpcs.length === 0) continue;

      const message = {
        type: 'npc_bulk_update',
        npcs: relevantNpcs.map(npc => ({
          id: npc.id,
          position: npc.position,
          health: { current: npc.health, max: npc.maxHealth },
          shield: { current: npc.shield, max: npc.maxShield },
          behavior: npc.behavior
        })),
        timestamp: Date.now()
      };

      playerData.ws.send(JSON.stringify(message));
    }
  }

  // Processa aggiornamenti posizione giocatori
  processPositionUpdates() {
    for (const [clientId, updates] of this.positionUpdateQueue) {
      if (updates.length === 0) continue;

      const latestUpdate = updates[updates.length - 1];

      const positionBroadcast = {
        type: 'remote_player_update',
        clientId,
        position: latestUpdate.position,
        rotation: latestUpdate.rotation,
        tick: latestUpdate.tick,
        nickname: latestUpdate.nickname,
        playerId: latestUpdate.playerId
      };

      this.broadcastToMap(positionBroadcast, clientId);
      this.positionUpdateQueue.delete(clientId);
    }
  }
}

module.exports = MapServer;
