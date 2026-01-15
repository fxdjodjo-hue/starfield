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
    if (!sprite) {
      return;
    }
    
    // Robust check: verify sprite has valid data structure
    if (!sprite.spritesheet || !sprite.spritesheet.image) {
      return;
    }
    
    // Check if image is loaded - if not, try to render anyway if image exists
    // This handles edge cases where image.complete might be false but image is actually ready
    const img = sprite.spritesheet.image;
    const isImageReady = sprite.isLoaded() || 
                        (img.naturalWidth > 0 && img.naturalHeight > 0);
    
    if (!isImageReady) {
      return;
    }
    
    // Verify we have valid frames
    if (!sprite.hasValidFrames()) {
      return;
    }

    // Get frame based on rotation
    const frameIndex = sprite.getFrameForRotation(transform.rotation);
    const frame = sprite.getFrame(frameIndex);
    
    // Validate frame before rendering
    if (!frame || frame.width <= 0 || frame.height <= 0) {
      return;
    }

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
    if (!sprite || !sprite.spritesheet || !sprite.spritesheet.image) {
      return;
    }
    
    const { image } = sprite.spritesheet;
    
    // Robust check: verify image is ready (more lenient than isLoaded)
    const isImageReady = image.naturalWidth > 0 && image.naturalHeight > 0;
    if (!isImageReady) {
      return;
    }
    
    // Validate frame bounds
    if (!frame || frame.width <= 0 || frame.height <= 0) {
      return;
    }
    
    // Validate frame coordinates are within image bounds
    if (frame.x < 0 || frame.y < 0 || 
        frame.x + frame.width > image.naturalWidth || 
        frame.y + frame.height > image.naturalHeight) {
      return;
    }

    const scale = sprite.scale * transform.scaleX; // Combine sprite scale with transform scale

    // Calculate destination dimensions
    const destWidth = frame.width * scale;
    const destHeight = frame.height * scale;
    
    // Skip rendering if dimensions are invalid
    if (destWidth <= 0 || destHeight <= 0) {
      return;
    }

    // Calculate destination position (centered)
    const destX = transform.x - destWidth / 2 + sprite.offsetX;
    const destY = transform.y - destHeight / 2 + sprite.offsetY;

    // Draw from spritesheet (no rotation needed - frame is pre-rotated)
    // Wrap in try-catch to handle any edge cases gracefully
    try {
      ctx.drawImage(
        image,
        frame.x, frame.y, frame.width, frame.height,  // Source rect
        destX, destY, destWidth, destHeight            // Destination rect
      );
    } catch (error) {
      // Silently fail - image might not be ready yet, will retry next frame
    }
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
