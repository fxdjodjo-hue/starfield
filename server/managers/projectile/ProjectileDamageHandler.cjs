// ProjectileDamageHandler - Gestione danni e morte
// Responsabilità: Applicazione danni, delega respawn al RespawnCoordinator
// Dipendenze: logger.cjs, mapServer, RespawnCoordinator

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const RespawnCoordinator = require('../../core/RespawnCoordinator.cjs');
const RespawnSystem = require('../../core/RespawnSystem.cjs');
const PlayerStatsSystem = require('../../core/PlayerStatsSystem.cjs');
const PenaltySystem = require('../../core/PenaltySystem.cjs');

class ProjectileDamageHandler {
  constructor(mapServer) {
    this.mapServer = mapServer;

    // Inizializza RespawnCoordinator con i sistemi
    this.respawnCoordinator = new RespawnCoordinator(mapServer);
    this.respawnCoordinator.setRespawnSystem(new RespawnSystem(mapServer));
    this.respawnCoordinator.setStatsSystem(new PlayerStatsSystem(mapServer));
    this.respawnCoordinator.setPenaltySystem(new PenaltySystem(mapServer));
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
      ServerLoggerWrapper.combat(`Stopping all combat for dead player: ${clientId}`);
      this.mapServer.combatManager.stopPlayerCombat(clientId);
    }

    // FA DIMENTICARE IL PLAYER MORTO A TUTTI GLI NPC CHE LO STAVANO ATTACCANDO
    if (this.mapServer.npcManager && typeof this.mapServer.npcManager.forgetDeadPlayer === 'function') {
      const forgottenCount = this.mapServer.npcManager.forgetDeadPlayer(clientId);
      if (forgottenCount > 0) {
        ServerLoggerWrapper.combat(`Made ${forgottenCount} NPCs forget dead player: ${clientId}`);
      }
    }

    // Rimuovi respawn automatico - ora gestito dal client

    return playerData; // Ritorna per permettere broadcast esterno
  }

  /**
   * Fai respawnare un giocatore
   * Delega tutto al RespawnCoordinator per separazione delle responsabilità
   * @param {string} clientId - ClientId del player
   */
  respawnPlayer(clientId) {
    // Delega il respawn completo al RespawnCoordinator
    // Questo mantiene il Death System separato dalla logica di respawn
    const success = this.respawnCoordinator.respawnPlayer(clientId);

    if (success) {
      ServerLoggerWrapper.info('DAMAGE_HANDLER', `Player ${clientId} respawn delegated to RespawnCoordinator`);
    } else {
      ServerLoggerWrapper.error('DAMAGE_HANDLER', `Failed to respawn player ${clientId}`);
    }
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
