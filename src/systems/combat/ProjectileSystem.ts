import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Transform } from '/src/entities/spatial/Transform';
import { Projectile } from '/src/entities/combat/Projectile';
import { Health } from '/src/entities/combat/Health';
import { Shield } from '/src/entities/combat/Shield';
import { Damage } from '/src/entities/combat/Damage';
import { SelectedNpc } from '/src/entities/combat/SelectedNpc';
import { DamageTaken } from '/src/entities/combat/DamageTaken';
import { DamageText } from '/src/entities/combat/DamageText';
import { MovementSystem } from '/src/systems/physics/MovementSystem';

/**
 * Sistema per gestire i proiettili: movimento, collisione e rimozione
 */
export class ProjectileSystem extends BaseSystem {
  private movementSystem: MovementSystem;
  private activeDamageTexts: Map<number, number> = new Map(); // entityId -> count

  constructor(ecs: ECS, movementSystem: MovementSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
  }

  update(deltaTime: number): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);

    // Converti deltaTime da millisecondi a secondi
    const deltaTimeSeconds = deltaTime / 1000;

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Controlla se il bersaglio è ancora vivo (ha HP o shield attivo)
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

    // Trova il player
    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) return false;

    // I proiettili homing sono:
    // 1. Quelli sparati DA NPC verso il player
    // 2. Quelli sparati DAL player verso NPC selezionati
    const isNpcProjectile = projectile.ownerId !== playerEntity.id;
    const isPlayerProjectileToNpc = projectile.ownerId === playerEntity.id && projectile.targetId !== playerEntity.id;

    return isNpcProjectile || isPlayerProjectileToNpc;
  }

  /**
   * Aggiorna la direzione di un proiettile homing verso il bersaglio corrente
   */
  private updateHomingDirection(projectileTransform: Transform, projectile: Projectile): void {
    // Trova il bersaglio tra tutte le entità con Health
    const allTargets = this.ecs.getEntitiesWithComponents(Health);
    const targetEntity = allTargets.find(entity => entity.id === projectile.targetId);

    if (!targetEntity) return;

    const targetTransform = this.ecs.getComponent(targetEntity, Transform);
    if (!targetTransform) return;

    // Calcola la nuova direzione verso il bersaglio
    const dx = targetTransform.x - projectileTransform.x;
    const dy = targetTransform.y - projectileTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalizza la direzione
      projectile.directionX = dx / distance;
      projectile.directionY = dy / distance;
    }
  }

  /**
   * Controlla collisioni tra proiettile e possibili bersagli
   */
  private checkCollisions(projectileEntity: any, projectileTransform: Transform, projectile: Projectile): void {
    // Trova tutte le entità con Health (possibili bersagli)
    const targets = this.ecs.getEntitiesWithComponents(Transform, Health);

    for (const targetEntity of targets) {
      // Non colpire il proprietario del proiettile
      if (targetEntity.id === projectile.ownerId) continue;

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      const targetHealth = this.ecs.getComponent(targetEntity, Health);

      if (!targetTransform || !targetHealth) continue;

      // Calcola distanza tra proiettile e bersaglio
      const distance = Math.sqrt(
        Math.pow(projectileTransform.x - targetTransform.x, 2) +
        Math.pow(projectileTransform.y - targetTransform.y, 2)
      );

      // Se la distanza è minore di una soglia (hitbox), colpisce
      const hitDistance = 15; // Raggio di collisione
      if (distance < hitDistance) {
        // Applica danno (prima shield, poi HP)
        const damageDealt = projectile.damage;
        this.applyDamage(targetEntity, damageDealt);


        // Rimuovi il proiettile dopo l'impatto
        this.ecs.removeEntity(projectileEntity);
        return; // Un proiettile colpisce solo un bersaglio
      }
    }
  }

  /**
   * Applica danno a un'entità (prima shield, poi HP)
   */
  private applyDamage(targetEntity: any, damage: number): void {
    const targetShield = this.ecs.getComponent(targetEntity, Shield);
    const targetHealth = this.ecs.getComponent(targetEntity, Health);

    if (!targetHealth) return;

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

      // Crea testo di danno per lo shield (colore blu)
      this.createShieldDamageText(shieldDamage, targetEntity);
    }

    // Poi applica il danno rimanente all'HP
    if (damageToHp > 0) {
      targetHealth.takeDamage(damageToHp);

      // Crea testo di danno per l'HP (colore rosso/bianco)
      const playerEntity = this.ecs.getPlayerEntity();
      const isPlayerDamage = playerEntity && targetEntity.id === playerEntity.id;
      const textColor = isPlayerDamage ? '#ff4444' : '#ffffff';

      // Se abbiamo applicato danno shield, sposta i danni HP più in basso (shield appare sopra)
      const hadShieldDamage = targetShield && targetShield.current < targetShield.max && damage > targetShield.current;
      const hpOffsetY = hadShieldDamage ? -15 : -30; // HP più in basso se dopo shield damage (shield a -30, HP a -15)

      // Aggiungi leggera variazione casuale per evitare sovrapposizione completa
      const randomOffsetX = (Math.random() - 0.5) * 20; // ±10px
      this.createDamageText(damageToHp, targetEntity.id, randomOffsetX, hpOffsetY, textColor);
    }
  }

  /**
   * Crea testo di danno per lo shield
   */
  private createShieldDamageText(value: number, targetEntity: any): void {
    // Trova l'entità player per determinare se il danno è al player
    const playerEntity = this.ecs.getPlayerEntity();
    const isPlayerDamage = playerEntity && targetEntity.id === playerEntity.id;
    const textColor = '#4444ff'; // Blu per danno shield

    // Aggiungi variazione casuale X anche per lo shield (diversa da HP per evitare allineamento)
    const randomOffsetX = (Math.random() - 0.5) * 25; // ±12.5px (leggermente diversa da HP)

    // Crea testo di danno per lo shield (parte da -30, appare sopra l'HP quando presente)
    this.createDamageText(value, targetEntity.id, randomOffsetX, -30, textColor);
  }

  /**
   * Crea un testo di danno
   */
  private createDamageText(value: number, targetEntityId: number, offsetX: number, offsetY: number, color: string): void {
    // Validazione input
    if (value <= 0 || !Number.isFinite(value)) return; // Non creare testi per danni <= 0 o invalidi
    if (targetEntityId < 0) return; // ID entità non valido
    if (!color || typeof color !== 'string') color = '#ffffff'; // Colore di default

    // Controlla quanti testi sono già attivi per questa entità (usando cache per performance)
    const activeCount = this.activeDamageTexts.get(targetEntityId) || 0;

    // Se ci sono già troppi testi (max 3), non crearne altri per evitare sovrapposizioni
    if (activeCount >= 3) {
      return; // Salta la creazione per mantenere pulizia visiva
    }

    try {
      const damageTextEntity = this.ecs.createEntity();
      const damageText = new DamageText(value, targetEntityId, offsetX, offsetY, color);
      this.ecs.addComponent(damageTextEntity, DamageText, damageText);

      // Aggiorna il contatore nella cache
      this.activeDamageTexts.set(targetEntityId, activeCount + 1);
    } catch (error) {
      console.warn('[DamageText] Failed to create damage text:', error);
    }
  }

  /**
   * Decrementa il contatore di testi attivi per un'entità (chiamato dal DamageTextSystem)
   */
  decrementDamageTextCount(targetEntityId: number): void {
    const currentCount = this.activeDamageTexts.get(targetEntityId) || 0;
    if (currentCount > 0) {
      this.activeDamageTexts.set(targetEntityId, currentCount - 1);
    } else {
      this.activeDamageTexts.delete(targetEntityId);
    }
  }
}
