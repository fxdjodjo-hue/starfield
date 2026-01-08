// ServerProjectileManager - Gestione proiettili e fisica server-side
// Dipendenze consentite: logger.cjs, config/constants.cjs

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS } = require('../config/constants.cjs');

class ServerProjectileManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.projectiles = new Map(); // projectileId -> projectile data
    this.collisionChecks = new Map(); // clientId -> last collision check time
  }

  /**
   * Registra un nuovo proiettile sparato da un giocatore
   */
  addProjectile(projectileId, playerId, position, velocity, damage, projectileType = 'laser', targetId = null, excludeSender = true) {
    const projectile = {
      id: projectileId,
      playerId,
      position: { ...position },
      velocity: { ...velocity },
      damage,
      projectileType,
      targetId, // ID del bersaglio (per homing projectiles)
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };

    this.projectiles.set(projectileId, projectile);
    logger.debug('PROJECTILE', `Projectile ${projectileId} added for player ${playerId}`);

    // Broadcast ai client - escludi il mittente solo se richiesto
    const excludeClientId = excludeSender ? playerId : null;
    this.broadcastProjectileFired(projectile, excludeClientId);
  }

  /**
   * Aggiorna posizione di un proiettile
   */
  updateProjectile(projectileId, position) {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    projectile.position = { ...position };
    projectile.lastUpdate = Date.now();
  }

  /**
   * Rimuove un proiettile (distrutto o fuori schermo)
   */
  removeProjectile(projectileId, reason = 'unknown') {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    this.projectiles.delete(projectileId);
    console.log(`💥 [SERVER] Projectile ${projectileId} removed (${reason})`);

    // Broadcast distruzione a tutti i client
    this.broadcastProjectileDestroyed(projectileId, reason);
  }

  /**
   * Verifica collisioni tra proiettili e NPC/giocatori
   */
  checkCollisions() {
    const now = Date.now();
    const projectilesToRemove = [];

    for (const [projectileId, projectile] of this.projectiles.entries()) {
      // Simula movimento del proiettile (aggiorna posizione)
      const deltaTime = (now - projectile.lastUpdate) / 1000; // secondi
      projectile.position.x += projectile.velocity.x * deltaTime;
      projectile.position.y += projectile.velocity.y * deltaTime;
      projectile.lastUpdate = now;

      // Verifica collisioni con il TARGET SPECIFICO (se presente)
      if (projectile.targetId && projectile.targetId !== -1) {
        // Questo proiettile ha un target specifico - verifica solo quel target
        const targetHit = this.checkSpecificTargetCollision(projectile);
        if (targetHit) {
          console.log(`🎯 [SERVER] Projectile ${projectileId} HIT target ${targetHit.entity.id} with ${projectile.damage} damage`);
          if (targetHit.type === 'npc') {
            // Applica danno all'NPC target
            console.log(`💥 [SERVER] Applying ${projectile.damage} damage to NPC ${targetHit.entity.id} (was ${targetHit.entity.health}/${targetHit.entity.shield})`);
            const npcDead = this.mapServer.npcManager.damageNpc(targetHit.entity.id, projectile.damage, projectile.playerId);
            console.log(`❤️ [SERVER] NPC ${targetHit.entity.id} after damage: ${targetHit.entity.health} HP, ${targetHit.entity.shield} shield, dead=${npcDead}`);
            this.broadcastEntityDamaged(targetHit.entity, projectile);

            if (npcDead) {
              this.broadcastEntityDestroyed(targetHit.entity, projectile.playerId);
            }

          } else if (targetHit.type === 'player') {
            // Applica danno al giocatore target
            const playerDead = this.damagePlayer(targetHit.entity.clientId, projectile.damage, projectile.playerId);
            this.broadcastEntityDamaged(targetHit.entity, projectile, 'player');

            if (playerDead) {
              logger.info('COMBAT', `Player ${targetHit.entity.clientId} killed by ${projectile.playerId}`);
            }

            logger.debug('PROJECTILE', `Projectile ${projectileId} hit intended player target ${targetHit.entity.clientId}`);
          }

          projectilesToRemove.push(projectileId);
          continue;
        }
      }

      // Per proiettili CON target specifico: NON permettere collisioni accidentali
      // Il proiettile deve colpire ESATTAMENTE il target o continuare il volo
      if (projectile.targetId && projectile.targetId !== -1) {
        // Questo proiettile ha un target specifico - ignora collisioni accidentali
        console.log(`🎯 [SERVER] Projectile ${projectileId} with target ${projectile.targetId} continues flight (no accidental hits)`);
        // Non rimuovere il proiettile - continua il volo
        continue;
      }

      // Debug: se un proiettile non ha colpito niente, logga la posizione
      console.log(`❓ [SERVER] Projectile ${projectileId} (target: ${projectile.targetId || 'none'}) checked but no collision at position (${projectile.position.x.toFixed(0)}, ${projectile.position.y.toFixed(0)})`);

      // Fallback: collisioni generiche SOLO per proiettili senza target specifico (NPC projectiles)
      // Verifica collisioni con NPC
      const hitNpc = this.checkNpcCollision(projectile);
      if (hitNpc) {
        const npcDead = this.mapServer.npcManager.damageNpc(hitNpc.id, projectile.damage, projectile.playerId);
        this.broadcastEntityDamaged(hitNpc, projectile);

        if (npcDead) {
          this.broadcastEntityDestroyed(hitNpc, projectile.playerId);
        }

        projectilesToRemove.push(projectileId);
        console.log(`💥 [SERVER] Projectile ${projectileId} hit NPC ${hitNpc.id} (generic collision)`);
        continue;
      }

      // Verifica collisioni con giocatori
      const hitPlayer = this.checkPlayerCollision(projectile);
      if (hitPlayer) {
        const playerDead = this.damagePlayer(hitPlayer.clientId, projectile.damage, projectile.playerId);
        this.broadcastEntityDamaged(hitPlayer.playerData, projectile, 'player');

        if (playerDead) {
          logger.info('COMBAT', `Player ${hitPlayer.clientId} killed by ${projectile.playerId}`);
        }

        projectilesToRemove.push(projectileId);
        console.log(`💥 [SERVER] Projectile ${projectileId} hit player ${hitPlayer.clientId} (generic collision)`);
        continue;
      }

      // Verifica se proiettile è fuori dai confini del mondo
      if (this.isOutOfBounds(projectile.position)) {
        console.log(`🌍 [SERVER] Projectile ${projectileId} out of bounds at (${projectile.position.x.toFixed(0)}, ${projectile.position.y.toFixed(0)})`);
        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica timeout (proiettili troppo vecchi vengono rimossi)
      if (now - projectile.createdAt > 10000) { // 10 secondi
        console.log(`⏰ [SERVER] Projectile ${projectileId} timed out after ${(now - projectile.createdAt)/1000}s`);
        projectilesToRemove.push(projectileId);
        continue;
      }
    }

    // Rimuovi proiettili distrutti
    projectilesToRemove.forEach(id => {
      // Determina il motivo specifico della rimozione
      const projectile = this.projectiles.get(id);
      let reason = 'collision';
      if (projectile) {
        if (this.isOutOfBounds(projectile.position)) {
          reason = 'out_of_bounds';
        } else if (now - projectile.createdAt > 10000) {
          reason = 'timeout';
        }
      }
      this.removeProjectile(id, reason);
    });
  }

  /**
   * Verifica collisione con NPC
   */
  checkNpcCollision(projectile) {
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      const distance = Math.sqrt(
        Math.pow(projectile.position.x - npc.position.x, 2) +
        Math.pow(projectile.position.y - npc.position.y, 2)
      );

      // Collisione se distanza < 50 pixel (dimensione nave)
      if (distance < 50) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Verifica collisione proiettile con giocatori
   */
  checkPlayerCollision(projectile) {
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      // Salta il giocatore che ha sparato il proiettile
      if (clientId === projectile.playerId) continue;

      // Salta giocatori morti o senza posizione
      if (!playerData.position || playerData.isDead) continue;

      const distance = Math.sqrt(
        Math.pow(projectile.position.x - playerData.position.x, 2) +
        Math.pow(projectile.position.y - playerData.position.y, 2)
      );

      // Collisione se distanza < 50 pixel (dimensione nave)
      if (distance < 50) {
        return { playerData, clientId };
      }
    }
    return null;
  }

  /**
   * Verifica collisione proiettile con il suo target specifico
   */
  checkSpecificTargetCollision(projectile) {
    const targetId = projectile.targetId;

    // Prima cerca tra gli NPC (gli NPC hanno ID come "npc_0", "npc_1", etc.)
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      if (npc.id === targetId) {
        const distance = Math.sqrt(
          Math.pow(projectile.position.x - npc.position.x, 2) +
          Math.pow(projectile.position.y - npc.position.y, 2)
        );

        console.log(`📏 [SERVER] Projectile ${projectile.id} distance to target NPC ${npc.id}: ${distance.toFixed(1)}px (hit threshold: 50px)`);

        if (distance < 50) {
          console.log(`✅ [SERVER] Projectile ${projectile.id} HIT NPC ${npc.id} at distance ${distance.toFixed(1)}px`);
          return { entity: npc, type: 'npc' };
        } else {
          console.log(`❌ [SERVER] Projectile ${projectile.id} MISSED NPC ${npc.id} at distance ${distance.toFixed(1)}px`);
        }
        break; // Trovato l'NPC target, non cercare altri
      }
    }

    // Poi cerca tra i giocatori (i giocatori hanno ID come stringhe client)
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      // Salta il giocatore che ha sparato il proiettile
      if (clientId === projectile.playerId) continue;

      // Controlla se questo giocatore è il target
      if (clientId === targetId || playerData.playerId?.toString() === targetId?.toString()) {
        // Salta giocatori morti o senza posizione
        if (!playerData.position || playerData.isDead) continue;

        const distance = Math.sqrt(
          Math.pow(projectile.position.x - playerData.position.x, 2) +
          Math.pow(projectile.position.y - playerData.position.y, 2)
        );

        if (distance < 50) {
          return { entity: playerData, type: 'player' };
        }
        break; // Trovato il giocatore target, non cercare altri
      }
    }

    return null; // Target specifico non trovato o non in range
  }

  /**
   * Verifica se posizione è fuori dai confini del mondo
   */
  isOutOfBounds(position) {
    const worldSize = 25000; // Raggio del mondo
    return Math.abs(position.x) > worldSize || Math.abs(position.y) > worldSize;
  }

  /**
   * Broadcast creazione proiettile
   */
  broadcastProjectileFired(projectile, excludeClientId) {
    const message = {
      type: 'projectile_fired',
      projectileId: projectile.id,
      playerId: projectile.playerId,
      position: projectile.position,
      velocity: projectile.velocity,
      damage: projectile.damage,
      projectileType: projectile.projectileType,
      targetId: projectile.targetId
    };

    // Interest radius per proiettili
    this.mapServer.broadcastNear(projectile.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message, excludeClientId);
    console.log(`📡 [SERVER] Broadcast projectile ${projectile.id} from ${projectile.playerId} to clients (exclude: ${excludeClientId})`);
  }

  /**
   * Broadcast distruzione proiettile
   */
  broadcastProjectileDestroyed(projectileId, reason) {
    const projectile = this.projectiles.get(projectileId);
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
   * Gestisce la morte di un giocatore
   */
  handlePlayerDeath(clientId, killerId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    console.log(`💀 [SERVER] Player ${clientId} died! Killer: ${killerId}`);

    playerData.isDead = true;
    playerData.respawnTime = Date.now() + 3000; // 3 secondi di respawn

    // Broadcast morte
    this.broadcastEntityDestroyed(playerData, killerId);

    // Respawn dopo delay
    setTimeout(() => {
      this.respawnPlayer(clientId);
    }, 3000);
  }

  /**
   * Fai respawnare un giocatore
   */
  respawnPlayer(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Reset stats
    playerData.health = playerData.maxHealth;
    playerData.shield = playerData.maxShield;
    playerData.isDead = false;
    playerData.respawnTime = null;

    // Spawn in posizione sicura (vicino al centro per ora)
    playerData.position = {
      x: (Math.random() - 0.5) * 1000, // ±500 dal centro
      y: (Math.random() - 0.5) * 1000
    };

    logger.info('PLAYER', `Player ${clientId} respawned at (${playerData.position.x.toFixed(0)}, ${playerData.position.y.toFixed(0)})`);

    // Broadcast respawn
    this.broadcastPlayerRespawn(playerData);
  }

  /**
   * Broadcast danno a entità
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

    console.log(`📡 [SERVER] Broadcasting entity_damaged: ${entityType} ${entity.id || entity.clientId} took ${projectile.damage} damage, newHealth=${entity.health}`);

    if (entityType === 'player') {
      // Per danni ai giocatori, broadcast globale - tutti devono sapere se un giocatore viene danneggiato
      this.mapServer.broadcast(message);
    } else {
      // Per danni agli NPC, usa interest radius
      this.mapServer.broadcastNear(entity.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
    }
  }

  /**
   * Broadcast distruzione entità
   */
  broadcastEntityDestroyed(entity, destroyerId, entityType = 'npc') {
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
    console.log(`💥 [SERVER] Explosion created for ${entityType} ${entityType === 'npc' ? entity.id : entity.clientId} death`);

    // POI: Il messaggio entity_destroyed esistente
    const message = {
      type: 'entity_destroyed',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      destroyerId,
      position: entity.position,
      rewards: entityType === 'npc' ? this.calculateRewards(entity) : undefined
    };

    // Interest radius: 2000 unità per distruzioni (più ampio per effetti visivi)
    this.mapServer.broadcastNear(entity.position, 2000, message);
  }

  /**
   * Broadcast respawn giocatore
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
    this.mapServer.broadcast(message);
  }

  /**
   * Calcola ricompense per distruzione NPC
   */
  calculateRewards(npc) {
    const baseRewards = {
      Scouter: { credits: 50, experience: 10, honor: 5 },
      Frigate: { credits: 100, experience: 20, honor: 10 }
    };

    return baseRewards[npc.type] || { credits: 25, experience: 5, honor: 2 };
  }


  /**
   * Statistiche proiettili attivi
   */
  getStats() {
    return {
      activeProjectiles: this.projectiles.size,
      projectilesByType: Array.from(this.projectiles.values()).reduce((acc, proj) => {
        acc[proj.projectileType] = (acc[proj.projectileType] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = ServerProjectileManager;
