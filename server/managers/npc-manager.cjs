/**
 * ServerNpcManager - Gestione centralizzata degli NPC
 * Responsabile della creazione, gestione, movimento e respawn degli NPC
 */

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');

class ServerNpcManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcs = new Map();
    this.npcIdCounter = 0;

    // Sistema di respawn server-authoritative
    this.respawnQueue = []; // Coda di NPC da respawnare
    this.respawnCheckInterval = null; // Timer per controllare la coda

    // Usa le dimensioni dalla mappa
    this.WORLD_WIDTH = mapServer.WORLD_WIDTH;
    this.WORLD_HEIGHT = mapServer.WORLD_HEIGHT;
    this.WORLD_LEFT = -this.WORLD_WIDTH / 2;
    this.WORLD_RIGHT = this.WORLD_WIDTH / 2;
    this.WORLD_TOP = -this.WORLD_HEIGHT / 2;
    this.WORLD_BOTTOM = this.WORLD_HEIGHT / 2;

    // Avvia il controllo periodico della coda respawn
    this.startRespawnTimer();
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
   * Crea un nuovo NPC nel mondo
   */
  createNpc(type, x, y) {
    const npcId = `npc_${this.npcIdCounter++}`;

    // Se non specificate, genera posizioni casuali ENTRO i confini del mondo
    const finalX = x ?? (Math.random() * (this.WORLD_RIGHT - this.WORLD_LEFT) + this.WORLD_LEFT);
    const finalY = y ?? (Math.random() * (this.WORLD_BOTTOM - this.WORLD_TOP) + this.WORLD_TOP);

    // Statistiche base per tipo dal config condiviso
    const stats = NPC_CONFIG[type].stats;

    const npc = {
      id: npcId,
      type,
      position: { x: finalX, y: finalY, rotation: Math.random() * Math.PI * 2 },
      velocity: {
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200
      },
      health: stats.health,
      maxHealth: stats.health,
      shield: stats.shield,
      maxShield: stats.shield,
      damage: stats.damage, // Aggiungi danno per combat
      lastBounce: 0, // Timestamp dell'ultimo rimbalzo ai confini
      behavior: 'cruise',
      lastUpdate: Date.now(),
      lastSignificantMove: 0, // Non è stato ancora trasmesso, impostiamo a 0
      lastDamage: 0 // Non danneggiato ancora
    };

    // Tutti gli NPC ora hanno comportamento normale (cruise)
    // Non ci sono più NPC aggressivi automatici

    this.npcs.set(npcId, npc);
    logger.info('NPC', `Created ${npcId} (${type}) at (${finalX.toFixed(0)}, ${finalY.toFixed(0)}) [${npc.behavior}]`);

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
    npc.lastDamage = Date.now(); // Traccia quando è stato danneggiato

    logger.info('COMBAT', `NPC ${npcId} damaged: ${npc.health}/${npc.maxHealth} HP, ${npc.shield}/${npc.maxShield} shield`);

    // Se morto, rimuovi l'NPC e assegna ricompense
    if (npc.health <= 0) {
      this.removeNpc(npcId);
      this.awardNpcKillRewards(attackerId, npc.type);
      return true; // NPC morto
    }

    return false; // NPC sopravvissuto
  }

  /**
   * Applica danno a un giocatore (server authoritative)
   */
  damagePlayer(clientId, damage, attackerId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData || playerData.isDead) return false;

    // Prima danneggia lo scudo
    if (playerData.shield > 0) {
      const shieldDamage = Math.min(damage, playerData.shield);
      playerData.shield -= shieldDamage;
      damage -= shieldDamage;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      playerData.health = Math.max(0, playerData.health - damage);
    }

    playerData.lastDamage = Date.now();

    logger.info('COMBAT', `Player ${clientId} damaged: ${playerData.health}/${playerData.maxHealth} HP, ${playerData.shield}/${playerData.maxShield} shield`);

    // Se morto, gestisci la morte
    if (playerData.health <= 0) {
      this.handlePlayerDeath(clientId, attackerId);
      return true; // Player morto
    }

    return false; // Player sopravvissuto
  }

  /**
   * Rimuove un NPC dal mondo e pianifica il respawn
   */
  removeNpc(npcId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return false;

    const npcType = npc.type;
    const existed = this.npcs.delete(npcId);

    if (existed) {
      logger.info('NPC', `Removed NPC ${npcId} (${npcType})`);

      // Pianifica automaticamente il respawn per mantenere la popolazione
      this.scheduleRespawn(npcType);
    }

    return existed;
  }

  /**
   * Assegna ricompense al giocatore che ha ucciso un NPC
   */
  awardNpcKillRewards(playerId, npcType) {
    const playerData = this.mapServer.players.get(playerId);
    if (!playerData) {
      logger.warn('REWARDS', `Cannot award rewards to unknown player: ${playerId}`);
      return;
    }

    const rewards = NPC_CONFIG[npcType]?.rewards;
    if (!rewards) {
      logger.warn('REWARDS', `No rewards defined for NPC type: ${npcType}`);
      return;
    }

    // SkillPoints drop casuale (25-50% probabilità di 1-3 punti)
    let skillPointsDrop = 0;
    const dropChance = Math.random();
    if (dropChance < 0.25) { // 25% probabilità
      skillPointsDrop = 1;
    } else if (dropChance < 0.50) { // Altri 25% probabilità (totale 50%)
      skillPointsDrop = Math.floor(Math.random() * 3) + 1; // 1-3 punti
    }

    // Aggiungi ricompense all'inventario del giocatore
    playerData.inventory.credits += rewards.credits || 0;
    playerData.inventory.cosmos += rewards.cosmos || 0;
    playerData.inventory.experience += rewards.experience || 0;
    playerData.inventory.honor += rewards.honor || 0;
    playerData.inventory.skillPoints += skillPointsDrop;

    logger.info('REWARDS', `Player ${playerId} awarded: ${rewards.credits} credits, ${rewards.cosmos} cosmos, ${rewards.experience} XP, ${rewards.honor} honor, ${skillPointsDrop} skillPoints for killing ${npcType}`);

    // Crea oggetto rewards completo includendo drop casuali
    const finalRewards = {
      ...rewards,
      skillPoints: skillPointsDrop
    };

    // Invia notifica delle ricompense al client
    this.sendRewardsNotification(playerId, finalRewards, npcType);
  }

  /**
   * Invia notifica delle ricompense al client
   */
  sendRewardsNotification(playerId, rewards, npcType) {
    const playerData = this.mapServer.players.get(playerId);
    if (!playerData || playerData.ws.readyState !== 1) return; // WebSocket.OPEN = 1

    const message = {
      type: 'player_state_update',
      inventory: { ...playerData.inventory },
      upgrades: { ...playerData.upgrades },
      source: `killed_${npcType}`,
      rewardsEarned: {
        ...rewards,
        npcType: npcType
      }
    };

    playerData.ws.send(JSON.stringify(message));
  }

  /**
   * Pianifica il respawn di un NPC morto
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
   */
  respawnNpc(npcType) {
    try {
      // Trova una posizione sicura per il respawn
      const safePosition = this.findSafeRespawnPosition();

      // Crea il nuovo NPC
      const npcId = this.createNpc(npcType, safePosition.x, safePosition.y);

      if (npcId) {
        logger.info('NPC', `Successfully respawned ${npcType} at (${safePosition.x.toFixed(0)}, ${safePosition.y.toFixed(0)})`);

        // Broadcast il nuovo NPC a tutti i client
        this.broadcastNpcSpawn(npcId);
      }
    } catch (error) {
      console.error(`❌ [SERVER] Failed to respawn ${npcType}:`, error);
    }
  }

  /**
   * Trova una posizione sicura per il respawn lontana dai giocatori
   */
  findSafeRespawnPosition() {
    const attempts = 10; // Numero massimo di tentativi

    for (let i = 0; i < attempts; i++) {
      // Genera posizione casuale nel mondo
      const x = (Math.random() * (this.WORLD_RIGHT - this.WORLD_LEFT) + this.WORLD_LEFT);
      const y = (Math.random() * (this.WORLD_BOTTOM - this.WORLD_TOP) + this.WORLD_TOP);

      // Verifica che sia abbastanza lontana dai giocatori
      if (this.isPositionSafeFromPlayers(x, y)) {
        return { x, y };
      }
    }

    // Fallback: posizione casuale semplice se non trova posizione sicura
    console.warn('⚠️ [SERVER] Could not find safe respawn position, using fallback');
    const fallbackX = (Math.random() - 0.5) * (this.WORLD_WIDTH * 0.8); // 80% del mondo
    const fallbackY = (Math.random() - 0.5) * (this.WORLD_HEIGHT * 0.8);
    return { x: fallbackX, y: fallbackY };
  }

  /**
   * Verifica se una posizione è sicura (lontana dai giocatori)
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
   * Broadcast la creazione di un nuovo NPC a tutti i client
   */
  broadcastNpcSpawn(npcId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    const message = {
      type: 'npc_spawn',
      npc: {
        id: npc.id,
        type: npc.type,
        position: npc.position,
        health: { current: npc.health, max: npc.maxHealth },
        shield: { current: npc.shield, max: npc.maxShield },
        behavior: npc.behavior
      }
    };

    // Broadcast a tutti i client nel raggio di interesse
    this.mapServer.broadcastNear(npc.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
  }

  /**
   * Cleanup risorse del manager
   */
  destroy() {
    this.stopRespawnTimer();
    this.respawnQueue = [];
    logger.info('NPC', 'ServerNpcManager cleanup completed');
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

    // Distribuisci uniformemente gli NPC nel mondo
    for (let i = 0; i < scouterCount; i++) {
      this.createNpc('Scouter');
    }

    for (let i = 0; i < frigateCount; i++) {
      this.createNpc('Frigate');
    }

    const stats = this.getStats();
    logger.info('SERVER', `World initialization complete: ${stats.totalNpcs} NPCs (${stats.scouters} Scouters, ${stats.frigates} Frigates)`);
  }
}

module.exports = ServerNpcManager;
