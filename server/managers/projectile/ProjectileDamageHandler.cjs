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

    // FERMA TUTTI I COMBATTIMENTI DEL PLAYER MORTO
    if (this.mapServer.combatManager && typeof this.mapServer.combatManager.stopPlayerCombat === 'function') {
      logger.info('COMBAT', `Stopping all combat for dead player: ${clientId}`);
      this.mapServer.combatManager.stopPlayerCombat(clientId);
    }

    // Rimuovi respawn automatico - ora gestito dal client

    return playerData; // Ritorna per permettere broadcast esterno
  }

  /**
   * Fai respawnare un giocatore
   * @param {string} clientId - ClientId del player
   */
  respawnPlayer(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Reset stats - valori fissi al respawn
    playerData.health = 10000;
    playerData.shield = 10000;
    playerData.isDead = false;
    playerData.respawnTime = null;

    // Spawn sempre nella stessa posizione sicura (0,0) per evitare NPC
    playerData.position = {
      x: 0,
      y: 0
    };

    logger.info('PLAYER', `Player ${clientId} respawned at (${playerData.position.x.toFixed(0)}, ${playerData.position.y.toFixed(0)})`);

    // Invia messaggio di respawn a tutti i client
    this.mapServer.broadcastToMap({
      type: 'player_respawn',
      clientId: clientId,
      position: playerData.position,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      shield: playerData.shield,
      maxShield: playerData.maxShield
    });
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
