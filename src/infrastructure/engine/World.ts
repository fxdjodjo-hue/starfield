import { ECS } from '../ecs/ECS';
import { CONFIG } from '../../core/utils/config/Config';
import { DisplayManager } from '../display';

/**
 * World che gestisce il gioco, ECS e tutti i sistemi
 */
export class World {
  private ecs: ECS;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayManager: DisplayManager;
  private unsubscribeResize: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.displayManager = DisplayManager.getInstance();

    // Configura canvas con supporto HiDPI
    this.ctx = this.displayManager.setupCanvas(canvas, {
      fullscreen: true,
      backgroundColor: CONFIG.BACKGROUND_COLOR,
    });

    // Inizializza ECS
    this.ecs = new ECS();

    // Registra per eventi di resize
    this.unsubscribeResize = this.displayManager.onResize(() => {
      this.handleResize();
    });
  }

  /**
   * Gestisce il resize della finestra
   * Riscala il canvas mantenendo il supporto HiDPI
   */
  private handleResize(): void {
    this.displayManager.rescaleCanvas(this.canvas, this.ctx);
  }

  /**
   * Update del mondo (chiamato dal game loop)
   */
  update(deltaTime: number): void {
    this.ecs.update(deltaTime);
  }

  /**
   * Render del mondo (chiamato dal game loop)
   */
  render(): void {
    // Clear canvas usando dimensioni logiche (il context è già scalato per DPR)
    const { width, height } = this.displayManager.getLogicalSize();
    this.ctx.clearRect(0, 0, width, height);

    // Render attraverso ECS
    this.ecs.render(this.ctx);
  }

  /**
   * Restituisce l'istanza ECS per gestire entità e sistemi
   */
  getECS(): ECS {
    return this.ecs;
  }

  /**
   * Restituisce il canvas per input handling
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Restituisce le dimensioni logiche del canvas (CSS pixels)
   * Usa queste dimensioni per calcoli di gioco, rendering, coordinate camera
   */
  getCanvasSize(): { width: number; height: number } {
    return this.displayManager.getLogicalSize();
  }

  /**
   * Cleanup risorse
   */
  destroy(): void {
    if (this.unsubscribeResize) {
      this.unsubscribeResize();
      this.unsubscribeResize = null;
    }
  }
}
