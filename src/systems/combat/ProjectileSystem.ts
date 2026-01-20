import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Projectile } from '../../entities/combat/Projectile';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { DamageTaken } from '../../entities/combat/DamageTaken';
import { Npc } from '../../entities/ai/Npc';
import { UiSystem } from '../ui/UiSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { CombatSystem } from './CombatSystem';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { MathUtils } from '../../core/utils/MathUtils';
import { TimeManager } from '../../core/utils/TimeManager';
import { ComponentHelper } from '../../core/data/ComponentHelper';
import { LoggerWrapper } from '../../core/data/LoggerWrapper';

  /**
   * Sistema per gestire i proiettili: movimento, collisione e rimozione
   */
export class ProjectileSystem extends BaseSystem {
  private uiSystem: UiSystem | null = null;
  private playerSystem: PlayerSystem;
  private lastDeltaTimeSeconds: number = 1/60; // Fallback per deltaTime


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
      this.updateHomingDirection(transform, projectile);
    }

    // 3. Movimento - solo per proiettili locali, remoti usano interpolazione
    const isRemote = this.isRemoteProjectile(projectile);
    if (!isRemote) {
      const oldX = transform.x;
      const oldY = transform.y;
      transform.x += projectile.directionX * projectile.speed * deltaTimeSeconds;
      transform.y += projectile.directionY * projectile.speed * deltaTimeSeconds;

      // Projectile movement - silent in production
    } else {
      // Remote projectile - skipping movement
    }

    // 4. Riduci lifetime
    projectile.lifetime -= deltaTime;

    // 5. Collisioni - solo per proiettili locali
    if (!isRemote) {
      this.checkCollisions(projectileEntity, transform, projectile);
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
    return projectile.targetId !== -1 && projectile.targetId !== undefined && projectile.targetId !== null;
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
  private updateHomingDirection(projectileTransform: Transform, projectile: Projectile): void {
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

    // Homing target found - updating direction

    this.calculateAndSetDirection(projectileTransform, targetTransform, projectile);
  }


  /**
   * Ottiene la velocità corrente del target per la prediction del movimento
   * Calcola la velocità reale basata sul movimento recente del target
   */

  /**
   * Calcola e imposta la direzione del proiettile verso il target (per laser)
   */
  private calculateAndSetDirection(projectileTransform: Transform, targetTransform: Transform, projectile: Projectile): void {
    const { direction, distance } = MathUtils.calculateDirection(
      projectileTransform.x, projectileTransform.y,
      targetTransform.x, targetTransform.y
    );

    if (distance > 0) {
      projectile.directionX = direction.x;
      projectile.directionY = direction.y;
    }
  }

  /**
   * Controlla collisioni tra proiettile e possibili bersagli
   */
  private checkCollisions(projectileEntity: Entity, projectileTransform: Transform, projectile: Projectile): void {

    // Trova tutte le entità con Health (possibili bersagli)
    const targets = this.ecs.getEntitiesWithComponents(Transform, Health);

    for (const targetEntity of targets) {
      // Non colpire il proprietario del proiettile
      if (this.isProjectileOwner(targetEntity, projectile)) continue;

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      const targetHealth = this.ecs.getComponent(targetEntity, Health);

      if (!targetTransform || !targetHealth) continue;

      // Calcola distanza tra proiettile e bersaglio
      const distance = Math.sqrt(
        Math.pow(projectileTransform.x - targetTransform.x, 2) +
        Math.pow(projectileTransform.y - targetTransform.y, 2)
      );

      // Se la distanza è minore di una soglia (hitbox), colpisce
      const hitDistance = GAME_CONSTANTS.PROJECTILE.HIT_RADIUS;

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
    // Usa la stessa logica del metodo findTargetEntity
    if (typeof projectile.targetId === 'number') {
      // Target è un numero (entity.id)
      if (projectile.targetId === targetEntity.id) {
        return true;
      }
    } else if (typeof projectile.targetId === 'string') {
      // Target è una stringa (serverId di NPC)
      const npc = this.ecs.getComponent(targetEntity, Npc);
      if (npc && npc.serverId === projectile.targetId) {
        return true;
      }
    }

    // Target mismatch - continue checking

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
        // Potrebbe servire per giocatori remoti in futuro
        // Player targetId not implemented
        return null;
      } else {
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

    // Registra che l'entità è stata danneggiata (per comportamenti AI reattivi)
    let damageTaken = this.ecs.getComponent(targetEntity, DamageTaken);
    if (!damageTaken) {
      damageTaken = new DamageTaken();
      this.ecs.addComponent(targetEntity, DamageTaken, damageTaken);
      console.log(`[DAMAGE] Aggiunto componente DamageTaken all'entità ${targetEntity.id}`);
    }
    damageTaken.takeDamage(Date.now());
    console.log(`[DAMAGE] Entità ${targetEntity.id} danneggiata, tempo: ${Date.now()}`);

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
