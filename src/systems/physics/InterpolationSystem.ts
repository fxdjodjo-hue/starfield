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

    this.debugStats.activePredictions = entities.length;

    // Log numero di entità interpolate ogni 30 secondi
    const now = Date.now();
    if (!this.debugStats.lastDebugTime || now - this.debugStats.lastDebugTime > 30000) {
      console.log(`[INTERPOLATION] Active interpolations: ${entities.length}`);
      this.debugStats.lastDebugTime = now;
    }

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);

      if (transform && interpolation) {
        // UPDATE RENDER con exponential smoothing adattivo
        interpolation.updateRender(deltaTime);

        // Log valori sospetti ogni 30 secondi per debug
        if (Math.floor(Date.now() / 30000) % 2 === 0 && Date.now() - this.lastValueLog > 30000) {
          if (!Number.isFinite(interpolation.renderX) || !Number.isFinite(interpolation.renderY)) {
            console.error(`[INTERPOLATION] Invalid render values for entity ${entity.id}: (${interpolation.renderX}, ${interpolation.renderY})`);
          }
          this.lastValueLog = Date.now();
        }

        // APPLICA POSIZIONE INTERPOLATA al Transform per rendering
        transform.x = interpolation.renderX;
        transform.y = interpolation.renderY;
        transform.rotation = interpolation.renderRotation;

        // NOTA: Componente rimane PERSISTENTE - mai rimosso
        // Interpolazione continua senza interruzioni
      }
    }
  }

  private lastValueLog = 0;
}
