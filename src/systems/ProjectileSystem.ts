import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Transform } from '../components/Transform';
import { Projectile } from '../components/Projectile';
import { Health } from '../components/Health';

/**
 * Sistema per gestire i proiettili: movimento, collisione e rimozione
 */
export class ProjectileSystem extends BaseSystem {
  private ecs: ECS;

  constructor(ecs: ECS) {
    super();
    this.ecs = ecs;
  }

  update(deltaTime: number): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Aggiorna posizione del proiettile
      transform.x += projectile.directionX * projectile.speed * deltaTime;
      transform.y += projectile.directionY * projectile.speed * deltaTime;

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
        this.ecs.removeEntity(projectileEntity);
        return; // Un proiettile colpisce solo un bersaglio
      }
    }
  }
}
