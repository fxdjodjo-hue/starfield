import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Camera } from '../../entities/spatial/Camera';
import { Npc } from '../../entities/ai/Npc';

/**
 * Sistema di movimento che aggiorna le posizioni basandosi sulla velocity
 * Gestisce anche la camera per mantenere il player al centro
 */
export class MovementSystem extends BaseSystem {
  private camera: Camera;

  constructor(ecs: ECS) {
    super(ecs);
    // Crea una camera globale che segue il player
    this.camera = new Camera(0, 0, 1);
  }

  /**
   * Restituisce la camera corrente
   */
  getCamera(): Camera {
    return this.camera;
  }

  update(deltaTime: number): void {
    // Prima aggiorna le posizioni, poi centra la camera sul player
    const entities = this.ecs.getEntitiesWithComponents(Transform, Velocity);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);

      if (transform && velocity) {
        this.updatePosition(transform, velocity, deltaTime);
      }
    }

    // Trova il player (entità con Transform e Velocity ma senza Npc)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Velocity)
      .filter(entity => !this.ecs.hasComponent(entity, Npc));

    if (playerEntities.length > 0) {
      const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
      if (playerTransform) {
        this.camera.centerOn(playerTransform.x, playerTransform.y);
      }
    }
  }

  /**
   * Aggiorna la posizione dell'entità basandosi sulla velocity
   */
  private updatePosition(transform: Transform, velocity: Velocity, deltaTime: number): void {
    // Calcola il delta movimento (deltaTime è in millisecondi, converti in secondi)
    const dt = deltaTime / 1000;

    // Aggiorna posizione
    transform.translate(
      velocity.x * dt,
      velocity.y * dt
    );

    // Aggiorna rotazione
    transform.rotation += velocity.angular * dt;
  }
}
