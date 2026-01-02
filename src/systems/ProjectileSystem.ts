import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Transform } from '../components/Transform';
import { Projectile } from '../components/Projectile';
import { Health } from '../components/Health';
import { Damage } from '../components/Damage';
import { SelectedNpc } from '../components/SelectedNpc';

/**
 * Sistema per gestire i proiettili: movimento, collisione e rimozione
 */
export class ProjectileSystem extends BaseSystem {
  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    console.log(`🔫 ProjectileSystem: update called with deltaTime: ${deltaTime}`);
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);
    console.log(`🔫 ProjectileSystem: updating ${projectiles.length} projectiles`);

    // Converti deltaTime da millisecondi a secondi
    const deltaTimeSeconds = deltaTime / 1000;

    if (projectiles.length > 0) {
      console.log(`🔫 Projectile entities: ${projectiles.map(p => p.id).join(', ')}`);
      projectiles.forEach(p => {
        const transform = this.ecs.getComponent(p, Transform);
        const projectile = this.ecs.getComponent(p, Projectile);
        if (transform && projectile) {
          console.log(`🔫 Projectile ${p.id}: pos(${transform.x.toFixed(0)}, ${transform.y.toFixed(0)}), lifetime: ${projectile.lifetime}`);
        }
      });
    }

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Controlla se il bersaglio è ancora vivo
      const allTargets = this.ecs.getEntitiesWithComponents(Health);
      const targetExists = allTargets.some(entity => entity.id === projectile.targetId);

      if (targetExists) {
        const targetEntity = allTargets.find(entity => entity.id === projectile.targetId);
        if (targetEntity) {
          const targetHealth = this.ecs.getComponent(targetEntity, Health);
          if (targetHealth && targetHealth.isDead()) {
            console.log(`Target ${projectile.targetId} is dead, removing projectile ${projectileEntity.id}`);
            this.ecs.removeEntity(projectileEntity);
            continue;
          }
        }
      } else {
        // Il bersaglio non esiste più (rimosso dal gioco)
        console.log(`Target ${projectile.targetId} no longer exists, removing projectile ${projectileEntity.id}`);
        this.ecs.removeEntity(projectileEntity);
        continue;
      }

      // Per i proiettili homing (NPC verso player), aggiorna direzione verso il bersaglio
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
        console.log('Projectile expired, removing');
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

    // Trova il player (entità con Transform, Health, Damage ma senza SelectedNpc)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage)
      .filter(entity => !this.ecs.hasComponent(entity, SelectedNpc));

    if (playerEntities.length === 0) return false;

    const playerEntity = playerEntities[0];

    // I proiettili homing sono quelli sparati DA NPC (ownerId diverso dal player)
    return projectile.ownerId !== playerEntity.id;
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
        // Applica danno
        targetHealth.current -= projectile.damage;

        console.log(`Projectile hit target! Damage: ${projectile.damage}, Health remaining: ${targetHealth.current}/${targetHealth.max}`);

        // Controlla se il bersaglio è morto
        if (targetHealth.isDead()) {
          console.log('Target killed by projectile!');
        }

        // Rimuovi il proiettile dopo l'impatto
        console.log('Projectile hit target, removing');
        this.ecs.removeEntity(projectileEntity);
        return; // Un proiettile colpisce solo un bersaglio
      }
    }
  }
}
