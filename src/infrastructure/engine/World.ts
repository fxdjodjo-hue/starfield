import { ECS } from '../ecs/ECS';
import { CONFIG } from '../../utils/config/Config';
import { IRenderer } from '../rendering/IRenderer';
import { Canvas2DRenderer } from '../rendering/Canvas2DRenderer';

/**
 * World che gestisce il gioco, ECS e tutti i sistemi
 */
export class World {
  private ecs: ECS;
  private renderer: IRenderer;

  constructor(canvas: HTMLCanvasElement, renderer?: IRenderer) {
    // Usa il renderer fornito o crea un Canvas2DRenderer come default
    this.renderer = renderer || new Canvas2DRenderer(canvas);

    // Inizializza ECS
    this.ecs = new ECS();

    // Configura canvas se stiamo usando Canvas2DRenderer
    if (this.renderer instanceof Canvas2DRenderer) {
      this.setupCanvas(canvas);
    }
  }

  /**
   * Configura le dimensioni e proprietà del canvas (solo per Canvas2DRenderer)
   */
  private setupCanvas(canvas: HTMLCanvasElement): void {
    this.resizeCanvas(canvas);
    canvas.style.backgroundColor = CONFIG.BACKGROUND_COLOR;

    // Ascolta gli eventi di resize della finestra
    window.addEventListener('resize', () => {
      this.resizeCanvas(canvas);
    });
  }

  /**
   * Ridimensiona il canvas per adattarsi alla finestra (solo per Canvas2DRenderer)
   */
  private resizeCanvas(canvas: HTMLCanvasElement): void {
    // Usa le dimensioni della finestra del browser
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Aggiorna le dimensioni del canvas
    canvas.width = width;
    canvas.height = height;

    // Aggiorna anche il CSS per sicurezza
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
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
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
   * Restituisce le dimensioni correnti del canvas
   */
  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }
}
