import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
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
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { calculateDirection, msToSeconds } from '../../utils/MathUtils';

/**
 * Sistema per gestire i proiettili: movimento, collisione e rimozione
 */
export class ProjectileSystem extends BaseSystem {
  private uiSystem: UiSystem | null = null;
  private playerSystem: PlayerSystem;

  constructor(ecs: ECS, playerSystem: PlayerSystem, uiSystem?: UiSystem) {
    super(ecs);
    this.playerSystem = playerSystem;
    this.uiSystem = uiSystem || null;
  }

  update(deltaTime: number): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);

    // Converti deltaTime da millisecondi a secondi usando utility
    const deltaTimeSeconds = msToSeconds(deltaTime);

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Controlla se il bersaglio è ancora vivo (ha HP o shield attivo)
      // Salta questo controllo per proiettili remoti (targetId = -1)
      if (projectile.targetId !== -1) {
        const allTargets = this.ecs.getEntitiesWithComponents(Health);
        const targetExists = allTargets.some(entity => entity.id === projectile.targetId);

        if (targetExists) {
          const targetEntity = allTargets.find(entity => entity.id === projectile.targetId);
          if (targetEntity) {
            const targetHealth = this.ecs.getComponent(targetEntity, Health);
            const targetShield = this.ecs.getComponent(targetEntity, Shield);

            // Un'entità è morta se l'HP è a 0 e non ha più shield attivo
            const isDead = targetHealth && targetHealth.isDead() && (!targetShield || !targetShield.isActive());

            if (isDead) {
              this.ecs.removeEntity(projectileEntity);
              continue;
            }
          }
        } else {
          // Il bersaglio non esiste più (rimosso dal gioco)
          this.ecs.removeEntity(projectileEntity);
          continue;
        }
      }

      // Per i proiettili homing (NPC verso player, o player verso NPC), aggiorna direzione verso il bersaglio
      if (this.shouldBeHoming(projectileEntity)) {
        this.updateHomingDirection(transform, projectile);
      }

      // Aggiorna posizione del proiettile
      transform.x += projectile.directionX * projectile.speed * deltaTimeSeconds;
      transform.y += projectile.directionY * projectile.speed * deltaTimeSeconds;

      // Riduci il tempo di vita
      projectile.lifetime -= deltaTime;

      // Controlla collisioni con bersagli
      this.checkCollisions(projectileEntity, transform, projectile);

      // Rimuovi proiettili scaduti
      if (projectile.lifetime <= 0) {
        this.ecs.removeEntity(projectileEntity);
      }
    }
  }

  /**
   * Verifica se un proiettile dovrebbe essere homing (seguire il bersaglio)
   */
  private shouldBeHoming(projectileEntity: any): boolean {
    const projectile = this.ecs.getComponent(projectileEntity, Projectile);
    if (!projectile) return false;

    // Un proiettile è homing se ha un targetId valido (diverso da -1)
    return projectile.targetId !== -1;
  }

  /**
   * Aggiorna la direzione di un proiettile homing verso il bersaglio corrente
   */
  private updateHomingDirection(projectileTransform: Transform, projectile: Projectile): void {
    // Trova il bersaglio tra tutte le entità con Health
    // STESSO ORDINE del server: prima giocatori, poi NPC
    const allTargets = this.ecs.getEntitiesWithComponents(Health);

    // Prima cerca tra i giocatori locali (se siamo il target)
    const localPlayer = this.playerSystem.getPlayerEntity();
    if (localPlayer && localPlayer.id === projectile.targetId) {
      const targetTransform = this.ecs.getComponent(localPlayer, Transform);
      if (targetTransform) {
        this.calculateAndSetDirection(projectileTransform, targetTransform, projectile);
        return;
      }
    }

    // Poi cerca tra gli NPC
    const targetEntity = allTargets.find(entity => entity.id === projectile.targetId);
    if (!targetEntity) return;

    const targetTransform = this.ecs.getComponent(targetEntity, Transform);
    if (!targetTransform) return;

    this.calculateAndSetDirection(projectileTransform, targetTransform, projectile);
  }

  /**
   * Calcola e imposta la direzione del proiettile verso il target
   */
  private calculateAndSetDirection(projectileTransform: Transform, targetTransform: Transform, projectile: Projectile): void {
    const dx = targetTransform.x - projectileTransform.x;
    const dy = targetTransform.y - projectileTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalizza direzione
      const directionX = dx / distance;
      const directionY = dy / distance;

      projectile.directionX = directionX;
      projectile.directionY = directionY;
    }
  }

  /**
   * Controlla collisioni tra proiettile e possibili bersagli
   */
  private checkCollisions(projectileEntity: any, projectileTransform: Transform, projectile: Projectile): void {
    // Per proiettili homing, verifica se il target esiste ancora
    if (this.isHomingProjectile(projectile)) {
      const targetExists = this.targetStillExists(projectile.targetId);
      if (!targetExists) {
        // Target scomparso - rimuovi proiettile
        this.ecs.removeEntity(projectileEntity);
        return;
      }
    }

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
        // GESTIONE DIFFERENZIATA PER TARGETING

        // Per proiettili SENZA target specifico (NPC projectiles):
        // Rimuovi immediatamente - possono colpire chiunque
        if (!projectile.targetId || projectile.targetId === -1) {
          this.ecs.removeEntity(projectileEntity);
          return; // Un proiettile colpisce solo un bersaglio
        }

        // Per proiettili CON target specifico (player projectiles):
        // NON rimuovere localmente se colpiscono qualcun altro che non è il target
        // Il server decide quando rimuovere questi proiettili
        // Solo il server può confermare se hanno colpito il target corretto
        if (projectile.targetId !== targetEntity.id) {
          // Colpito qualcun altro - continua il volo, lascia che il server decida
          console.log(`🎯 [CLIENT] Projectile ${projectileEntity.id} hit ${targetEntity.id} but target is ${projectile.targetId} - continuing flight`);
          continue; // Non rimuovere, continua a volare
        }

        // Colpito il target corretto - il server dovrebbe averlo già rimosso,
        // ma per sicurezza rimuoviamo anche localmente
        console.log(`🎯 [CLIENT] Projectile ${projectileEntity.id} hit intended target ${projectile.targetId} - removing locally`);
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
    if (npc && projectile.ownerId === npc.serverId) {
      return true;
    }

    // Per il player locale, usa il controllo esistente
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (playerEntity && targetEntity.id === playerEntity.id) {
      // Se il proiettile è del player, non colpire il player
      return projectile.ownerId === playerEntity.id || projectile.ownerId?.startsWith?.('client_');
    }

    return false;
  }

  /**
   * Verifica se un proiettile è di tipo homing
   */
  private isHomingProjectile(projectile: Projectile): boolean {
    return projectile.targetId !== -1 && projectile.targetId !== undefined;
  }

  /**
   * Verifica se il target di un proiettile homing esiste ancora
   */
  private targetStillExists(targetId: string): boolean {
    // Prima cerca tra i giocatori locali
    const localPlayer = this.playerSystem.getPlayerEntity();
    if (localPlayer && localPlayer.id === targetId) {
      return true;
    }

    // Poi cerca tra tutte le entità con Health (NPC)
    const allTargets = this.ecs.getEntitiesWithComponents(Health);
    return allTargets.some(entity => entity.id === targetId);
  }

  /**
   * Notifica il CombatSystem quando viene applicato danno
   */
  private notifyCombatSystemOfDamage(targetEntity: any, damage: number): void {
    // Cerca il CombatSystem nell'ECS (robusto contro minificazione)
    const systems = (this.ecs as any).systems || [];
    const combatSystem = systems.find((system: any) =>
      typeof system.createDamageText === 'function'
    );

    if (combatSystem) {
      // Applica la logica di danno divisa tra shield e HP
      const targetShield = this.ecs.getComponent(targetEntity, Shield);
      const targetHealth = this.ecs.getComponent(targetEntity, Health);

      if (!targetHealth) return;

      let damageToHp = damage;

      // Prima applica danno allo shield se presente
      if (targetShield && targetShield.isActive()) {
        const shieldDamage = Math.min(damage, targetShield.current);
        combatSystem.createDamageText(targetEntity, shieldDamage, true); // true = shield damage
        damageToHp = damage - shieldDamage;
      }

      // Poi applica danno all'HP
      if (damageToHp > 0) {
        combatSystem.createDamageText(targetEntity, damageToHp, false); // false = HP damage
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
