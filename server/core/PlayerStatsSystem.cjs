// PlayerStatsSystem - Gestisce il calcolo e reset degli stats del player
// Basato sugli upgrade e altre modifiche permanenti

const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');

class PlayerStatsSystem {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.authManager = require('./auth/AuthenticationManager.cjs');
  }

  /**
   * Resetta gli stats del player ai valori massimi basati sugli upgrade
   */
  resetPlayerStats(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) {
      ServerLoggerWrapper.warn('STATS_SYSTEM', `Player ${clientId} not found for stats reset`);
      return false;
    }

    // Calcola HP e Shield massimi basati sugli upgrade
    const maxHealth = this.calculateMaxHealth(playerData);
    const maxShield = this.calculateMaxShield(playerData);

    // Reset agli stats massimi
    playerData.health = maxHealth;
    playerData.shield = maxShield;

    ServerLoggerWrapper.info('STATS_SYSTEM', `Reset stats for ${clientId}: HP=${maxHealth}, Shield=${maxShield}`);
    return true;
  }

  /**
   * Calcola il max health del player basato sugli upgrade
   */
  calculateMaxHealth(playerData) {
    if (!playerData.upgrades || playerData.upgrades.hpUpgrades === undefined) {
      ServerLoggerWrapper.warn('STATS_SYSTEM', `No HP upgrades found for player, using base value`);
      return 100000; // Valore base
    }

    return this.authManager.calculateMaxHealth(playerData.upgrades.hpUpgrades);
  }

  /**
   * Calcola il max shield del player basato sugli upgrade
   */
  calculateMaxShield(playerData) {
    if (!playerData.upgrades || playerData.upgrades.shieldUpgrades === undefined) {
      ServerLoggerWrapper.warn('STATS_SYSTEM', `No Shield upgrades found for player, using base value`);
      return 50000; // Valore base
    }

    return this.authManager.calculateMaxShield(playerData.upgrades.shieldUpgrades);
  }

  /**
   * Ottiene gli stats correnti del player
   */
  getPlayerStats(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return null;

    return {
      currentHealth: playerData.health,
      maxHealth: this.calculateMaxHealth(playerData),
      currentShield: playerData.shield,
      maxShield: this.calculateMaxShield(playerData)
    };
  }
}

module.exports = PlayerStatsSystem;