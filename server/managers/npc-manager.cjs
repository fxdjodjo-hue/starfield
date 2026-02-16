/**
 * ServerNpcManager - Orchestratore gestione NPC
 * Responsabilità: Coordinamento moduli specializzati per gestione NPC
 * Dipendenze: NpcSpawner, NpcRespawnSystem, NpcDamageHandler, NpcRewardSystem, NpcBroadcaster
 */

const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');
const NpcSpawner = require('./npc/NpcSpawner.cjs');
const NpcRespawnSystem = require('./npc/NpcRespawnSystem.cjs');
const NpcDamageHandler = require('./npc/NpcDamageHandler.cjs');
const NpcRewardSystem = require('./npc/NpcRewardSystem.cjs');
const NpcBroadcaster = require('./npc/NpcBroadcaster.cjs');

class ServerNpcManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcs = new Map();
    this.npcIdCounter = { value: 0 }; // Oggetto per riferimento condiviso

    // Inizializza moduli specializzati con dependency injection
    this.spawner = new NpcSpawner(mapServer, this.npcs, this.npcIdCounter);
    this.broadcaster = new NpcBroadcaster(mapServer, this.npcs);
    this.respawnSystem = new NpcRespawnSystem(mapServer, this.spawner, this.broadcaster);
    this.rewardSystem = new NpcRewardSystem(mapServer);
    this.damageHandler = new NpcDamageHandler(mapServer, this.npcs, this.respawnSystem, this.rewardSystem);

    // Avvia il controllo periodico della coda respawn
    this.respawnSystem.startRespawnTimer();
  }

  /**
   * Crea un nuovo NPC nel mondo
   * @param {string} type - Tipo di NPC ('Scouter' o 'Kronos')
   * @param {number} x - Posizione X (opzionale, casuale se non specificata)
   * @param {number} y - Posizione Y (opzionale, casuale se non specificata)
   * @param {boolean} silent - Se true, non logga la creazione (per inizializzazione bulk)
   * @returns {string} npcId
   */
  createNpc(type, x, y, silent = false) {
    return this.spawner.createNpc(type, x, y, silent);
  }

  /**
   * Aggiorna lo stato di un NPC
   * @param {string} npcId - ID dell'NPC
   * @param {Object} updates - Aggiornamenti da applicare
   */
  updateNpc(npcId, updates) {
    this.spawner.updateNpc(npcId, updates);
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
   * @param {string} npcId - ID dell'NPC
   * @param {number} damage - Quantità di danno
   * @param {string} attackerId - ID dell'attaccante (playerId)
   * @returns {boolean} True se l'NPC è morto
   */
  damageNpc(npcId, damage, attackerId) {
    return this.damageHandler.damageNpc(npcId, damage, attackerId);
  }

  /**
   * Applica danno a un giocatore (server authoritative)
   * @param {string} clientId - ID del client
   * @param {number} damage - Quantità di danno
   * @param {string} attackerId - ID dell'attaccante
   * @returns {boolean} True se il player è morto
   */
  damagePlayer(clientId, damage, attackerId) {
    return this.damageHandler.damagePlayer(clientId, damage, attackerId);
  }

  /**
   * Rimuove un NPC dal mondo e pianifica il respawn
   * @param {string} npcId - ID dell'NPC
   * @returns {boolean} True se l'NPC esisteva ed è stato rimosso
   */
  removeNpc(npcId, options = {}) {
    return this.damageHandler.removeNpc(npcId, options);
  }

  /**
   * Inizializza NPC del mondo (chiamato all'avvio del server)
   * @param {number} scouterCount - Numero di Scouters
   * @param {number} frigateCount - Numero di Kronos
   * @param {number} guardCount - Numero di Guard
   * @param {number} pyramidCount - Numero di Pyramid (default 1)
   */
  initializeWorldNpcs(scouterCount = 0, frigateCount = 0, guardCount = 0, pyramidCount = 1) {
    this.spawner.initializeWorldNpcs(scouterCount, frigateCount, guardCount, pyramidCount);
    const stats = this.getStats();
    ServerLoggerWrapper.system(`World initialized with ${stats.totalNpcs} NPCs`);
    ServerLoggerWrapper.debug('SERVER', `NPC breakdown: ${stats.scouters} Scouters, ${stats.kronos} Kronos, ${stats.guards} Guards, ${stats.pyramids} Pyramids`);
  }

  /**
   * Cleanup risorse del manager
   */
  destroy() {
    this.respawnSystem.destroy();
    logger.info('NPC', 'ServerNpcManager cleanup completed');
  }

  /**
   * Statistiche del manager
   * @returns {{totalNpcs: number, scouters: number, kronos: number, guards: number, pyramids: number}}
   */
  getStats() {
    const allNpcs = this.getAllNpcs();
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const kronos = allNpcs.filter(npc => npc.type === 'Kronos').length;
    const guards = allNpcs.filter(npc => npc.type === 'Guard').length;
    const pyramids = allNpcs.filter(npc => npc.type === 'Pyramid').length;

    return {
      totalNpcs: allNpcs.length,
      scouters,
      kronos,
      guards,
      pyramids
    };
  }

  /**
   * Getter per coordinate mondo (backward compatibility con map-server.cjs)
   * @returns {{WORLD_LEFT: number, WORLD_RIGHT: number, WORLD_TOP: number, WORLD_BOTTOM: number}}
   */
  getWorldBounds() {
    return this.spawner.getWorldBounds();
  }

  /**
   * Getter per WORLD_LEFT (backward compatibility)
   */
  get WORLD_LEFT() {
    return this.getWorldBounds().WORLD_LEFT;
  }

  /**
   * Getter per WORLD_RIGHT (backward compatibility)
   */
  get WORLD_RIGHT() {
    return this.getWorldBounds().WORLD_RIGHT;
  }

  /**
   * Getter per WORLD_TOP (backward compatibility)
   */
  get WORLD_TOP() {
    return this.getWorldBounds().WORLD_TOP;
  }

  /**
   * Getter per WORLD_BOTTOM (backward compatibility)
   */
  get WORLD_BOTTOM() {
    return this.getWorldBounds().WORLD_BOTTOM;
  }

  /**
   * Fa dimenticare un player morto a tutti gli NPC che lo stavano attaccando
   * @param {string} deadPlayerId - ID del player morto
   */
  forgetDeadPlayer(deadPlayerId) {
    let forgottenCount = 0;

    for (const [npcId, npc] of this.npcs.entries()) {
      // Se questo NPC stava attaccando il player morto
      if (npc.lastAttackerId === deadPlayerId) {
        // Resetta lo stato di aggressione
        npc.lastDamage = null;
        npc.lastAttackerId = null;

        ServerLoggerWrapper.info('NPC_MANAGER', `NPC ${npcId} (${npc.type}) forgot dead player ${deadPlayerId}`);
        forgottenCount++;
      }
    }

    if (forgottenCount > 0) {
      ServerLoggerWrapper.info('NPC_MANAGER', `Forgot dead player ${deadPlayerId} for ${forgottenCount} NPCs`);
    }

    return forgottenCount;
  }
}

module.exports = ServerNpcManager;
