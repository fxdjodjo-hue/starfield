import { AnimatedSprite } from '../../entities/AnimatedSprite';
import type { SpriteFrame } from '../../entities/AnimatedSprite';

/**
 * Transform data for rendering
 */
export interface SpritesheetRenderTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Renderer for spritesheet-based sprites
 * Uses pre-rendered rotation frames instead of canvas rotation
 */
export class SpritesheetRenderer {
  /**
   * Render an AnimatedSprite using rotation-based frame selection
   * No canvas rotation needed - frame is selected based on entity rotation
   */
  static render(
    ctx: CanvasRenderingContext2D,
    transform: SpritesheetRenderTransform,
    sprite: AnimatedSprite
  ): void {
    if (!sprite || !sprite.isLoaded()) return;

    // Get frame based on rotation
    const frameIndex = sprite.getFrameForRotation(transform.rotation);
    const frame = sprite.getFrame(frameIndex);

    this.renderFrame(ctx, transform, sprite, frame);
  }

  /**
   * Render a specific frame from the spritesheet
   */
  static renderFrame(
    ctx: CanvasRenderingContext2D,
    transform: SpritesheetRenderTransform,
    sprite: AnimatedSprite,
    frame: SpriteFrame
  ): void {
    if (!sprite || !sprite.isLoaded()) return;

    const { image } = sprite.spritesheet;
    const scale = sprite.scale * transform.scaleX; // Combine sprite scale with transform scale

    // Calculate destination dimensions
    const destWidth = frame.width * scale;
    const destHeight = frame.height * scale;

    // Calculate destination position (centered)
    const destX = transform.x - destWidth / 2 + sprite.offsetX;
    const destY = transform.y - destHeight / 2 + sprite.offsetY;

    // Draw from spritesheet (no rotation needed - frame is pre-rotated)
    ctx.drawImage(
      image,
      frame.x, frame.y, frame.width, frame.height,  // Source rect
      destX, destY, destWidth, destHeight            // Destination rect
    );
  }

  /**
   * Render with explicit frame index (for animation)
   */
  static renderByIndex(
    ctx: CanvasRenderingContext2D,
    transform: SpritesheetRenderTransform,
    sprite: AnimatedSprite,
    frameIndex: number
  ): void {
    if (!sprite || !sprite.isLoaded()) return;

    const frame = sprite.getFrame(frameIndex);
    this.renderFrame(ctx, transform, sprite, frame);
  }
}
