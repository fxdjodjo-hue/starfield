// ProjectileSpawner - Gestione spawn e creazione proiettili
// Responsabilità: Creazione, registrazione e setup iniziale proiettili
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');

class ProjectileSpawner {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Crea struttura dati per un nuovo proiettile
   * @param {string} projectileId - ID univoco del proiettile
   * @param {string} playerId - ID del player/NPC che ha sparato
   * @param {Object} position - Posizione iniziale {x, y}
   * @param {Object} velocity - Velocità iniziale {x, y}
   * @param {number} damage - Danno del proiettile
   * @param {string} projectileType - Tipo proiettile (laser, missile, etc.)
   * @param {string|null} targetId - ID del target (per homing)
   * @param {'player'|'pet'|'npc'|null} projectileSource - Origine logica del proiettile
   * @returns {Object} Proiettile data object
   */
  createProjectileData(projectileId, playerId, position, velocity, damage, projectileType = 'laser', targetId = null, projectileSource = null) {
    const projectile = {
      id: projectileId,
      playerId,
      projectileSource: this.normalizeProjectileSource(projectileSource, playerId),
      position: { ...position },
      velocity: { ...velocity },
      damage,
      projectileType,
      targetId, // ID del bersaglio (per homing projectiles)
      createdAt: Date.now(),
      lastUpdate: Date.now(),
      initialDistance: targetId ? this.calculateInitialDistance(position, targetId) : null
    };

    return projectile;
  }

  normalizeProjectileSource(projectileSource, playerId) {
    const normalizedSource = String(projectileSource || '').trim().toLowerCase();
    if (normalizedSource === 'player' || normalizedSource === 'pet' || normalizedSource === 'npc') {
      return normalizedSource;
    }

    const normalizedPlayerId = String(playerId || '').trim();
    if (normalizedPlayerId.startsWith('npc_')) {
      return 'npc';
    }

    return 'player';
  }

  /**
   * Calcola la distanza iniziale dal target al momento della creazione
   * @param {Object} projectilePosition - Posizione iniziale proiettile {x, y}
   * @param {string} targetId - ID del target
   * @returns {number|null} Distanza iniziale o null se target non trovato
   */
  calculateInitialDistance(projectilePosition, targetId) {
    const targetPosition = this.getTargetPosition(targetId);
    if (!targetPosition) return null;

    return Math.sqrt(
      Math.pow(projectilePosition.x - targetPosition.x, 2) +
      Math.pow(projectilePosition.y - targetPosition.y, 2)
    );
  }

  /**
   * Ottiene posizione corrente di un target (player o NPC)
   * @param {string} targetId - ID del target
   * @returns {Object|null} Posizione {x, y} o null se non trovato
   */
  getTargetPosition(targetId) {
    // Prima cerca tra i giocatori
    if (this.mapServer.players.has(targetId)) {
      const playerData = this.mapServer.players.get(targetId);
      if (!playerData.position || playerData.isDead) return null;
      return playerData.position;
    }

    // Poi cerca tra gli NPC
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      if (npc.id === targetId) {
        return npc.position;
      }
    }

    return null; // Target non trovato
  }
}

module.exports = ProjectileSpawner;
