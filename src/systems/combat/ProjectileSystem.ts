import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { DamageTaken } from '../../entities/combat/DamageTaken';
import { Npc } from '../../entities/ai/Npc';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { UiSystem } from '../ui/UiSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { CombatSystem } from './CombatSystem';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { MathUtils } from '../../core/utils/MathUtils';
import { TimeManager } from '../../core/utils/TimeManager';
import { ComponentHelper } from '../../core/data/ComponentHelper';
import { LoggerWrapper } from '../../core/data/LoggerWrapper';
import { RenderSystem } from '../rendering/RenderSystem';

/**
 * Sistema per gestire i proiettili: movimento, collisione e rimozione
 */
export class ProjectileSystem extends BaseSystem {
  private uiSystem: UiSystem | null = null;
  private playerSystem: PlayerSystem;
  private lastDeltaTimeSeconds: number = 1 / 60; // Fallback per deltaTime


  constructor(ecs: ECS, playerSystem: PlayerSystem, uiSystem?: UiSystem) {
    super(ecs);
    this.playerSystem = playerSystem;
    this.uiSystem = uiSystem || null;
  }

  update(deltaTime: number): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);
    const deltaTimeSeconds = TimeManager.millisecondsToSeconds(deltaTime);
    this.lastDeltaTimeSeconds = deltaTimeSeconds; // Salva per uso nei metodi privati

    for (const projectileEntity of projectiles) {
      if (this.processProjectile(projectileEntity, deltaTime, deltaTimeSeconds)) {
        // Proiettile rimosso durante il processamento
        continue;
      }
    }
  }

  /**
   * Processa un singolo proiettile - logica semplificata e uniforme
   * @returns true se il proiettile è stato rimosso
   */
  private processProjectile(projectileEntity: Entity, deltaTime: number, deltaTimeSeconds: number): boolean {
    const transform = ComponentHelper.getTransform(this.ecs, projectileEntity);
    const projectile = this.ecs.getComponent(projectileEntity, Projectile);

    if (!transform || !projectile) {
      // Invalid projectile components - removing silently
      this.ecs.removeEntity(projectileEntity);
      return true;
    }

    // Projectile processing - silent in production

    // 1. Controllo cleanup uniforme - rimuovi se necessario
    if (this.shouldRemoveProjectile(projectileEntity, projectile)) {
      return true;
    }

    // 2. Aggiorna homing se necessario (logica semplificata)
    if (this.isHomingProjectile(projectile)) {
      // Applying homing - silent in production
      this.updateHomingDirection(projectileEntity, transform, projectile);
    }

    // 3. Movimento - gestito da MovementSystem per tutti se hanno Velocity.
    // Qui in ProjectileSystem c'è una logica di fallback per proiettili locali
    // che potrebbe causare doppio movimento. Per ora la manteniamo per i proiettili locali
    // ma assicuriamoci che i remoti (NPC) siano gestiti correttamente.
    const isRemote = this.isRemoteProjectile(projectile);

    // Solo i proiettili locali vengono mossi manualmente qui (potrebbe essere rimosso in futuro)
    if (!isRemote) {
      transform.x += projectile.directionX * projectile.speed * deltaTimeSeconds;
      transform.y += projectile.directionY * projectile.speed * deltaTimeSeconds;
    }

    // 4. Riduci lifetime
    projectile.lifetime -= deltaTime;

    // Deterministic NPC beams are server-authoritative:
    // close them on hitTime window instead of allowing prolonged local chase.
    if (this.isDeterministicNpcBeam(projectile) && typeof projectile.hitTime === 'number') {
      if (Date.now() >= projectile.hitTime + 80) {
        this.ecs.removeEntity(projectileEntity);
        return true;
      }
    }

    // 5. Collisioni - Abilitate anche per proiettili remoti VISIVI (laser)
    const isVisualOnly = projectile.damage === 0 || projectile.projectileType === 'npc_laser';
    const collisionProbePosition = (isRemote && isVisualOnly)
      ? this.predictRemoteCollisionPosition(projectileEntity, transform, projectile, deltaTimeSeconds)
      : undefined;

    const shouldRunLocalVisualCollision = !this.isDeterministicNpcBeam(projectile);
    if ((!isRemote || isVisualOnly) && shouldRunLocalVisualCollision) {
      this.checkCollisions(projectileEntity, transform, projectile, collisionProbePosition);
    }

    // 6. Rimozione per lifetime scaduto
    if (projectile.lifetime <= 0) {
      // Projectile expired - removing
      this.ecs.removeEntity(projectileEntity);
      return true;
    }

    return false; // Proiettile ancora attivo
  }

  /**
   * Controllo uniforme per rimuovere proiettili (cleanup centralizzato)
   */
  private shouldRemoveProjectile(projectileEntity: Entity, projectile: Projectile): boolean {
    // Rimuovi se target morto (solo per homing projectiles)
    if (this.isHomingProjectile(projectile)) {
      const targetEntity = this.findTargetEntity(projectile.targetId);
      if (!targetEntity) {
        // Target not found - removing projectile
        this.ecs.removeEntity(projectileEntity);
        return true;
      }

      // Controlla se target è morto
      const targetHealth = ComponentHelper.getHealth(this.ecs, targetEntity);
      const targetShield = this.ecs.getComponent(targetEntity, Shield);
      const isDead = targetHealth && targetHealth.isDead() && (!targetShield || !targetShield.isActive());

      if (isDead) {
        // Target dead - removing projectile
        this.ecs.removeEntity(projectileEntity);
        return true;
      }
    }

    return false;
  }

  /**
   * Identifica se un proiettile è homing (semplificato)
   */
  private isHomingProjectile(projectile: Projectile): boolean {
    // Deterministic NPC beams are server-authoritative on path updates.
    // Disable local chase to avoid orbit/jitter conflicts.
    if (this.isDeterministicNpcBeam(projectile)) {
      return false;
    }
    return projectile.targetId !== -1 && projectile.targetId !== undefined && projectile.targetId !== null;
  }

  /**
   * Identifies deterministic NPC beams (server-authoritative hit timing).
   */
  private isDeterministicNpcBeam(projectile: Projectile): boolean {
    return projectile.projectileType === 'npc_laser' && projectile.isDeterministic === true;
  }

  /**
   * Identifica se un proiettile è remoto
   */
  private isRemoteProjectile(projectile: Projectile): boolean {
    return typeof projectile.playerId === 'string';
  }


  /**
   * Aggiorna direzione homing - LOGICA SEMPLIFICATA
   * Tutti i proiettili homing cercano semplicemente il loro targetId
   */
  private updateHomingDirection(entity: Entity, projectileTransform: Transform, projectile: Projectile): void {
    const targetEntity = this.findTargetEntity(projectile.targetId);
    if (!targetEntity) {
      // Homing target not found
      return;
    }

    const targetTransform = ComponentHelper.getTransform(this.ecs, targetEntity);
    if (!targetTransform) {
      // Homing target has no transform
      return;
    }

    const targetPosition = this.getVisualTargetPosition(targetEntity, targetTransform, projectile);

    // Homing target found - updating direction
    this.calculateAndSetDirection(entity, projectileTransform, targetPosition, projectile);
  }


  /**
   * Ottiene la velocità corrente del target per la prediction del movimento
   * Calcola la velocità reale basata sul movimento recente del target
   */

  /**
   * Calcola e imposta la direzione del proiettile verso il target (per laser)
   */
  private calculateAndSetDirection(
    entity: Entity,
    projectileTransform: Transform,
    targetPosition: { x: number; y: number },
    projectile: Projectile
  ): void {
    const { direction, distance } = MathUtils.calculateDirection(
      projectileTransform.x, projectileTransform.y,
      targetPosition.x, targetPosition.y
    );

    if (distance > 0) {
      // Direct guidance avoids orbiting behavior around moving targets.
      const nextDirectionX = direction.x;
      const nextDirectionY = direction.y;

      projectile.directionX = nextDirectionX;
      projectile.directionY = nextDirectionY;

      // CRITICO: Aggiorna anche il componente Velocity per il MovementSystem
      const velocity = this.ecs.getComponent(entity, Velocity);
      if (velocity) {
        velocity.x = nextDirectionX * projectile.speed;
        velocity.y = nextDirectionY * projectile.speed;
      }
    }
  }

  /**
   * Returns the target position used by visual NPC beams.
   * For local player targets, use the same smoothed render anchor to avoid
   * end-of-flight jitter when the local ship is moving.
   */
  private getVisualTargetPosition(
    targetEntity: Entity,
    targetTransform: Transform,
    projectile: Projectile
  ): { x: number; y: number } {
    if (projectile.projectileType !== 'npc_laser') {
      return { x: targetTransform.x, y: targetTransform.y };
    }

    const localPlayer = this.playerSystem.getPlayerEntity();
    if (
      localPlayer &&
      targetEntity.id === localPlayer.id &&
      RenderSystem.smoothedLocalPlayerPos &&
      RenderSystem.smoothedLocalPlayerId === localPlayer.id
    ) {
      return {
        x: RenderSystem.smoothedLocalPlayerPos.x,
        y: RenderSystem.smoothedLocalPlayerPos.y
      };
    }

    return { x: targetTransform.x, y: targetTransform.y };
  }

  /**
   * Predicts remote projectile position at end-of-tick.
   * ProjectileSystem runs before MovementSystem, so using this probe avoids
   * one-tick late visual destruction for fast visual beams.
   */
  private predictRemoteCollisionPosition(
    projectileEntity: Entity,
    projectileTransform: Transform,
    projectile: Projectile,
    deltaTimeSeconds: number
  ): { x: number; y: number } {
    const velocity = this.ecs.getComponent(projectileEntity, Velocity);
    const velocityX = velocity ? velocity.x : projectile.directionX * projectile.speed;
    const velocityY = velocity ? velocity.y : projectile.directionY * projectile.speed;

    return {
      x: projectileTransform.x + velocityX * deltaTimeSeconds,
      y: projectileTransform.y + velocityY * deltaTimeSeconds
    };
  }

  /**
   * Controlla collisioni tra proiettile e possibili bersagli
   */
  private checkCollisions(
    projectileEntity: Entity,
    projectileTransform: Transform,
    projectile: Projectile,
    collisionProbePosition?: { x: number; y: number }
  ): void {
    const startX = projectileTransform.x;
    const startY = projectileTransform.y;
    const endX = collisionProbePosition ? collisionProbePosition.x : projectileTransform.x;
    const endY = collisionProbePosition ? collisionProbePosition.y : projectileTransform.y;

    // Trova tutte le entità con Health (possibili bersagli)
    const targets = this.ecs.getEntitiesWithComponents(Transform, Health);

    for (const targetEntity of targets) {
      // Non colpire il proprietario del proiettile
      if (this.isProjectileOwner(targetEntity, projectile)) continue;

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      const targetHealth = this.ecs.getComponent(targetEntity, Health);

      if (!targetTransform || !targetHealth) continue;

      const visualTargetPosition = this.getVisualTargetPosition(targetEntity, targetTransform, projectile);

      // Calcola distanza tra proiettile e bersaglio.
      // For remote visual beams, use swept distance from segment start->end to avoid
      // pass-through/overshoot jitter on moving targets.
      const endDistance = Math.sqrt(
        Math.pow(endX - visualTargetPosition.x, 2) +
        Math.pow(endY - visualTargetPosition.y, 2)
      );
      const sweptDistance = this.distancePointToSegment(
        visualTargetPosition.x,
        visualTargetPosition.y,
        startX,
        startY,
        endX,
        endY
      );
      const distance = collisionProbePosition ? Math.min(endDistance, sweptDistance) : endDistance;

      // Se la distanza è minore di una soglia (hitbox), colpisce
      let hitDistance: number = GAME_CONSTANTS.PROJECTILE.HIT_RADIUS;

      // I proiettili visivi (laser) hanno un raggio di collisione maggiore per evitare
      // che "orbitino" attorno al target a causa della loro velocità ridotta o 
      // di scatti nel movimento.
      if (projectile.damage === 0 || projectile.projectileType === 'npc_laser') {
        hitDistance *= 1.5; // +50% raggio per visual lasers
      }

      // NPC deterministic beams are server-authoritative on damage and can visually
      // overshoot near moving targets. A wider local completion radius avoids
      // end-of-flight jitter before server destroy arrives.
      if (projectile.projectileType === 'npc_laser') {
        let npcHitDistance = 50;
        const targetVelocity = this.ecs.getComponent(targetEntity, Velocity);
        let targetSpeed = 0;
        if (targetVelocity) {
          targetSpeed = Math.sqrt(
            targetVelocity.x * targetVelocity.x + targetVelocity.y * targetVelocity.y
          );
          // Increase completion radius when target moves fast to avoid final-frame wobble.
          npcHitDistance += Math.min(45, targetSpeed * 0.12);
        }
        hitDistance = Math.max(hitDistance, npcHitDistance);

        // Anti-orbit safeguard:
        // if beam is already moving away from target but still close, complete it.
        if (collisionProbePosition) {
          const velocity = this.ecs.getComponent(projectileEntity, Velocity);
          const velocityX = velocity ? velocity.x : projectile.directionX * projectile.speed;
          const velocityY = velocity ? velocity.y : projectile.directionY * projectile.speed;
          const toTargetX = visualTargetPosition.x - endX;
          const toTargetY = visualTargetPosition.y - endY;
          const movingAway = (velocityX * toTargetX + velocityY * toTargetY) < 0;
          const escapeDistance = 140 + Math.min(60, targetSpeed * 0.1);

          if (movingAway && distance < escapeDistance) {
            this.ecs.removeEntity(projectileEntity);
            return;
          }
        }
      }

      if (distance < hitDistance) {
        // Collision detected

        // GESTIONE DIFFERENZIATA PER TARGETING

        // Per proiettili SENZA target specifico (NPC projectiles):
        // Rimuovi immediatamente - possono colpire chiunque
        if (projectile.targetId === null || projectile.targetId === undefined || projectile.targetId === -1) {
          // Remove laser projectile with no target
          this.ecs.removeEntity(projectileEntity);
          return; // Un proiettile colpisce solo un bersaglio
        }

        // Per proiettili CON target specifico (player projectiles):
        // Per laser visivi (damage = 0), rimuovi sempre quando colpiscono il target
        // Anche se il server gestisce il danno, il laser visivo deve sparire immediatamente
        const isLaserTarget = this.isLaserTarget(projectile, targetEntity);
        if (projectile.damage === 0 && isLaserTarget) {
          this.ecs.removeEntity(projectileEntity);
          return;
        }

        // Per proiettili normali CON target specifico:
        // NON rimuovere localmente se colpiscono qualcun altro che non è il target
        // Il server decide quando rimuovere questi proiettili
        // Solo il server può confermare se hanno colpito il target corretto
        if (!isLaserTarget) {
          // Colpito qualcun altro - continua il volo, lascia che il server decida
          continue; // Non rimuovere, continua a volare
        }

        // Colpito il target corretto - il server dovrebbe averlo già rimosso,
        // ma per sicurezza rimuoviamo anche localmente
        this.ecs.removeEntity(projectileEntity);
        return;
      }
    }
  }

  /**
   * Minimum distance between a point and a segment.
   */
  private distancePointToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq <= 0.000001) {
      const ddx = px - x1;
      const ddy = py - y1;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const cdx = px - closestX;
    const cdy = py - closestY;
    return Math.sqrt(cdx * cdx + cdy * cdy);
  }

  /**
   * Controlla se l'entità target è il proprietario del proiettile
   */
  private isProjectileOwner(targetEntity: any, projectile: Projectile): boolean {
    // Controllo diretto per entity ID
    if (projectile.ownerId === targetEntity.id) return true;

    // Per gli NPC, controlla se il target ha un Npc con l'ID corrispondente
    const npc = this.ecs.getComponent(targetEntity, Npc);
    if (npc && npc.serverId && projectile.playerId === npc.serverId) {
      return true;
    }

    // Per il player locale, usa il controllo esistente
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (playerEntity && targetEntity.id === playerEntity.id) {
      // Se il proiettile è del player, non colpire il player
      return projectile.ownerId === playerEntity.id || (projectile.playerId?.startsWith('client_') ?? false);
    }

    return false;
  }

  /**
   * Verifica se l'entità target corrisponde al targetId del proiettile (per laser)
   */
  private isLaserTarget(projectile: Projectile, targetEntity: any): boolean {
    const targetId = projectile.targetId;

    if (typeof targetId === 'number') {
      // Numero: entity.id diretto
      return targetId === targetEntity.id;
    }

    if (typeof targetId === 'string') {
      // NPC Check
      if (targetId.startsWith('npc_')) {
        const npc = this.ecs.getComponent(targetEntity, Npc);
        if (npc && npc.serverId === targetId) {
          return true;
        }
      }

      // Player Check (Remote o Locale)
      if (targetId.startsWith('player_')) {
        // Check Remote Player
        const remote = this.ecs.getComponent(targetEntity, RemotePlayer);
        if (remote && (remote.clientId === targetId || `player_${remote.clientId}` === targetId)) {
          return true;
        }

        // Check Local Player
        const localPlayer = this.playerSystem.getPlayerEntity();
        if (localPlayer && targetEntity.id === localPlayer.id) {
          return true;
        }
      }

      // Check for raw clientId (without prefix)
      const remote = this.ecs.getComponent(targetEntity, RemotePlayer);
      if (remote && remote.clientId === targetId) {
        return true;
      }

      // Fallback: numeric string
      const parsed = parseInt(targetId, 10);
      if (!isNaN(parsed) && parsed === targetEntity.id) {
        return true;
      }
    }

    return false;
  }


  /**
   * Trova l'entità target basata su targetId (può essere numero o stringa)
   */
  /**
   * Trova entità bersaglio per targetId - GESTISCE sia entity.id che serverId
   */
  private findTargetEntity(targetId: number | string): Entity | null {
    if (typeof targetId === 'number') {
      // Cerca per entity.id
      const allEntities = this.ecs.getEntitiesWithComponents(Transform);
      return allEntities.find(entity => entity.id === targetId) || null;
    }

    if (typeof targetId === 'string') {
      // Gestisci ID speciali (npc_X, player_X, etc.)
      if (targetId.startsWith('npc_')) {
        // Cerca NPC per serverId
        const npcEntities = this.ecs.getEntitiesWithComponents(Npc);
        for (const npcEntity of npcEntities) {
          const npc = this.ecs.getComponent(npcEntity, Npc);
          if (npc && npc.serverId === targetId) {
            return npcEntity;
          }
        }
      } else if (targetId.startsWith('player_')) {
        // Cerca tra i remote players per clientId
        const remotePlayers = this.ecs.getEntitiesWithComponents(RemotePlayer);
        for (const remoteEntity of remotePlayers) {
          const remote = this.ecs.getComponent(remoteEntity, RemotePlayer);
          if (remote && (remote.clientId === targetId || `player_${remote.clientId}` === targetId)) {
            return remoteEntity;
          }
        }

        // Fallback: è il player locale?
        const localPlayer = this.playerSystem.getPlayerEntity();
        if (localPlayer) {
          // In Starfield, se il target è "player_..." e non è un remote player, è il locale
          return localPlayer;
        }
        return null;
      } else {
        // Raw clientId (senza prefisso): cerca prima tra i remote players.
        const remotePlayers = this.ecs.getEntitiesWithComponents(RemotePlayer);
        for (const remoteEntity of remotePlayers) {
          const remote = this.ecs.getComponent(remoteEntity, RemotePlayer);
          if (remote && String(remote.clientId) === String(targetId)) {
            return remoteEntity;
          }
        }

        // Prova a convertire in numero (fallback)
        const parsed = parseInt(targetId, 10);
        if (!isNaN(parsed)) {
          // Converting string targetId to number
          const allEntities = this.ecs.getEntitiesWithComponents(Transform);
          return allEntities.find(entity => entity.id === parsed) || null;
        }
      }

      // Unknown targetId format
      return null;
    }

    // Invalid targetId type
    return null;
  }


  /**
   * Notifica il CombatSystem quando viene applicato danno
   */
  private notifyCombatSystemOfDamage(targetEntity: any, damage: number, projectile?: Projectile): void {
    // Cerca il CombatSystem nell'ECS (robusto contro minificazione)
    const systems = this.ecs.getSystems();
    const combatSystem = systems.find((system): system is CombatSystem =>
      system instanceof CombatSystem
    );

    if (combatSystem) {
      // Applica la logica di danno divisa tra shield e HP
      const targetShield = this.ecs.getComponent(targetEntity, Shield);
      const targetHealth = this.ecs.getComponent(targetEntity, Health);

      if (!targetHealth) return;

      const projectileType = projectile?.projectileType;
      let damageToHp = damage;

      // Prima applica danno allo shield se presente
      if (targetShield && targetShield.isActive()) {
        const shieldDamage = Math.min(damage, targetShield.current);
        combatSystem.createDamageText(targetEntity, shieldDamage, true, false, projectileType); // true = shield damage
        damageToHp = damage - shieldDamage;
      }

      // Poi applica danno all'HP
      if (damageToHp > 0) {
        combatSystem.createDamageText(targetEntity, damageToHp, false, false, projectileType); // false = HP damage
      }
    }
  }

  /* DEBUG: Laser creation logging removed for playtest
  private logLaserCreation(startX: number, startY: number, targetX: number, targetY: number): void {
    // console.log('[ProjectileSystem] Laser created:', { start: { x: startX, y: startY }, target: { x: targetX, y: targetY } });
  }
  */

  /**
   * Applica danno a un'entità (modifica gli HP/shield, la UI è gestita dal CombatSystem)
   */
  private applyDamage(targetEntity: any, damage: number): void {
    const targetShield = this.ecs.getComponent(targetEntity, Shield);
    const targetHealth = this.ecs.getComponent(targetEntity, Health);

    if (!targetHealth) return;

    // Verifica se il target è il player
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isPlayerDamage = playerEntity && targetEntity.id === playerEntity.id;

    /*
    let damageTaken = this.ecs.getComponent(targetEntity, DamageTaken);
    if (!damageTaken) {
      damageTaken = new DamageTaken();
      this.ecs.addComponent(targetEntity, DamageTaken, damageTaken);
      console.log(`[DAMAGE] Aggiunto componente DamageTaken all'entità ${targetEntity.id}`);
    }
    damageTaken.takeDamage(Date.now());
    console.log(`[DAMAGE] Entità ${targetEntity.id} danneggiata, tempo: ${Date.now()}`);
    */
    let damageTaken = this.ecs.getComponent(targetEntity, DamageTaken);
    if (!damageTaken) {
      damageTaken = new DamageTaken();
      this.ecs.addComponent(targetEntity, DamageTaken, damageTaken);
    }
    damageTaken.takeDamage(Date.now());

    let damageToHp = damage;

    // Prima applica danno allo shield se presente e attivo
    if (targetShield && targetShield.isActive()) {
      const shieldDamage = Math.min(damage, targetShield.current);
      targetShield.takeDamage(shieldDamage);
      damageToHp = damage - shieldDamage;
    }

    // Poi applica il danno rimanente all'HP
    if (damageToHp > 0) {
      targetHealth.takeDamage(damageToHp);
    }
  }


}
