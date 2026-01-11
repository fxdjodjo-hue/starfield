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
    // Debug: monitora deltaTime per identificare scatti
    if (deltaTime > 50) { // DeltaTime > 50ms indica frame drop
      console.warn(`[INTERPOLATION_DEBUG] Frame drop detected! deltaTime: ${deltaTime}ms`);
    }

    // Trova tutti i remote player con interpolazione
    const entities = this.ecs.getEntitiesWithComponents(Transform, InterpolationTarget);

    this.debugStats.activePredictions = entities.length;


    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);

      if (transform && interpolation) {
        // UPDATE RENDER con smoothing ottimizzato per ridurre scatti
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
