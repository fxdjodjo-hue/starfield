import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { CameraSystem } from '../rendering/CameraSystem';
import { Npc } from '../../entities/ai/Npc';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';

/**
 * Sistema di movimento che aggiorna le posizioni delle entitÃ  basandosi sulla velocity
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
    // Single pass over moving entities to avoid per-frame filtered array allocations.
    const entities = this.ecs.getEntitiesWithComponentsReadOnly(Transform, Velocity);
    let localPlayerTransform: Transform | null = null;

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);
      if (!transform || !velocity) {
        continue;
      }

      const hasInterpolationTarget = this.ecs.hasComponent(entity, InterpolationTarget);

      // ESCLUDI entità con InterpolationTarget (remote player) - gestite da InterpolationSystem
      if (!hasInterpolationTarget) {
        this.updatePosition(transform, velocity, deltaTime);
      }

      // Trova il player locale (Transform + Velocity, SENZA Npc e SENZA InterpolationTarget)
      if (!localPlayerTransform && !hasInterpolationTarget && !this.ecs.hasComponent(entity, Npc)) {
        localPlayerTransform = transform;
      }
    }

    // Comunica al CameraSystem di centrarsi sul player locale
    if (localPlayerTransform) {
      this.cameraSystem.centerOn(localPlayerTransform.x, localPlayerTransform.y);
    }
  }

  /**
   * Aggiorna la posizione dell'entitÃ  basandosi sulla velocity
   */
  private updatePosition(transform: Transform, velocity: Velocity, deltaTime: number): void {
    // Calcola il delta movimento (deltaTime Ã¨ in millisecondi, converti in secondi)
    const dt = deltaTime / 1000;

    // Aggiorna posizione
    transform.translate(
      velocity.x * dt,
      velocity.y * dt
    );

    // Aggiorna rotazione solo se velocity.angular Ã¨ diverso da 0
    // (il player imposta direttamente transform.rotation, quindi non usa velocity.angular)
    if (velocity.angular !== 0) {
      transform.rotation += velocity.angular * dt;
    }
  }
}
