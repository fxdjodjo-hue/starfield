import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Transform } from '/src/entities/spatial/Transform';
import { Health } from '/src/entities/combat/Health';
import { CONFIG } from '/src/utils/config/Config';

/**
 * Sistema Bounds - Gestisce i limiti della mappa
 * Renderizza linee di confine rosse e applica danno ai giocatori fuori bounds
 */
export class BoundsSystem extends BaseSystem {
  // Margine di sicurezza dai bordi assoluti
  private readonly BOUNDS_MARGIN = 100;

  // Dimensioni effettive dei bounds (leggermente più piccoli del mondo)
  private readonly BOUNDS_LEFT = -CONFIG.WORLD_WIDTH / 2 + this.BOUNDS_MARGIN;
  private readonly BOUNDS_RIGHT = CONFIG.WORLD_WIDTH / 2 - this.BOUNDS_MARGIN;
  private readonly BOUNDS_TOP = -CONFIG.WORLD_HEIGHT / 2 + this.BOUNDS_MARGIN;
  private readonly BOUNDS_BOTTOM = CONFIG.WORLD_HEIGHT / 2 - this.BOUNDS_MARGIN;

  // Timer per il danno periodico
  private lastDamageTime = 0;
  private readonly DAMAGE_INTERVAL = 1000; // 1 secondo
  private readonly DAMAGE_AMOUNT = 10;

  // Riferimento al player
  private playerEntity: any = null;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta il riferimento al player
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    const currentTime = Date.now();
    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const health = this.ecs.getComponent(this.playerEntity, Health);

    if (!transform || !health) return;

    // Controlla se il player è fuori dai bounds
    const isOutOfBounds = this.isOutOfBounds(transform.x, transform.y);

    if (isOutOfBounds) {
      // Applica danno periodico se è passato abbastanza tempo
      if (currentTime - this.lastDamageTime >= this.DAMAGE_INTERVAL) {
        health.takeDamage(this.DAMAGE_AMOUNT);
        this.lastDamageTime = currentTime;

        console.log(`⚠️ Player fuori bounds! Danno: -${this.DAMAGE_AMOUNT} HP`);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Renderizza le linee di confine rosse
    this.renderBounds(ctx);
  }

  /**
   * Verifica se una posizione è fuori dai bounds
   */
  private isOutOfBounds(x: number, y: number): boolean {
    return x < this.BOUNDS_LEFT ||
           x > this.BOUNDS_RIGHT ||
           y < this.BOUNDS_TOP ||
           y > this.BOUNDS_BOTTOM;
  }

  /**
   * Renderizza le linee di confine rosse
   */
  private renderBounds(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Stile della linea di confine
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]); // Linea tratteggiata
    ctx.globalAlpha = 0.8;

    // Calcola le coordinate schermo per i bounds
    const camera = this.findCamera();
    if (!camera) return;

    const canvasSize = this.getCanvasSize();

    // Converti coordinate mondo in coordinate schermo
    const topLeft = camera.worldToScreen(this.BOUNDS_LEFT, this.BOUNDS_TOP, canvasSize.width, canvasSize.height);
    const topRight = camera.worldToScreen(this.BOUNDS_RIGHT, this.BOUNDS_TOP, canvasSize.width, canvasSize.height);
    const bottomRight = camera.worldToScreen(this.BOUNDS_RIGHT, this.BOUNDS_BOTTOM, canvasSize.width, canvasSize.height);
    const bottomLeft = camera.worldToScreen(this.BOUNDS_LEFT, this.BOUNDS_BOTTOM, canvasSize.width, canvasSize.height);

    // Disegna il rettangolo di confine
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Trova il sistema camera per le conversioni coordinate
   */
  private findCamera(): any {
    const ecs = this.ecs;
    if (ecs && (ecs as any).systems) {
      return (ecs as any).systems.find((system: any) => system.getCamera);
    }
    return null;
  }

  /**
   * Ottiene le dimensioni del canvas
   */
  private getCanvasSize(): { width: number, height: number } {
    const ecs = this.ecs;
    if (ecs && (ecs as any).context && (ecs as any).context.canvas) {
      const canvas = (ecs as any).context.canvas;
      return { width: canvas.width, height: canvas.height };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }
}
