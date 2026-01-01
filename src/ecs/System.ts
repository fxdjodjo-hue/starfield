import { ECS } from './ECS';

/**
 * Classe base astratta per tutti i sistemi ECS
 */
export abstract class System {
  /**
   * Aggiorna il sistema con il delta time
   */
  abstract update(deltaTime: number): void;

  /**
   * Render del sistema (opzionale, usato dal RenderSystem)
   */
  render?(ctx: CanvasRenderingContext2D): void;
}

/**
 * Sistema base con riferimento all'ECS
 */
export abstract class BaseSystem extends System {
  protected ecs: ECS;

  constructor(ecs: ECS) {
    super();
    this.ecs = ecs;
  }
}
