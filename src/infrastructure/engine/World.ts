import { ECS } from '../ecs/ECS';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { DisplayManager } from '../display';

/**
 * World che gestisce il gioco, ECS e tutti i sistemi
 */
export class World {
  private ecs: ECS;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private displayManager: DisplayManager;
  private unsubscribeResize: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, enableLegacyRendering: boolean = true) {
    this.canvas = canvas;
    this.displayManager = DisplayManager.getInstance();

    if (enableLegacyRendering) {
      // Configura canvas con supporto HiDPI (legacy 2D)
      this.ctx = this.displayManager.setupCanvas(canvas, {
        fullscreen: true,
      });
    } else {
      // PixiJS gestisce il canvas
      this.ctx = null;
    }

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
    if (this.ctx) {
      this.displayManager.rescaleCanvas(this.canvas, this.ctx);
    }
    // If ctx is null, PixiRenderer handles resizing
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
    // CRITICAL FIX: Allow rendering even if legacy 2D context is null (PixiJS mode)
    // if (!this.ctx) return; 

    // Clear canvas only if ctx exists
    if (this.ctx) {
      const { width, height } = this.displayManager.getLogicalSize();
      this.ctx.clearRect(0, 0, width, height);
    }

    // Render attraverso ECS (passando ctx o null)
    // PixiRenderSystem will work; legacy systems needing ctx will throw (caught by ECS)
    this.ecs.render(this.ctx as any);
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
