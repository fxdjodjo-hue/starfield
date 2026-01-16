// NpcRespawnSystem - Gestione coda e logica respawn
// Responsabilità: Timer respawn, coda respawn, posizionamento sicuro
// Dipendenze: logger, mapServer, spawner (per createNpc), broadcaster (per broadcastNpcSpawn)

const { logger } = require('../../logger.cjs');

class NpcRespawnSystem {
  constructor(mapServer, spawner, broadcaster) {
    this.mapServer = mapServer;
    this.spawner = spawner;
    this.broadcaster = broadcaster;
    
    this.respawnQueue = []; // Coda di NPC da respawnare
    this.respawnCheckInterval = null; // Timer per controllare la coda
  }

  /**
   * Calcola le coordinate del mondo dinamicamente
   * @returns {{WORLD_LEFT: number, WORLD_RIGHT: number, WORLD_TOP: number, WORLD_BOTTOM: number}}
   */
  getWorldBounds() {
    // Usa valori dal mapServer con fallback sicuro
    const WORLD_WIDTH = Number(this.mapServer?.WORLD_WIDTH) || 21000;
    const WORLD_HEIGHT = Number(this.mapServer?.WORLD_HEIGHT) || 13100;
    
    return {
      WORLD_LEFT: -WORLD_WIDTH / 2,
      WORLD_RIGHT: WORLD_WIDTH / 2,
      WORLD_TOP: -WORLD_HEIGHT / 2,
      WORLD_BOTTOM: WORLD_HEIGHT / 2
    };
  }

  /**
   * Avvia il timer per controllare la coda di respawn
   */
  startRespawnTimer() {
    // Controlla la coda ogni secondo
    this.respawnCheckInterval = setInterval(() => {
      this.processRespawnQueue();
    }, 1000);
    logger.info('NPC', 'Respawn timer started');
  }

  /**
   * Ferma il timer di respawn (per cleanup)
   */
  stopRespawnTimer() {
    if (this.respawnCheckInterval) {
      clearInterval(this.respawnCheckInterval);
      this.respawnCheckInterval = null;
      logger.info('NPC', 'Respawn timer stopped');
    }
  }

  /**
   * Pianifica il respawn di un NPC morto
   * @param {string} npcType - Tipo di NPC da respawnare
   */
  scheduleRespawn(npcType) {
    const respawnDelay = 10000; // 10 secondi

    const respawnEntry = {
      npcType: npcType,
      respawnTime: Date.now() + respawnDelay,
      scheduledAt: Date.now()
    };

    this.respawnQueue.push(respawnEntry);
  }

  /**
   * Processa la coda di respawn
   */
  processRespawnQueue() {
    const now = Date.now();
    const readyForRespawn = [];

    // Trova tutti gli NPC pronti per il respawn
    this.respawnQueue = this.respawnQueue.filter(entry => {
      if (now >= entry.respawnTime) {
        readyForRespawn.push(entry);
        return false; // Rimuovi dalla coda
      }
      return true; // Mantieni in coda
    });

    // Respawna gli NPC pronti
    for (const entry of readyForRespawn) {
      this.respawnNpc(entry.npcType);
    }
  }

  /**
   * Respawna un NPC in una posizione sicura
   * @param {string} npcType - Tipo di NPC da respawnare
   */
  respawnNpc(npcType) {
    try {
      // Trova una posizione sicura per il respawn
      const safePosition = this.findSafeRespawnPosition();

      // Crea il nuovo NPC usando lo spawner
      const npcId = this.spawner.createNpc(npcType, safePosition.x, safePosition.y);

      if (npcId) {
        logger.info('NPC', `Successfully respawned ${npcType} at (${safePosition.x.toFixed(0)}, ${safePosition.y.toFixed(0)})`);

        // Broadcast il nuovo NPC a tutti i client usando il broadcaster
        this.broadcaster.broadcastNpcSpawn(npcId);
      }
    } catch (error) {
      console.error(`❌ [SERVER] Failed to respawn ${npcType}:`, error);
    }
  }

  /**
   * Trova una posizione sicura per il respawn lontana dai giocatori
   * @returns {{x: number, y: number}} Posizione sicura
   */
  findSafeRespawnPosition() {
    const attempts = 10; // Numero massimo di tentativi
    const bounds = this.getWorldBounds();
    const WORLD_WIDTH = this.mapServer.WORLD_WIDTH || 21000;
    const WORLD_HEIGHT = this.mapServer.WORLD_HEIGHT || 13100;

    for (let i = 0; i < attempts; i++) {
      // Genera posizione casuale nel mondo
      const x = (Math.random() * (bounds.WORLD_RIGHT - bounds.WORLD_LEFT) + bounds.WORLD_LEFT);
      const y = (Math.random() * (bounds.WORLD_BOTTOM - bounds.WORLD_TOP) + bounds.WORLD_TOP);

      // Verifica che sia abbastanza lontana dai giocatori
      if (this.isPositionSafeFromPlayers(x, y)) {
        return { x, y };
      }
    }

    // Fallback: posizione casuale semplice se non trova posizione sicura
    console.warn('⚠️ [SERVER] Could not find safe respawn position, using fallback');
    const fallbackX = (Math.random() - 0.5) * (WORLD_WIDTH * 0.8); // 80% del mondo
    const fallbackY = (Math.random() - 0.5) * (WORLD_HEIGHT * 0.8);
    return { x: fallbackX, y: fallbackY };
  }

  /**
   * Verifica se una posizione è sicura (lontana dai giocatori)
   * @param {number} x - Posizione X
   * @param {number} y - Posizione Y
   * @returns {boolean} True se la posizione è sicura
   */
  isPositionSafeFromPlayers(x, y) {
    const minDistanceFromPlayers = 1000; // Distanza minima dai giocatori (pixel)
    const minDistanceSq = minDistanceFromPlayers * minDistanceFromPlayers;

    // Controlla tutti i giocatori connessi
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      if (!playerData.position) continue;

      const dx = x - playerData.position.x;
      const dy = y - playerData.position.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < minDistanceSq) {
        return false; // Troppo vicino a un giocatore
      }
    }

    return true; // Posizione sicura
  }

  /**
   * Cleanup risorse
   */
  destroy() {
    this.stopRespawnTimer();
    this.respawnQueue = [];
  }
}

module.exports = NpcRespawnSystem;
