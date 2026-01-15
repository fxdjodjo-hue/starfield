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
      lastUpdate: Date.now(),
      initialDistance: targetId ? this.calculateInitialDistance(position, targetId) : null
    };

    this.projectiles.set(projectileId, projectile);

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
      // MEMORY LEAK FIX: Controlla se il proiettile è "orfano" (senza target valido)
      if (this.isProjectileOrphaned(projectile)) {
        projectilesToRemove.push({
          id: projectileId,
          reason: 'orphaned_target'
        });
        continue;
      }

      // HOMING LOGIC: Per tutti i proiettili con target (player e NPC)
      // I proiettili NPC hanno homing diretto (non graduale) per colpire player in movimento
      const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');
      
      if (projectile.targetId && projectile.targetId !== -1) {
        const homingResult = this.updateProjectileHoming(projectile);
        if (!homingResult) {
          // Target non trovato - rimuovi proiettile immediatamente per prevenire memory leak
          projectilesToRemove.push({
            id: projectileId,
            reason: 'target_not_found'
          });
          continue;
        }
      }

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
          if (targetHit.type === 'npc') {
            // Applica danno all'NPC target
            const npcDead = this.mapServer.npcManager.damageNpc(targetHit.entity.id, projectile.damage, projectile.playerId);
            this.broadcastEntityDamaged(targetHit.entity, projectile);

            if (npcDead) {
              this.broadcastEntityDestroyed(targetHit.entity, projectile.playerId);
            }

          } else if (targetHit.type === 'player') {
            // Applica danno al giocatore target
            const playerDead = this.mapServer.npcManager.damagePlayer(targetHit.entity.clientId, projectile.damage, projectile.playerId);
            this.broadcastEntityDamaged(targetHit.entity, projectile, 'player');

            if (playerDead) {
              logger.info('COMBAT', `Player ${targetHit.entity.clientId} killed by ${projectile.playerId}`);
            }
          }

          projectilesToRemove.push({
            id: projectileId,
            reason: 'target_hit'
          });
          continue;
        } else {
          // MEMORY LEAK PREVENTION: Controlli multipli per rimuovere proiettili homing problematici

          // 1. Se è troppo lontano dal target originale, rimuovilo
          const maxDistance = this.getMaxTargetDistance(projectile);
          if (maxDistance > 0) {
            const currentDistance = this.getDistanceToTarget(projectile);
            if (currentDistance > maxDistance) {
              projectilesToRemove.push({
                id: projectileId,
                reason: 'target_too_far'
              });
              continue;
            }
          }

          // 2. Se è troppo vecchio e homing, rimuovilo (extra safety)
          const homingTimeout = projectile.playerId.startsWith('npc_') ? 12000 : 8000; // NPC hanno più tempo
          if (now - projectile.createdAt > homingTimeout) {
            projectilesToRemove.push({
              id: projectileId,
              reason: 'homing_timeout'
            });
            continue;
          }
        }
      }

      // Per proiettili CON target specifico: verifica anche collisioni generiche come fallback
      // (soprattutto per proiettili NPC che potrebbero mancare il target se si muove velocemente)
      // isNpcProjectile è già dichiarato sopra alla riga 81
      
      // Se è un proiettile NPC con target, verifica anche collisioni generiche come fallback
      if (isNpcProjectile && projectile.targetId && projectile.targetId !== -1) {
        // Fallback: verifica collisioni generiche per proiettili NPC
        const hitPlayer = this.checkPlayerCollision(projectile);
        if (hitPlayer) {
          const playerDead = this.mapServer.npcManager.damagePlayer(hitPlayer.clientId, projectile.damage, projectile.playerId);
          this.broadcastEntityDamaged(hitPlayer.playerData, projectile, 'player');

          if (playerDead) {
            logger.info('COMBAT', `Player ${hitPlayer.clientId} killed by ${projectile.playerId}`);
          }

          projectilesToRemove.push(projectileId);
          continue;
        }
      }

      // Proiettili senza target specifico continuano la verifica collisioni

      // Fallback: collisioni generiche SOLO per proiettili senza target specifico
      // Verifica collisioni con NPC
      const hitNpc = this.checkNpcCollision(projectile);
      if (hitNpc) {
        const npcDead = this.mapServer.npcManager.damageNpc(hitNpc.id, projectile.damage, projectile.playerId);
        this.broadcastEntityDamaged(hitNpc, projectile);

        if (npcDead) {
          this.broadcastEntityDestroyed(hitNpc, projectile.playerId);
        }

        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica collisioni con giocatori
      const hitPlayer = this.checkPlayerCollision(projectile);
      if (hitPlayer) {
        const playerDead = this.mapServer.npcManager.damagePlayer(hitPlayer.clientId, projectile.damage, projectile.playerId);
        this.broadcastEntityDamaged(hitPlayer.playerData, projectile, 'player');

        if (playerDead) {
          logger.info('COMBAT', `Player ${hitPlayer.clientId} killed by ${projectile.playerId}`);
        }

        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica se proiettile è fuori dai confini del mondo
      if (this.isOutOfBounds(projectile.position)) {
        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica timeout intelligente basato sul tipo di proiettile
      const maxLifetime = this.calculateProjectileLifetime(projectile);
      if (now - projectile.createdAt > maxLifetime) {
        projectilesToRemove.push(projectileId);
        continue;
      }
    }

    // Rimuovi proiettili distrutti
    projectilesToRemove.forEach(item => {
      const id = typeof item === 'string' ? item : item.id;
      const projectile = this.projectiles.get(id);

      // Determina il motivo specifico della rimozione
      let reason = 'unknown';
      if (typeof item === 'object' && item.reason) {
        reason = item.reason;
      } else if (projectile) {
        if (this.isOutOfBounds(projectile.position)) {
          reason = 'out_of_bounds';
        } else if (now - projectile.createdAt > 10000) {
          reason = 'timeout';
        } else {
          reason = 'collision';
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
      // CRITICO: Escludi l'NPC che ha sparato il proiettile (evita auto-danno)
      if (projectile.playerId && projectile.playerId === npc.id) {
        continue; // Salta l'NPC che ha sparato questo proiettile
      }

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

      // Distanza di collisione aumentata per proiettili NPC (per compensare movimento player)
      // I proiettili NPC hanno homing ma possono passare vicino, quindi serve un raggio più grande
      const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');
      const collisionRadius = isNpcProjectile ? 120 : 50;
      
      if (distance < collisionRadius) {
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

    // Determina se il target è un NPC o un player basandosi sul formato dell'ID
    // NPC hanno ID come "npc_0", "npc_1", etc.
    // Player hanno clientId come UUID stringhe
    const isNpcTarget = typeof targetId === 'string' && targetId.startsWith('npc_');
    const isPlayerTarget = !isNpcTarget && typeof targetId === 'string';

    // Se è un proiettile NPC, il target dovrebbe essere sempre un player
    // Se è un proiettile player, il target potrebbe essere un NPC
    const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');

    if (isNpcTarget || (!isPlayerTarget && !isNpcProjectile)) {
      // Cerca tra gli NPC solo se il target è chiaramente un NPC
      const npcs = this.mapServer.npcManager.getAllNpcs();
      for (const npc of npcs) {
        if (npc.id === targetId) {
          // CRITICO: Escludi l'NPC che ha sparato il proiettile
          if (projectile.playerId === npc.id) {
            continue; // L'NPC non può colpire se stesso
          }

          const distance = Math.sqrt(
            Math.pow(projectile.position.x - npc.position.x, 2) +
            Math.pow(projectile.position.y - npc.position.y, 2)
          );

          if (distance < 50) {
            return { entity: npc, type: 'npc' };
          }
          break; // Trovato l'NPC target, non cercare altri
        }
      }
    }

    // Cerca tra i giocatori (sempre valido per proiettili NPC, o se target è un player)
    if (isPlayerTarget || isNpcProjectile) {
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

          // Distanza di collisione aumentata per proiettili NPC (per compensare movimento player)
          // I proiettili NPC hanno homing ma possono passare vicino, quindi serve un raggio più grande
          const collisionRadius = isNpcProjectile ? 120 : 50;
          if (distance < collisionRadius) {
            return { entity: playerData, type: 'player' };
          }
          break; // Trovato il giocatore target, non cercare altri
        }
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

    // POI: Il messaggio entity_destroyed esistente
    const message = {
      type: 'entity_destroyed',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      destroyerId,
      position: entity.position,
      rewards: entityType === 'npc' ? this.calculateRewards(entity) : undefined
    };

    // Interest radius: TUTTO IL MONDO per distruzioni NPC (minimappa globale richiede aggiornamenti globali)
    console.log(`[SERVER] Broadcasting entity_destroyed: ${entity.id} (${entityType}) at ${entity.position.x.toFixed(0)},${entity.position.y.toFixed(0)} - radius: 50000`);
    this.mapServer.broadcastNear(entity.position, 50000, message);
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
    this.mapServer.broadcastToMap(message);
  }

  /**
   * Aggiorna direzione di un proiettile homing verso il suo target
   * Usa la stessa logica per tutti i proiettili (NPC e player) per comportamento uniforme
   * @returns {boolean} true se target trovato e homing applicato, false se target scomparso
   */
  updateProjectileHoming(projectile) {
    // Trova posizione corrente del target
    const targetData = this.getTargetData(projectile.targetId);
    if (!targetData || !targetData.position) {
      // Target morto/disconnesso - segnala rimozione immediata
      return false;
    }

    const targetPosition = targetData.position;

    // Calcola distanza attuale
    const dx = targetPosition.x - projectile.position.x;
    const dy = targetPosition.y - projectile.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Usa predizione uniforme per tutti i proiettili (NPC e player)
    const targetVelocity = targetData.velocity || { x: 0, y: 0 };
    
    // PREDIZIONE: meno aggressiva per comportamenti più prevedibili
    let predictedX = targetPosition.x;
    let predictedY = targetPosition.y;

    if (distance > 10) { // Solo se siamo abbastanza lontani
      const projectileSpeed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);

      if (projectileSpeed > 50) { // Evita divisione per zero
        // Tempo stimato per raggiungere il target (con velocità più realistica)
        const timeToTarget = distance / projectileSpeed;

        // Predizione più conservativa - usa meno tempo per evitare posizioni estreme
        const maxPredictionTime = Math.min(timeToTarget * 0.3, 0.8); // max 0.8 secondi, usa solo 30% del tempo stimato

        predictedX = targetPosition.x + targetVelocity.x * maxPredictionTime;
        predictedY = targetPosition.y + targetVelocity.y * maxPredictionTime;
      }
    }

    // Calcola direzione verso la posizione predetta
    const predDx = predictedX - projectile.position.x;
    const predDy = predictedY - projectile.position.y;
    const predDistance = Math.sqrt(predDx * predDx + predDy * predDy);

    // Se siamo molto vicini al target (anche predetto), accelera per colpire
    const CLOSE_DISTANCE = 25; // pixel
    if (predDistance < CLOSE_DISTANCE && predDistance > 0) {
      // Aumenta velocità quando vicino al target per garantire il colpo
      const boostMultiplier = 1.8;
      const currentSpeed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
      const boostedSpeed = Math.min(currentSpeed * boostMultiplier, currentSpeed * 2.5); // max 2.5x velocità

      projectile.velocity.x = (predDx / predDistance) * boostedSpeed;
      projectile.velocity.y = (predDy / predDistance) * boostedSpeed;
    } else if (predDistance > 0) {
      // Normalizza direzione
      const targetDirectionX = predDx / predDistance;
      const targetDirectionY = predDy / predDistance;

      // Usa velocità corrente con limiti (stessa logica per NPC e player)
      const currentSpeed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
      const maxSpeed = 2000;
      const safeSpeed = Math.max(50, Math.min(currentSpeed, maxSpeed));
      projectile.velocity.x = targetDirectionX * safeSpeed;
      projectile.velocity.y = targetDirectionY * safeSpeed;

      // Validazione finale per NaN/Infinity
      if (!Number.isFinite(projectile.velocity.x) || !Number.isFinite(projectile.velocity.y)) {
        // Reset a velocità sicura se qualcosa va storto
        const safeDirectionX = predDx > 0 ? 1 : -1;
        const safeDirectionY = predDy > 0 ? 1 : -1;
        projectile.velocity.x = safeDirectionX * 400;
        projectile.velocity.y = safeDirectionY * 400;
      }
    }

    return true;
  }

  /**
   * Ottiene posizione corrente di un target (player o NPC)
   */
  getTargetPosition(targetId) {
    const targetData = this.getTargetData(targetId);
    return targetData ? targetData.position : null;
  }

  /**
   * Verifica se un proiettile è "orfano" (il suo target non esiste più)
   * Previene memory leaks rimuovendo proiettili che non possono mai colpire
   */
  isProjectileOrphaned(projectile) {
    if (!projectile.targetId || projectile.targetId === -1) {
      return false; // Non è un proiettile homing, quindi non orfano
    }

    const targetExists = this.getTargetData(projectile.targetId) !== null;
    return !targetExists;
  }

  /**
   * Ottiene dati completi del target (posizione e velocità per predizione)
   */
  getTargetData(targetId) {
    // Prima cerca tra i giocatori
    if (this.mapServer.players.has(targetId)) {
      const playerData = this.mapServer.players.get(targetId);
      if (!playerData.position || playerData.isDead) return null;

      // La velocità è salvata in playerData.position come velocityX/velocityY
      const velocity = {
        x: playerData.position.velocityX || 0,
        y: playerData.position.velocityY || 0
      };

      return {
        position: playerData.position,
        velocity: velocity
      };
    }

    // Poi cerca tra gli NPC
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      if (npc.id === targetId) {
        return {
          position: npc.position,
          velocity: npc.velocity || { x: 0, y: 0 }
        };
      }
    }

    return null; // Target non trovato
  }

  /**
   * Calcola la distanza iniziale dal target al momento della creazione
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
   * Calcola il tempo di vita massimo di un proiettile basato sul suo tipo
   */
  calculateProjectileLifetime(projectile) {
    if (projectile.targetId && projectile.initialDistance) {
      // Per proiettili homing: tempo basato sulla distanza + margine
      const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
      const baseTime = (projectile.initialDistance / speed) * 1000; // millisecondi
      const marginTime = Math.min(3000, baseTime * 0.5); // fino al 50% di margine, max 3 secondi

      return Math.min(baseTime + marginTime, 8000); // max 8 secondi per homing
    } else {
      // Per proiettili normali: timeout fisso
      return 10000; // 10 secondi
    }
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
   * Calcola la distanza massima consentita dal target per un proiettile
   * Oltre questa distanza, il proiettile viene rimosso per evitare memory leak
   */
  getMaxTargetDistance(projectile) {
    // Distanza massima: 2000 unità (circa 2 schermi di gioco)
    // Questo previene proiettili che volano all'infinito
    return 2000;
  }

  /**
   * Calcola la distanza attuale dal target per un proiettile
   */
  getDistanceToTarget(projectile) {
    const targetId = projectile.targetId;
    if (!targetId) return Infinity;

    // STESSO ORDINE di getTargetPosition: prima giocatori, poi NPC
    // Prima cerca tra i giocatori
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      if (clientId === targetId || playerData.playerId?.toString() === targetId?.toString()) {
        if (!playerData.position || playerData.isDead) continue;
        return Math.sqrt(
          Math.pow(projectile.position.x - playerData.position.x, 2) +
          Math.pow(projectile.position.y - playerData.position.y, 2)
        );
      }
    }

    // Poi cerca tra gli NPC
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      if (npc.id === targetId) {
        return Math.sqrt(
          Math.pow(projectile.position.x - npc.position.x, 2) +
          Math.pow(projectile.position.y - npc.position.y, 2)
        );
      }
    }

    // Target non trovato
    return Infinity;
  }

  /**
   * Trasmissione aggiornamenti posizione proiettili homing ai client
   * Invia aggiornamenti per TUTTI i proiettili NPC homing a tutti i client interessati
   */
  broadcastHomingProjectileUpdates() {
    const homingProjectiles = Array.from(this.projectiles.values())
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
