// NpcDamageHandler - Gestione danni NPC e player
// Responsabilità: Applicazione danni, rimozione NPC, gestione morte
// Dipendenze: logger, mapServer, npcs Map, respawnSystem (per scheduleRespawn), rewardSystem (per awardNpcKillRewards)

const { logger } = require('../../logger.cjs');

class NpcDamageHandler {
  constructor(mapServer, npcs, respawnSystem, rewardSystem) {
    this.mapServer = mapServer;
    this.npcs = npcs;
    this.respawnSystem = respawnSystem;
    this.rewardSystem = rewardSystem;
  }

  /**
   * Applica danno a un NPC
   * @param {string} npcId - ID dell'NPC
   * @param {number} damage - Quantità di danno
   * @param {string} attackerId - ID dell'attaccante (playerId)
   * @returns {boolean} True se l'NPC è morto
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
    npc.lastAttackerId = attackerId; // Traccia l'ultimo player che lo ha colpito

    logger.info('COMBAT', `NPC ${npcId} damaged: ${npc.health}/${npc.maxHealth} HP, ${npc.shield}/${npc.maxShield} shield`);

    // Se morto, rimuovi l'NPC e assegna ricompense
    if (npc.health <= 0) {
      this.removeNpc(npcId);
      this.rewardSystem.awardNpcKillRewards(attackerId, npc.type);
      return true; // NPC morto
    }

    return false; // NPC sopravvissuto
  }

  /**
   * Applica danno a un giocatore (server authoritative)
   * @param {string} clientId - ID del client
   * @param {number} damage - Quantità di danno
   * @param {string} attackerId - ID dell'attaccante
   * @returns {boolean} True se il player è morto
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

    // 🚀 NUOVO: Se il player non è già in combattimento, avvia combattimento quando subisce danno
    // Questo rende il sistema più realistico - il player "entra in combattimento" anche se attaccato
    // Ma non avviare automaticamente se il player ha appena fermato il combattimento (negli ultimi 3 secondi)
    const recentlyStoppedCombat = playerData.lastCombatStop && (Date.now() - playerData.lastCombatStop) < 3000;
    const isInCombat = this.mapServer.combatManager && this.mapServer.combatManager.playerCombats.has(clientId);

    logger.debug('COMBAT', `Player ${clientId} damaged by ${attackerId}. In combat: ${isInCombat}, recently stopped: ${recentlyStoppedCombat}, lastStop: ${playerData.lastCombatStop}`);

    if (this.mapServer.combatManager && !isInCombat && !recentlyStoppedCombat) {
      logger.info('COMBAT', `Player ${clientId} entered combat due to damage from ${attackerId}`);
      this.mapServer.combatManager.startPlayerCombat(clientId, attackerId);
    } else if (recentlyStoppedCombat) {
      logger.info('COMBAT', `Player ${clientId} damaged but recently stopped combat (${Math.round((Date.now() - playerData.lastCombatStop) / 1000)}s ago) - not auto-starting`);
    }

    // Se morto, gestisci la morte
    if (playerData.health <= 0) {
      this.handlePlayerDeath(clientId, attackerId);
      return true; // Player morto
    }

    return false; // Player sopravvissuto
  }

  /**
   * Rimuove un NPC dal mondo e pianifica il respawn
   * @param {string} npcId - ID dell'NPC
   * @returns {boolean} True se l'NPC esisteva ed è stato rimosso
   */
  removeNpc(npcId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return false;

    const npcType = npc.type;
    const existed = this.npcs.delete(npcId);

    if (existed) {
      logger.info('NPC', `Removed NPC ${npcId} (${npcType})`);

      // Pianifica automaticamente il respawn per mantenere la popolazione
      this.respawnSystem.scheduleRespawn(npcType);
    }

    return existed;
  }

  /**
   * Gestisce la morte di un player
   * @param {string} clientId - ID del client
   * @param {string} attackerId - ID dell'attaccante
   */
  handlePlayerDeath(clientId, attackerId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    playerData.isDead = true;
    playerData.health = 0;
    logger.info('COMBAT', `Player ${clientId} killed by ${attackerId || 'unknown'}`);

    // TODO: Potrebbe essere necessario chiamare logica di respawn player qui
    // Per ora lasciamo che sia gestito da altri sistemi (es. MessageRouter)
  }
}

module.exports = NpcDamageHandler;
