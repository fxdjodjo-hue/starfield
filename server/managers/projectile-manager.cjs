// ServerProjectileManager - Orchestratore gestione proiettili e fisica server-side
// Responsabilità: Coordinamento moduli specializzati per proiettili
// Dipendenze: logger.cjs, config/constants.cjs, moduli projectile/

const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');
const { SERVER_CONSTANTS } = require('../config/constants.cjs');
const ProjectileSpawner = require('./projectile/ProjectileSpawner.cjs');
const ProjectilePhysics = require('./projectile/ProjectilePhysics.cjs');
const ProjectileCollision = require('./projectile/ProjectileCollision.cjs');
const ProjectileHoming = require('./projectile/ProjectileHoming.cjs');
const ProjectileBroadcaster = require('./projectile/ProjectileBroadcaster.cjs');
const ProjectileDamageHandler = require('./projectile/ProjectileDamageHandler.cjs');

class ServerProjectileManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.projectiles = new Map(); // projectileId -> projectile data
    this.collisionChecks = new Map(); // clientId -> last collision check time

    // Inizializza moduli specializzati
    this.spawner = new ProjectileSpawner(mapServer);
    this.physics = new ProjectilePhysics(mapServer);
    this.collision = new ProjectileCollision(mapServer);
    this.homing = new ProjectileHoming(mapServer);
    this.broadcaster = new ProjectileBroadcaster(mapServer);
    this.damageHandler = new ProjectileDamageHandler(mapServer);
  }

  /**
   * Calcola il danno del proiettile basato sul suo tipo
   * Server è completamente autorevole per il calcolo del danno
   */
  calculateProjectileDamage(projectile) {
    // Usa il danno base inviato dal client
    const baseDamage = projectile.damage || 0;

    if (baseDamage <= 0) return 0;

    // 🎲 RNG DAMAGE: Applica una variabilità del ±10%
    // Esempio: 700 danno -> range [630, 770]
    const variation = 0.10; // 10% di variazione
    const randomFactor = 1 - variation + (Math.random() * variation * 2);

    // Ritorna intero per pulizia
    return Math.floor(baseDamage * randomFactor);
  }

  /**
   * Registra un nuovo proiettile sparato da un giocatore
   */
  addProjectile(projectileId, playerId, position, velocity, damage, projectileType = 'laser', targetId = null, excludeSender = true) {
    const projectile = this.spawner.createProjectileData(
      projectileId, playerId, position, velocity, damage, projectileType, targetId
    );

    this.projectiles.set(projectileId, projectile);

    // Broadcast ai client - escludi il mittente solo se richiesto
    const excludeClientId = excludeSender ? playerId : null;
    const actualDamage = this.calculateProjectileDamage(projectile);
    this.broadcaster.broadcastProjectileFired(projectile, excludeClientId, actualDamage);
  }

  /**
   * Aggiorna posizione di un proiettile
   */
  updateProjectile(projectileId, position) {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    this.physics.updateProjectile(projectile, position);
  }

  /**
   * Rimuove un proiettile (distrutto o fuori schermo)
   */
  removeProjectile(projectileId, reason = 'unknown') {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    this.projectiles.delete(projectileId);

    // Broadcast distruzione a tutti i client
    this.broadcaster.broadcastProjectileDestroyed(projectileId, reason, projectile);
  }

  /**
   * Verifica collisioni tra proiettili e NPC/giocatori
   */
  checkCollisions() {
    const now = Date.now();
    const projectilesToRemove = [];

    for (const [projectileId, projectile] of this.projectiles.entries()) {
      // FIX: Proiettili del giocatore senza target valido vengono rimossi immediatamente
      const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');
      if (!isNpcProjectile && (!projectile.targetId || projectile.targetId === -1)) {
        projectilesToRemove.push({
          id: projectileId,
          reason: 'no_target_player_projectile'
        });
        continue;
      }

      // MEMORY LEAK FIX: Controlla se il proiettile è "orfano" (senza target valido)
      if (this.homing.isProjectileOrphaned(projectile)) {
        projectilesToRemove.push({
          id: projectileId,
          reason: 'orphaned_target'
        });
        continue;
      }

      // HOMING LOGIC: Solo per proiettili NON deterministici
      // I proiettili deterministici fanno homing visivo ma non vengono distrutti per target mancante
      if (projectile.targetId && projectile.targetId !== -1 && !projectile.isDeterministic) {
        const homingResult = this.homing.updateProjectileHoming(projectile);
        if (!homingResult) {
          // Target non trovato - rimuovi proiettile immediatamente per prevenire memory leak
          projectilesToRemove.push({
            id: projectileId,
            reason: 'target_not_found'
          });
          continue;
        }
      }

      // Salva posizione precedente per verifica collisione continua
      const previousPosition = {
        x: projectile.position.x,
        y: projectile.position.y
      };

      // Simula movimento del proiettile (aggiorna posizione)
      const deltaTime = (now - projectile.lastUpdate) / 1000; // secondi
      this.physics.simulateMovement(projectile, deltaTime);

      // GESTIONE PROIETTILI DETERMINISTICI (MMO Style) - HIT SOLO BASATO SU TEMPO
      if (projectile.isDeterministic && projectile.hitTime) {
        if (now >= projectile.hitTime) {
          // HIT DETERMINISTICO: Applica danno automaticamente (NON basato su posizione)
          const targetPlayer = Array.from(this.mapServer.players.values())
            .find(player => player.clientId === projectile.targetId);

          if (targetPlayer) {
            // FIX VISIVO: Teleporta il proiettile alla posizione del target prima della distruzione
            projectile.position.x = targetPlayer.position.x;
            projectile.position.y = targetPlayer.position.y;

            // Applica danno al player target
            const actualDamage = this.calculateProjectileDamage(projectile);
            const playerDead = this.damageHandler.handlePlayerDamage(targetPlayer.clientId, actualDamage, projectile.playerId);
            this.broadcaster.broadcastEntityDamaged(targetPlayer, projectile, 'player', actualDamage);

            if (playerDead) {
              ServerLoggerWrapper.combat(`Player ${targetPlayer.clientId} killed by ${projectile.playerId} (deterministic hit)`);
              this.damageHandler.handlePlayerDeath(targetPlayer.clientId, projectile.playerId);
              this.broadcaster.broadcastEntityDestroyed(targetPlayer, projectile.playerId, 'player');
            }
          }

          // Rimuovi IL PROIETTILE SUBITO (non aspettare altre condizioni)
          this.projectiles.delete(projectileId);
          this.broadcaster.broadcastProjectileDestroyedAtPosition(projectileId, 'deterministic_hit', projectile.position);
          continue;
        }

        // Proiettile deterministico ancora in volo - SALTA tutte le altre logiche (homing, collisioni, timeout)
        // NON deve essere distrutto per distanza, collisioni o timeout
        continue;
      }

      // Verifica collisioni con il TARGET SPECIFICO (per proiettili NON deterministici)
      else if (projectile.targetId && projectile.targetId !== -1) {
        const targetHit = this.collision.checkSpecificTargetCollision(projectile);
        if (targetHit) {
          // CRITICO: Ferma immediatamente il movimento del proiettile per evitare "rimbalzi"
          projectile.velocity.x = 0;
          projectile.velocity.y = 0;

          // Salva posizione per il broadcast prima di rimuovere
          const collisionPosition = { ...projectile.position };

          if (targetHit.type === 'npc') {
            // Applica danno all'NPC target
            const actualDamage = this.calculateProjectileDamage(projectile);
            const npcDead = this.damageHandler.handleNpcDamage(targetHit.entity.id, actualDamage, projectile.playerId);
            this.broadcaster.broadcastEntityDamaged(targetHit.entity, projectile, 'npc', actualDamage);

            if (npcDead) {
              const rewards = this.damageHandler.calculateRewards(targetHit.entity);
              this.broadcaster.broadcastEntityDestroyed(targetHit.entity, projectile.playerId, 'npc', rewards);
            }

          } else if (targetHit.type === 'player') {
            // Applica danno al giocatore target
            const actualDamage = this.calculateProjectileDamage(projectile);
            const playerDead = this.damageHandler.handlePlayerDamage(targetHit.entity.clientId, actualDamage, projectile.playerId);
            this.broadcaster.broadcastEntityDamaged(targetHit.entity, projectile, 'player', actualDamage);

            if (playerDead) {
              ServerLoggerWrapper.combat(`Player ${targetHit.entity.clientId} killed by ${projectile.playerId}`);
              this.damageHandler.handlePlayerDeath(targetHit.entity.clientId, projectile.playerId);
              this.broadcaster.broadcastEntityDestroyed(targetHit.entity, projectile.playerId, 'player');
            }
          }

          // Rimuovi immediatamente dal map per evitare ulteriori aggiornamenti
          this.projectiles.delete(projectileId);

          // Broadcast immediato della distruzione DOPO la rimozione (usa posizione salvata)
          this.broadcaster.broadcastProjectileDestroyedAtPosition(projectileId, 'target_hit', collisionPosition);
          continue;
        } else {
          // MEMORY LEAK PREVENTION: Controlli multipli per rimuovere proiettili homing problematici

          // 1. Se è troppo lontano dal target originale, rimuovilo
          // DISABILITATO per proiettili NPC: il player può muoversi velocemente aumentando la distanza
          if (!isNpcProjectile) {
            const maxDistance = this.homing.getMaxTargetDistance(projectile);
            if (maxDistance > 0) {
              const currentDistance = this.homing.getDistanceToTarget(projectile);
              if (currentDistance > maxDistance) {
                projectilesToRemove.push({
                  id: projectileId,
                  reason: 'target_too_far'
                });
                continue;
              }
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

      // Per proiettili NPC: verifica SEMPRE collisioni con player (garantisce rimozione in tutti i casi)
      if (isNpcProjectile) {
        const hitPlayer = this.collision.checkPlayerCollision(projectile);
        if (hitPlayer) {
          console.log(`[PROJECTILE] 💥 GENERIC HIT! NPC projectile ${projectileId} hit player ${hitPlayer.clientId} (was homing: ${projectile.targetId ? 'YES' : 'NO'})`);

          // CRITICO: Ferma immediatamente il movimento del proiettile per evitare "rimbalzi"
          projectile.velocity.x = 0;
          projectile.velocity.y = 0;

          // Salva posizione per il broadcast prima di rimuovere
          const collisionPosition = { ...projectile.position };

          const actualDamage = this.calculateProjectileDamage(projectile);
          const playerDead = this.damageHandler.handlePlayerDamage(hitPlayer.clientId, actualDamage, projectile.playerId);
          this.broadcaster.broadcastEntityDamaged(hitPlayer.playerData, projectile, 'player', actualDamage);

          if (playerDead) {
            ServerLoggerWrapper.combat(`Player ${hitPlayer.clientId} killed by ${projectile.playerId}`);
            this.damageHandler.handlePlayerDeath(hitPlayer.clientId, projectile.playerId);
            this.broadcaster.broadcastEntityDestroyed(hitPlayer.playerData, projectile.playerId, 'player');
          }

          // Rimuovi immediatamente dal map per evitare ulteriori aggiornamenti
          this.projectiles.delete(projectileId);

          // Broadcast immediato della distruzione DOPO la rimozione (usa posizione salvata)
          this.broadcaster.broadcastProjectileDestroyedAtPosition(projectileId, 'target_hit', collisionPosition);
          console.log(`[PROJECTILE] ✅ NPC projectile ${projectileId} removed successfully`);

          // CRITICO: Per proiettili homing, annulla anche il targetId per evitare che continuino a cercare
          projectile.targetId = null;

          continue;
        }
      }

      // Proiettili senza target specifico continuano la verifica collisioni

      // DISABILITATO: Rimossi fallback collisioni generiche per proiettili player
      // I proiettili del giocatore dovrebbero avere sempre un target specifico
      // Se non hanno target, vengono rimossi per timeout invece di colpire chiunque

      // Verifica collisioni con giocatori (solo per proiettili NON NPC, perché gli NPC sono già gestiti sopra)
      if (!isNpcProjectile) {
        const hitPlayer = this.collision.checkPlayerCollision(projectile);
        if (hitPlayer) {
          // CRITICO: Ferma immediatamente il movimento del proiettile per evitare "rimbalzi"
          projectile.velocity.x = 0;
          projectile.velocity.y = 0;

          // Salva posizione per il broadcast prima di rimuovere
          const collisionPosition = { ...projectile.position };

          const actualDamage = this.calculateProjectileDamage(projectile);
          const playerDead = this.damageHandler.handlePlayerDamage(hitPlayer.clientId, actualDamage, projectile.playerId);
          this.broadcaster.broadcastEntityDamaged(hitPlayer.playerData, projectile, 'player', actualDamage);

          if (playerDead) {
            ServerLoggerWrapper.combat(`Player ${hitPlayer.clientId} killed by ${projectile.playerId}`);
            this.damageHandler.handlePlayerDeath(hitPlayer.clientId, projectile.playerId);
            this.broadcaster.broadcastEntityDestroyed(hitPlayer.playerData, projectile.playerId, 'player');
          }

          // Rimuovi immediatamente dal map per evitare ulteriori aggiornamenti
          this.projectiles.delete(projectileId);

          // Broadcast immediato della distruzione DOPO la rimozione (usa posizione salvata)
          this.broadcaster.broadcastProjectileDestroyedAtPosition(projectileId, 'collision', collisionPosition);
          continue;
        }
      }

      // Verifica se proiettile è fuori dai confini del mondo
      if (this.physics.isOutOfBounds(projectile.position)) {
        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica timeout intelligente basato sul tipo di proiettile
      // I proiettili deterministici NON hanno timeout - vivono fino al hitTime
      if (!projectile.isDeterministic) {
        const maxLifetime = this.physics.calculateProjectileLifetime(projectile);
        if (now - projectile.createdAt > maxLifetime) {
          projectilesToRemove.push(projectileId);
          continue;
        }
      }
    }

    // Rimuovi proiettili distrutti (solo quelli non già rimossi immediatamente)
    projectilesToRemove.forEach(item => {
      const id = typeof item === 'string' ? item : item.id;
      const projectile = this.projectiles.get(id);

      // Se il proiettile è già stato rimosso (rimozione immediata per collisioni), salta
      if (!projectile) return;

      // Determina il motivo specifico della rimozione
      let reason = 'unknown';
      if (typeof item === 'object' && item.reason) {
        reason = item.reason;
      } else if (projectile) {
        if (this.physics.isOutOfBounds(projectile.position)) {
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
   * Trasmissione aggiornamenti posizione proiettili homing ai client
   */
  broadcastHomingProjectileUpdates() {
    this.broadcaster.broadcastHomingProjectileUpdates(this.projectiles);
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
