import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';

/**
 * Sistema di interpolazione per movimenti fluidi dei remote player
 * Gestisce l'interpolazione graduale delle posizioni per eliminare lo scatto
 * causato dagli aggiornamenti di rete sporadici
 */
export class InterpolationSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    // Trova tutte le entità con componenti di interpolazione
    const entities = this.ecs.getEntitiesWithComponents(Transform, InterpolationTarget);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);

      if (transform && interpolation) {
        const progress = interpolation.getProgress();

        // Interpolazione lineare per posizione e rotazione
        transform.x = this.lerp(interpolation.startX, interpolation.targetX, progress);
        transform.y = this.lerp(interpolation.startY, interpolation.targetY, progress);
        transform.rotation = this.lerp(interpolation.startRotation, interpolation.targetRotation, progress);

        // Rimuovi il componente quando l'interpolazione è completata
        if (interpolation.isComplete()) {
          this.ecs.removeComponent(entity, InterpolationTarget);
        }
      }
    }
  }

  /**
   * Interpolazione lineare tra due valori
   */
  private lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }
}
