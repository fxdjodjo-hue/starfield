import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Explosion } from '../../entities/combat/Explosion';
import { Active } from '../../entities/tags/Active';

/**
 * Sistema di gestione delle esplosioni
 * Gestisce l'animazione delle esplosioni e disattiva le entità quando l'animazione finisce
 */
export class ExplosionSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    // Trova tutte le entità con componente Explosion e Active
    const explosionEntities = this.ecs.getEntitiesWithComponentsReadOnly(Active, Explosion);

    for (const entity of explosionEntities) {
      const active = this.ecs.getComponent(entity, Active);
      if (!active || !active.isEnabled) continue;

      const explosion = this.ecs.getComponent(entity, Explosion);

      if (explosion) {
        // Aggiorna l'animazione dell'esplosione
        explosion.update(deltaTime);

        // Se l'animazione è finita, disabilita l'entità per il reuse
        if (explosion.isAnimationFinished()) {
          active.isEnabled = false;
        }
      }
    }
  }
}
