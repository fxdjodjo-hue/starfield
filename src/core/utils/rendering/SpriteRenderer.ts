import { Transform } from '../../../entities/spatial/Transform';
import { Sprite } from '../../../entities/Sprite';

/**
 * Minimal transform data needed for sprite rendering
 */
export interface RenderableTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Unified sprite rendering helper
 */
export class SpriteRenderer {
  /**
   * Render a sprite with specified transform and optional custom rotation
   */
  static render(ctx: CanvasRenderingContext2D, transform: RenderableTransform, sprite: Sprite, customRotation?: number): void {
    if (!sprite || !sprite.isLoaded() || !sprite.image) return;

    ctx.save();

    // Apply transforms
    ctx.translate(transform.x, transform.y);
    const rotation = (customRotation !== undefined ? customRotation : transform.rotation) + (sprite.rotationOffset || 0);
    ctx.rotate(rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    // Draw sprite
    const spriteX = -sprite.width / 2 + sprite.offsetX;
    const spriteY = -sprite.height / 2 + sprite.offsetY;
    ctx.drawImage(sprite.image, spriteX, spriteY, sprite.width, sprite.height);

    ctx.restore();
  }
}
