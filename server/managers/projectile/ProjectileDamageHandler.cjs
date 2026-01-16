// ProjectileDamageHandler - Gestione danni e morte
// Responsabilità: Applicazione danni, gestione morte/respawn player
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');

class ProjectileDamageHandler {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Applica danno a un NPC
   * @param {string} npcId - ID dell'NPC
   * @param {number} damage - Danno da applicare
   * @param {string} attackerId - ID dell'attaccante
   * @returns {boolean} true se NPC morto
   */
  handleNpcDamage(npcId, damage, attackerId) {
    return this.mapServer.npcManager.damageNpc(npcId, damage, attackerId);
  }

  /**
   * Applica danno a un player
   * @param {string} clientId - ClientId del player
   * @param {number} damage - Danno da applicare
   * @param {string} attackerId - ID dell'attaccante
   * @returns {boolean} true se player morto
   */
  handlePlayerDamage(clientId, damage, attackerId) {
    return this.mapServer.npcManager.damagePlayer(clientId, damage, attackerId);
  }

  /**
   * Gestisce la morte di un giocatore
   * @param {string} clientId - ClientId del player
   * @param {string} killerId - ID del killer
   * @returns {Object|null} PlayerData del player morto (per broadcast esterno)
   */
  handlePlayerDeath(clientId, killerId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return null;

    playerData.isDead = true;
    playerData.respawnTime = Date.now() + 3000; // 3 secondi di respawn

    // Respawn dopo delay
    setTimeout(() => {
      this.respawnPlayer(clientId);
    }, 3000);

    return playerData; // Ritorna per permettere broadcast esterno
  }

  /**
   * Fai respawnare un giocatore
   * @param {string} clientId - ClientId del player
   */
  respawnPlayer(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Reset stats
    playerData.health = playerData.maxHealth;
    playerData.shield = playerData.maxShield;
    playerData.isDead = false;
    playerData.respawnTime = null;

    // Spawn in posizione sicura (vicino al centro per ora)
    playerData.position = {
      x: (Math.random() - 0.5) * 1000, // ±500 dal centro
      y: (Math.random() - 0.5) * 1000
    };

    logger.info('PLAYER', `Player ${clientId} respawned at (${playerData.position.x.toFixed(0)}, ${playerData.position.y.toFixed(0)})`);
  }

  /**
   * Calcola ricompense per distruzione NPC
   * @param {Object} npc - NPC distrutto
   * @returns {Object} Ricompense {credits, experience, honor}
   */
  calculateRewards(npc) {
    const baseRewards = {
      Scouter: { credits: 50, experience: 10, honor: 5 },
      Kronos: { credits: 100, experience: 20, honor: 10 }
    };

    return baseRewards[npc.type] || { credits: 25, experience: 5, honor: 2 };
  }
}

module.exports = ProjectileDamageHandler;
