import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Explosion } from '/src/entities/combat/Explosion';

/**
 * Sistema di gestione delle esplosioni
 * Gestisce l'animazione delle esplosioni e rimuove le entità quando l'animazione finisce
 */
export class ExplosionSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    // Trova tutte le entità con componente Explosion
    const explosionEntities = this.ecs.getEntitiesWithComponents(Explosion);

    for (const entity of explosionEntities) {
      const explosion = this.ecs.getComponent(entity, Explosion);

      if (explosion) {
        // Aggiorna l'animazione dell'esplosione
        explosion.update(deltaTime);

        // Se l'animazione è finita, rimuovi l'entità
        if (explosion.isAnimationFinished()) {
          this.ecs.removeEntity(entity);
        }
      }
    }
  }
}
