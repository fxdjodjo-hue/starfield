import { Camera } from '../../entities/spatial/Camera';
import { IRenderer, SpriteRenderParams, ProjectileRenderParams, ExplosionRenderParams, HealthBarRenderParams, CircleRenderParams } from './IRenderer';
import { SpriteRenderer } from '../../utils/helpers/SpriteRenderer';
import { ProjectileRenderer } from '../../utils/helpers/ProjectileRenderer';
import { ExplosionRenderer } from '../../utils/helpers/ExplosionRenderer';
import { HudRenderer } from '../../utils/helpers/HudRenderer';

/**
 * Canvas 2D implementation of the renderer interface
 * Wraps the existing Canvas 2D rendering system
 */
export class Canvas2DRenderer implements IRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera!: Camera;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossibile ottenere il contesto 2D del canvas');
    }
    this.ctx = ctx;
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render a sprite using the existing SpriteRenderer
   */
  renderSprite(params: SpriteRenderParams): void {
    SpriteRenderer.render(this.ctx, params.transform, params.sprite, params.customRotation);
  }

  /**
   * Render a projectile using the existing projectile rendering logic
   */
  renderProjectile(params: ProjectileRenderParams): void {
    this.ctx.save();

    if (params.params.hasImage && params.params.imageSize && params.params.image) {
      // Render as image-based projectile
      this.ctx.drawImage(
        params.params.image,
        params.screenX - params.params.imageSize / 2,
        params.screenY - params.params.imageSize / 2,
        params.params.imageSize,
        params.params.imageSize
      );
    } else {
      // Render as laser line
      const endX = params.screenX + params.projectile.directionX * params.params.length;
      const endY = params.screenY + params.projectile.directionY * params.params.length;

      this.ctx.strokeStyle = params.params.color;
      this.ctx.lineWidth = params.params.lineWidth;
      this.ctx.lineCap = 'round';

      // Apply shadow effect if specified
      if (params.params.shadowColor && params.params.shadowBlur) {
        this.ctx.shadowColor = params.params.shadowColor;
        this.ctx.shadowBlur = params.params.shadowBlur;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(params.screenX, params.screenY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();

      // Add white center line for laser effect
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.shadowBlur = 0; // Remove shadow for center line
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Render an explosion using the existing ExplosionRenderer
   */
  renderExplosion(params: ExplosionRenderParams): void {
    if (!params.params) return;

    this.ctx.save();
    this.ctx.drawImage(params.params.image!, params.params.x, params.params.y, params.params.width, params.params.height);
    this.ctx.restore();
  }

  /**
   * Render a health bar using the existing HUD rendering logic
   */
  renderHealthBar(params: HealthBarRenderParams): void {
    // Background
    this.ctx.fillStyle = params.backgroundColor;
    this.ctx.fillRect(params.x, params.y, HudRenderer.getBarWidth(), params.height);

    // Fill
    this.ctx.fillStyle = params.fillColor;
    this.ctx.fillRect(params.x, params.y, params.width, params.height);

    // Border
    this.ctx.strokeStyle = params.borderColor;
    this.ctx.lineWidth = params.borderWidth;
    this.ctx.strokeRect(params.x, params.y, HudRenderer.getBarWidth(), params.height);
  }

  /**
   * Render a circle (selection, range indicators, etc.)
   */
  renderCircle(params: CircleRenderParams): void {
    this.ctx.save();

    if (params.globalAlpha !== undefined) {
      this.ctx.globalAlpha = params.globalAlpha;
    }

    this.ctx.strokeStyle = params.strokeStyle;
    this.ctx.lineWidth = params.lineWidth;

    if (params.setLineDash) {
      this.ctx.setLineDash(params.setLineDash);
    }

    this.ctx.beginPath();
    this.ctx.arc(params.x, params.y, params.radius, 0, Math.PI * 2);

    if (params.fillStyle) {
      this.ctx.fillStyle = params.fillStyle;
      this.ctx.fill();
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Set the camera reference for coordinate transformations
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Get canvas dimensions
   */
  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Save current rendering context state
   */
  save(): void {
    this.ctx.save();
  }

  /**
   * Restore previous rendering context state
   */
  restore(): void {
    this.ctx.restore();
  }

  /**
   * Set global alpha
   */
  setGlobalAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }

  /**
   * Set global composite operation
   */
  setGlobalCompositeOperation(operation: string): void {
    this.ctx.globalCompositeOperation = operation;
  }

  /**
   * Get the underlying canvas element (for backward compatibility)
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the underlying 2D context (for backward compatibility)
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}