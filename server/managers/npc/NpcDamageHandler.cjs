// NpcDamageHandler - Gestione danni NPC e player
// Responsabilità: Applicazione danni, rimozione NPC, gestione morte
// Dipendenze: logger, mapServer, npcs Map, respawnSystem (per scheduleRespawn), rewardSystem (per awardNpcKillRewards)

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');

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

    const rawDamage = damage;
    let shieldAbsorbed = 0;
    let healthDamage = 0;

    // Prima danneggia lo scudo
    if (npc.shield > 0) {
      shieldAbsorbed = Math.min(damage, npc.shield);
      npc.shield -= shieldAbsorbed;
      damage -= shieldAbsorbed;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      healthDamage = damage;
      npc.health = Math.max(0, npc.health - healthDamage);
    }

    npc.lastUpdate = Date.now();
    npc.lastDamage = Date.now(); // Traccia quando è stato danneggiato
    npc.lastAttackerId = attackerId; // Traccia l'ultimo player che lo ha colpito

    // Damage details logging removed for production - too verbose

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

    const rawDamage = damage;
    let shieldAbsorbed = 0;
    let healthDamage = 0;

    // Prima danneggia lo scudo
    if (playerData.shield > 0) {
      shieldAbsorbed = Math.min(damage, playerData.shield);
      playerData.shield -= shieldAbsorbed;
      damage -= shieldAbsorbed;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      healthDamage = damage;
      playerData.health = Math.max(0, playerData.health - healthDamage);
    }

    playerData.lastDamage = Date.now();

    // Player damage details logging removed for production - too verbose

    // ✅ ARCHITECTURAL CLEANUP: Rimosso - non si creano più combat senza target
    // Il bilanciamento deve essere gestito diversamente se necessario
    // (ad esempio, con un sistema separato di "combat state" del player)

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
      ServerLoggerWrapper.system(`Removed NPC ${npcId} (${npcType})`);

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
    ServerLoggerWrapper.combat(`Player ${clientId} killed by ${attackerId || 'unknown'}`);

    // TODO: Potrebbe essere necessario chiamare logica di respawn player qui
    // Per ora lasciamo che sia gestito da altri sistemi (es. MessageRouter)
  }
}

module.exports = NpcDamageHandler;
