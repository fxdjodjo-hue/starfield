// PlayerStatsSystem - Gestisce il reset degli stats del player
// Usa i valori massimi già calcolati dal sistema di autenticazione

const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');

class PlayerStatsSystem {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Resetta gli stats del player al 10% dei valori massimi correnti
   * I valori massimi sono già stati calcolati dal sistema di autenticazione
   * basandosi sugli upgrade del player
   */
  resetPlayerStats(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) {
      ServerLoggerWrapper.warn('STATS_SYSTEM', `Player ${clientId} not found for stats reset`);
      return false;
    }

    // Usa i valori massimi già calcolati (non ricalcolarli)
    if (playerData.maxHealth === undefined || playerData.maxShield === undefined) {
      ServerLoggerWrapper.error('STATS_SYSTEM', `Player ${clientId} missing maxHealth/maxShield, using defaults`);
      playerData.health = 10000; // Fallback al 10% del base
      playerData.shield = 5000;  // Fallback al 10% del base
      return false;
    }

    // Reset al 10% degli stats massimi correnti del player (penalità morte)
    const respawnHealthPercent = 0.1; // 10%
    const respawnShieldPercent = 0.1; // 10%

    playerData.health = Math.floor(playerData.maxHealth * respawnHealthPercent);
    playerData.shield = Math.floor(playerData.maxShield * respawnShieldPercent);

    ServerLoggerWrapper.info('STATS_SYSTEM', `Reset stats for ${clientId}: HP=${playerData.health}/${playerData.maxHealth} (${respawnHealthPercent * 100}%), Shield=${playerData.shield}/${playerData.maxShield} (${respawnShieldPercent * 100}%)`);
    return true;
  }

  /**
   * Ottiene gli stats correnti del player
   */
  getPlayerStats(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return null;

    return {
      currentHealth: playerData.health,
      maxHealth: playerData.maxHealth,
      currentShield: playerData.shield,
      maxShield: playerData.maxShield
    };
  }
}

module.exports = PlayerStatsSystem;