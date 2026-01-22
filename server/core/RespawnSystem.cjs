// RespawnSystem - Gestisce le posizioni di respawn dei player
// Per ora mantiene spawn semplice ma può essere esteso

const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');

class RespawnSystem {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Spawna un player in una posizione sicura
   * Per ora: sempre (0,0) come richiesto
   */
  respawnPlayerAtSafeLocation(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) {
      ServerLoggerWrapper.warn('RESPAWN_SYSTEM', `Player ${clientId} not found`);
      return false;
    }

    // Spawn sicuro fisso a (400, 0) - come richiesto dall'utente
    const safeSpawnPosition = { x: 400, y: 0 };

    playerData.position = { ...safeSpawnPosition };

    ServerLoggerWrapper.info('RESPAWN_SYSTEM', `Player ${clientId} respawned at safe location: (${safeSpawnPosition.x}, ${safeSpawnPosition.y})`);
    return true;
  }

  /**
   * In futuro: potrebbe trovare posizioni spawn più intelligenti
   * - Lontano da NPC pericolosi
   * - Vicino a checkpoint
   * - Basato su progresso del player
   */
  findSafeSpawnLocation(clientId) {
    // Per ora: sempre (0,0)
    return { x: 0, y: 0 };
  }
}

module.exports = RespawnSystem;