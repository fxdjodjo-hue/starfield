import { ECS } from './ECS';

/**
 * Classe base astratta per tutti i sistemi ECS
 */
export abstract class System {
  protected ecs: ECS;

  constructor(ecs: ECS) {
    this.ecs = ecs;
  }

  /**
   * Aggiorna il sistema con il delta time
   */
  abstract update(deltaTime: number): void;

  /**
   * Render del sistema (opzionale, usato dal RenderSystem)
   */
  render?(ctx: CanvasRenderingContext2D): void;

  /**
   * Cleanup delle risorse del sistema (opzionale)
   * Chiamato quando il sistema viene rimosso dall'ECS
   */
  destroy?(): void;
}
