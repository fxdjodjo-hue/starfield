import { ECS } from './ECS';

/**
 * Classe base astratta per tutti i sistemi ECS
 */
export abstract class System {
  protected ecs: ECS;

  /**
   * Identificatore unico del sistema (sovrascritto nelle sottoclassi)
   * Usato per identificare i sistemi in modo robusto anche dopo la minificazione del codice.
   */
  public static readonly Type: string = 'BaseSystem';

  constructor(ecs: ECS) {
    this.ecs = ecs;
  }

  /**
   * Restituisce il nome del sistema usando la proprietà statica Type
   */
  public getName(): string {
    return (this.constructor as any).Type || this.constructor.name;
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
