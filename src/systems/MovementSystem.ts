import { BaseSystem } from '../ecs/System.js';
import { ECS } from '../ecs/ECS.js';
import { Transform } from '../components/Transform.js';
import { Velocity } from '../components/Velocity.js';
import { Destination } from '../components/Destination.js';
import { Camera } from '../components/Camera.js';

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
    // Per ora, centra la camera su (0,0) - il player dovrebbe rimanere al centro
    // In futuro, seguiremo il player quando si muove
    this.camera.centerOn(0, 0);

    // Ottiene tutte le entità con Transform e Velocity
    const entities = this.ecs.getEntitiesWithComponents(Transform, Velocity);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);

      if (transform && velocity) {
        this.updatePosition(transform, velocity, deltaTime);
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
