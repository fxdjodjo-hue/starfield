import { ECS } from '../ecs/ECS';
import { CONFIG } from '../../utils/config/Config';

/**
 * World che gestisce il gioco, ECS e tutti i sistemi
 */
export class World {
  private ecs: ECS;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossibile ottenere il contesto 2D del canvas');
    }
    this.ctx = ctx;

    // Inizializza ECS
    this.ecs = new ECS();

    // Configura canvas
    this.setupCanvas();
  }

  /**
   * Configura le dimensioni e proprietà del canvas
   */
  private setupCanvas(): void {
    this.resizeCanvas();
    this.canvas.style.backgroundColor = CONFIG.BACKGROUND_COLOR;

    // Ascolta gli eventi di resize della finestra
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  /**
   * Ridimensiona il canvas per adattarsi alla finestra
   */
  private resizeCanvas(): void {
    // Usa le dimensioni della finestra del browser
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Aggiorna le dimensioni del canvas
    this.canvas.width = width;
    this.canvas.height = height;

    // Aggiorna anche il CSS per sicurezza
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
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
