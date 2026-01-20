// PenaltySystem - Gestisce penalità per eventi di gioco
// Per ora placeholder - può essere esteso per penalità di morte, ecc.

const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');

class PenaltySystem {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Applica penalità per morte del player
   * Per ora: nessuna penalità
   * Futuro: perdita esperienza, crediti, ecc.
   */
  applyDeathPenalty(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Per ora nessuna penalità - placeholder per future implementazioni
    ServerLoggerWrapper.info('PENALTY_SYSTEM', `Applied death penalty for ${clientId} (none currently)`);

    // Futuro: potrebbe sottrarre esperienza, crediti, ecc.
    // playerData.inventory.experience -= penaltyAmount;
    // playerData.inventory.credits -= penaltyAmount;
  }
}

module.exports = PenaltySystem;