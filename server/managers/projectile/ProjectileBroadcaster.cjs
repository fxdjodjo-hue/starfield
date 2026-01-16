// ProjectileBroadcaster - Broadcasting eventi proiettili
// Responsabilità: Invio messaggi ai client per eventi proiettili
// Dipendenze: logger.cjs, mapServer, SERVER_CONSTANTS

const { logger } = require('../../logger.cjs');
const { SERVER_CONSTANTS } = require('../../config/constants.cjs');

class ProjectileBroadcaster {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Broadcast creazione proiettile
   * @param {Object} projectile - Proiettile
   * @param {string|null} excludeClientId - ClientId da escludere (mittente)
   */
  broadcastProjectileFired(projectile, excludeClientId) {
    const message = {
      type: 'projectile_fired',
      projectileId: projectile.id,
      playerId: projectile.playerId, // Questo è il clientId del player che ha sparato
      position: projectile.position,
      velocity: projectile.velocity,
      damage: projectile.damage,
      projectileType: projectile.projectileType,
      targetId: projectile.targetId
    };

    // Interest radius per proiettili
    const clientsInRange = this.mapServer.broadcastNear(projectile.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message, excludeClientId);
  }

  /**
   * Broadcast distruzione proiettile
   * @param {string} projectileId - ID del proiettile
   * @param {string} reason - Motivo distruzione
   * @param {Object} projectile - Proiettile (opzionale, se non fornito cerca nel map)
   */
  broadcastProjectileDestroyed(projectileId, reason, projectile = null) {
    if (!projectile) {
      // Se non fornito, cerca nel map (per backward compatibility)
      projectile = this.mapServer.projectileManager?.projectiles?.get(projectileId);
    }
    
    if (!projectile) return;

    const message = {
      type: 'projectile_destroyed',
      projectileId,
      reason
    };

    // Interest radius per distruzione proiettili
    this.mapServer.broadcastNear(projectile.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
  }

  /**
   * Broadcast distruzione proiettile con posizione specifica (per rimozioni immediate)
   * @param {string} projectileId - ID del proiettile
   * @param {string} reason - Motivo distruzione
   * @param {Object} position - Posizione {x, y}
   */
  broadcastProjectileDestroyedAtPosition(projectileId, reason, position) {
    const message = {
      type: 'projectile_destroyed',
      projectileId,
      reason
    };

    // Interest radius per distruzione proiettili
    this.mapServer.broadcastNear(position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
  }

  /**
   * Broadcast danno a entità
   * @param {Object} entity - Entità danneggiata (NPC o player)
   * @param {Object} projectile - Proiettile che ha causato il danno
   * @param {string} entityType - Tipo entità ('npc' o 'player')
   */
  broadcastEntityDamaged(entity, projectile, entityType = 'npc') {
    const message = {
      type: 'entity_damaged',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      damage: projectile.damage,
      attackerId: projectile.playerId,
      newHealth: entity.health,
      newShield: entity.shield,
      position: entity.position
    };

    if (entityType === 'player') {
      // Per danni ai giocatori, broadcast globale - tutti devono sapere se un giocatore viene danneggiato
      this.mapServer.broadcastToMap(message);
    } else {
      // Per danni agli NPC, usa interest radius
      this.mapServer.broadcastNear(entity.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
    }
  }

  /**
   * Broadcast distruzione entità
   * @param {Object} entity - Entità distrutta
   * @param {string} destroyerId - ID del distruttore
   * @param {string} entityType - Tipo entità ('npc' o 'player')
   * @param {Object} rewards - Ricompense (opzionale, solo per NPC)
   */
  broadcastEntityDestroyed(entity, destroyerId, entityType = 'npc', rewards = undefined) {
    // PRIMA: Crea e broadcasta l'esplosione per effetti visivi sincronizzati
    const explosionId = `expl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const explosionMessage = {
      type: 'explosion_created',
      explosionId: explosionId,
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      position: entity.position,
      explosionType: 'entity_death'
    };

    // Broadcast esplosione con interest radius di 2000 unità
    this.mapServer.broadcastNear(entity.position, 2000, explosionMessage);

    // POI: Il messaggio entity_destroyed esistente
    const message = {
      type: 'entity_destroyed',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      destroyerId,
      position: entity.position,
      rewards: entityType === 'npc' ? rewards : undefined
    };

    // Interest radius: TUTTO IL MONDO per distruzioni NPC (minimappa globale richiede aggiornamenti globali)
    console.log(`[SERVER] Broadcasting entity_destroyed: ${entity.id} (${entityType}) at ${entity.position.x.toFixed(0)},${entity.position.y.toFixed(0)} - radius: 50000`);
    this.mapServer.broadcastNear(entity.position, 50000, message);
  }

  /**
   * Broadcast respawn giocatore
   * @param {Object} playerData - Dati player
   */
  broadcastPlayerRespawn(playerData) {
    const message = {
      type: 'player_respawn',
      clientId: playerData.clientId,
      position: playerData.position,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      shield: playerData.shield,
      maxShield: playerData.maxShield
    };

    // Broadcast a tutti i giocatori
    this.mapServer.broadcastToMap(message);
  }

  /**
   * Trasmissione aggiornamenti posizione proiettili homing ai client
   * Invia aggiornamenti per TUTTI i proiettili NPC homing a tutti i client interessati
   * @param {Map} projectilesMap - Map dei proiettili attivi
   */
  broadcastHomingProjectileUpdates(projectilesMap) {
    const homingProjectiles = Array.from(projectilesMap.values())
      .filter(proj => proj.targetId && proj.targetId !== -1 && proj.playerId.startsWith('npc_'));

    if (homingProjectiles.length === 0) return;

    // Prepara array di aggiornamenti per tutti i proiettili
    const projectiles = homingProjectiles.map(projectile => ({
      id: projectile.id,
      position: {
        x: projectile.position.x,
        y: projectile.position.y
      },
      velocity: {
        x: projectile.velocity.x,
        y: projectile.velocity.y
      }
    }));

    const message = {
      type: 'projectile_updates',
      projectiles: projectiles,
      timestamp: Date.now()
    };

    // Broadcast a TUTTI i client connessi (i proiettili NPC homing devono essere visibili a tutti)
    // Il raggio di interesse è globale per proiettili NPC che seguono player
    this.mapServer.broadcastToMap(message);
  }
}

module.exports = ProjectileBroadcaster;
