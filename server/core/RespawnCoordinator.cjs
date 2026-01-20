// RespawnCoordinator - Orchestra il respawn del player
// Delega specifiche responsabilità ad altri sistemi

const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');

class RespawnCoordinator {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.respawnSystem = null;
    this.statsSystem = null;
    this.penaltySystem = null;
  }

  // Imposta i sistemi da utilizzare
  setRespawnSystem(respawnSystem) {
    this.respawnSystem = respawnSystem;
  }

  setStatsSystem(statsSystem) {
    this.statsSystem = statsSystem;
  }

  setPenaltySystem(penaltySystem) {
    this.penaltySystem = penaltySystem;
  }

  /**
   * Gestisce il respawn completo del player
   */
  respawnPlayer(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) {
      ServerLoggerWrapper.warn('RESPAWN', `Player ${clientId} not found for respawn`);
      return false;
    }

    if (!playerData.isDead) {
      ServerLoggerWrapper.warn('RESPAWN', `Player ${clientId} is not dead, cannot respawn`);
      return false;
    }

    ServerLoggerWrapper.info('RESPAWN', `Starting respawn process for player ${clientId}`);

    try {
      // 1. Applica penalità di morte (se sistema presente)
      if (this.penaltySystem) {
        this.penaltySystem.applyDeathPenalty(clientId);
      }

      // 2. Reset stats del player (HP, shield, ecc.)
      if (this.statsSystem) {
        this.statsSystem.resetPlayerStats(clientId);
      } else {
        // Fallback: reset basilare
        this.resetPlayerStatsBasic(clientId);
      }

      // 3. Trova posizione di spawn sicura
      if (this.respawnSystem) {
        this.respawnSystem.respawnPlayerAtSafeLocation(clientId);
      } else {
        // Fallback: spawn a (0,0)
        this.respawnPlayerAtOrigin(clientId);
      }

      // 4. Segna come vivo
      playerData.isDead = false;
      playerData.respawnTime = null;

      // 5. Broadcast respawn agli altri player
      this.broadcastPlayerRespawn(clientId);

      ServerLoggerWrapper.info('RESPAWN', `Player ${clientId} respawned successfully`);
      return true;

    } catch (error) {
      ServerLoggerWrapper.error('RESPAWN', `Error respawning player ${clientId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Fallback: reset basilare degli stats
   */
  resetPlayerStatsBasic(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    playerData.health = 10000;
    playerData.shield = 10000;
    ServerLoggerWrapper.info('RESPAWN', `Applied basic stats reset for ${clientId}`);
  }

  /**
   * Fallback: spawn alla posizione (0,0)
   */
  respawnPlayerAtOrigin(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    playerData.position = { x: 0, y: 0 };
    ServerLoggerWrapper.info('RESPAWN', `Spawned ${clientId} at origin (0,0)`);
  }

  /**
   * Invia broadcast del respawn
   */
  broadcastPlayerRespawn(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Broadcast a tutti i client connessi
    for (const [otherClientId, otherPlayerData] of this.mapServer.players.entries()) {
      if (otherPlayerData.ws && otherClientId !== clientId) {
        try {
          otherPlayerData.ws.send(JSON.stringify({
            type: 'player_respawn',
            clientId: clientId,
            position: playerData.position,
            health: playerData.health,
            shield: playerData.shield
          }));
        } catch (error) {
          ServerLoggerWrapper.warn('RESPAWN', `Failed to broadcast respawn to ${otherClientId}: ${error.message}`);
        }
      }
    }
  }
}

module.exports = RespawnCoordinator;