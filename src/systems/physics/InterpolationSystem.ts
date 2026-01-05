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
  private debugStats = {
    activePredictions: 0,
    lastDebugTime: 0
  };

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    // Trova tutti i remote player con interpolazione
    const entities = this.ecs.getEntitiesWithComponents(Transform, InterpolationTarget);

    // Debug logging periodico
    this.debugStats.activePredictions = entities.length;
    const now = Date.now();
    if (now - this.debugStats.lastDebugTime > 3000) {
      console.log(`🎯 [Interpolation] Active remote players: ${this.debugStats.activePredictions}`);
      this.debugStats.lastDebugTime = now;
    }

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);

      if (transform && interpolation) {
        // UPDATE RENDER con exponential smoothing adattivo
        interpolation.updateRender(deltaTime);

        // APPLICA POSIZIONE INTERPOLATA al Transform per rendering
        transform.x = interpolation.renderX;
        transform.y = interpolation.renderY;
        transform.rotation = interpolation.renderRotation;

        // NOTA: Componente rimane PERSISTENTE - mai rimosso
        // Interpolazione continua senza interruzioni
      }
    }
  }
}
