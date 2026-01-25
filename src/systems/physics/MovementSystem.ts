import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { CameraSystem } from '../rendering/CameraSystem';
import { Npc } from '../../entities/ai/Npc';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';

/**
 * Sistema di movimento che aggiorna le posizioni delle entità basandosi sulla velocity
 * Collabora con CameraSystem per mantenere la camera centrata sul player
 */
export class MovementSystem extends BaseSystem {
  public static override readonly Type = 'MovementSystem';
  private cameraSystem: CameraSystem;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
  }

  update(deltaTime: number): void {
    // Prima aggiorna le posizioni delle entità
    // ESCLUDI entità con InterpolationTarget (remote player) - gestite da InterpolationSystem
    const entities = this.ecs.getEntitiesWithComponents(Transform, Velocity)
      .filter(entity => !this.ecs.hasComponent(entity, InterpolationTarget));

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

    // Comunica al CameraSystem di centrarsi sul player
    if (playerEntities.length > 0) {
      const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
      if (playerTransform) {
        this.cameraSystem.centerOn(playerTransform.x, playerTransform.y);
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

    // Aggiorna rotazione solo se velocity.angular è diverso da 0
    // (il player imposta direttamente transform.rotation, quindi non usa velocity.angular)
    if (velocity.angular !== 0) {
      transform.rotation += velocity.angular * dt;
    }
  }
}
