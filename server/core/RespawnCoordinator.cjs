// RespawnCoordinator - Orchestra il respawn del player
// Delega specifiche responsabilità ad altri sistemi

const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');
const playerConfig = require('../../shared/player-config.json');

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
   * Fallback: reset basilare degli stats (10% dei valori base)
   */
  resetPlayerStatsBasic(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Valori base massimi (senza upgrade)
    // Valori base massimi (senza upgrade)
    const baseMaxHealth = playerConfig.stats.health;
    const baseMaxShield = playerConfig.stats.shield;

    // Respawn al 10% dei valori base
    playerData.health = Math.floor(baseMaxHealth * 0.1);
    playerData.shield = Math.floor(baseMaxShield * 0.1);
    ServerLoggerWrapper.info('RESPAWN', `Applied basic stats reset for ${clientId}: HP=${playerData.health}, Shield=${playerData.shield} (10% of base)`);
  }

  /**
   * Fallback: spawn alla posizione (0,0)
   */
  respawnPlayerAtOrigin(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    playerData.position = { x: 400, y: 0 };
    ServerLoggerWrapper.info('RESPAWN', `Spawned ${clientId} at safe location (400, 0)`);
  }

  /**
   * Invia broadcast del respawn
   */
  broadcastPlayerRespawn(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Invia messaggio al player che sta facendo respawn (IMPORTANTE!)
    if (playerData.ws) {
      try {
        playerData.ws.send(JSON.stringify({
          type: 'player_respawn',
          clientId: clientId,
          position: playerData.position,
          health: playerData.health,
          maxHealth: playerData.maxHealth,
          shield: playerData.shield,
          maxShield: playerData.maxShield
        }));
        ServerLoggerWrapper.info('RESPAWN', `Sent respawn message to player ${clientId}`);
      } catch (error) {
        ServerLoggerWrapper.warn('RESPAWN', `Failed to send respawn to player ${clientId}: ${error.message}`);
      }
    }

    // Broadcast agli altri player (per aggiornare la loro vista)
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