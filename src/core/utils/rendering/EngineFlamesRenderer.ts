import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Camera } from '../../../entities/spatial/Camera';

/**
 * Rendering parameters for engine flames
 */
export interface EngineFlamesRenderParams {
  screenX: number;
  screenY: number;
  rotation: number;
  frameIndex: number;
  opacity: number;
  scale: number;
}

/**
 * Helper for engine flames rendering logic
 */
export class EngineFlamesRenderer {
  private static readonly BASE_FLAME_OFFSET = 60;
  private static readonly HORIZONTAL_OFFSET_BONUS = 20;
  private static readonly FLAME_SCALE = 0.5;
  private static readonly ANIMATION_FRAME_DURATION = 100; // ms per frame
  private static readonly TOTAL_FRAMES = 32;

  /**
   * Calculate dynamic flame offset based on ship orientation
   * More offset when ship is horizontal (left/right) to avoid being covered
   */
  static calculateFlameOffset(shipRotation: number): number {
    const horizontalFactor = Math.abs(Math.cos(shipRotation));
    return this.BASE_FLAME_OFFSET + (horizontalFactor * this.HORIZONTAL_OFFSET_BONUS);
  }

  /**
   * Calculate flame position behind the ship
   */
  static calculateFlamePosition(
    shipRotation: number,
    screenX: number,
    screenY: number
  ): { x: number; y: number } {
    const flameRotation = shipRotation + Math.PI; // Opposite to ship direction
    const flameOffset = this.calculateFlameOffset(shipRotation);
    
    return {
      x: screenX + Math.cos(flameRotation) * flameOffset,
      y: screenY + Math.sin(flameRotation) * flameOffset
    };
  }

  /**
   * Calculate frame index for animation
   */
  static calculateFrameIndex(animationTime: number): number {
    return Math.floor((animationTime / this.ANIMATION_FRAME_DURATION) % this.TOTAL_FRAMES);
  }

  /**
   * Get rendering parameters for engine flames
   */
  static getRenderParams(
    transform: Transform,
    screenX: number,
    screenY: number,
    animationTime: number,
    opacity: number,
    camera?: Camera
  ): EngineFlamesRenderParams | null {
    if (opacity <= 0) return null;

    const shipRotation = transform.rotation;
    const flamePosition = this.calculateFlamePosition(shipRotation, screenX, screenY);
    const flameRotation = shipRotation + Math.PI;
    const flameSpriteRotation = flameRotation - Math.PI / 2; // Rotate from vertical to horizontal
    const frameIndex = this.calculateFrameIndex(animationTime);
    const zoom = camera?.zoom || 1;
    const scale = this.FLAME_SCALE * zoom;

    return {
      screenX: flamePosition.x,
      screenY: flamePosition.y,
      rotation: flameSpriteRotation,
      frameIndex,
      opacity,
      scale
    };
  }

  /**
   * Render engine flames
   */
  static render(
    ctx: CanvasRenderingContext2D,
    sprite: AnimatedSprite,
    params: EngineFlamesRenderParams
  ): void {
    if (!sprite || !sprite.isLoaded()) return;

    const frame = sprite.getFrame(params.frameIndex);
    if (!frame) return;

    const destWidth = frame.width * params.scale;
    const destHeight = frame.height * params.scale;

    ctx.save();
    ctx.globalAlpha = params.opacity;
    ctx.translate(params.screenX, params.screenY);
    ctx.rotate(params.rotation);
    ctx.drawImage(
      sprite.spritesheet.image,
      frame.x, frame.y, frame.width, frame.height,
      -destWidth / 2, -destHeight / 2, destWidth, destHeight
    );
    ctx.restore();
  }
}
