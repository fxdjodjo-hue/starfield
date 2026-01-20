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
  private static readonly BASE_FLAME_OFFSET = 50;
  private static readonly HORIZONTAL_OFFSET_BONUS = 25;
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
    const frameIndex = Math.floor((animationTime / this.ANIMATION_FRAME_DURATION) % this.TOTAL_FRAMES);
    console.log(`[DEBUG_FLAMES_FRAME] Animation time: ${animationTime.toFixed(2)}, calculated frame: ${frameIndex}/${this.TOTAL_FRAMES} (duration: ${this.ANIMATION_FRAME_DURATION}ms)`);
    return frameIndex;
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
    console.log(`[DEBUG_FLAMES_PARAMS] getRenderParams called with:`, {
      transform: transform ? 'VALID' : 'NULL',
      opacity,
      screenX: screenX.toFixed(1),
      screenY: screenY.toFixed(1),
      animationTime: animationTime.toFixed(2)
    });

    if (opacity <= 0) {
      console.log(`[DEBUG_FLAMES_PARAMS] ❌ Opacity <= 0, returning null`);
      return null;
    }

    if (!transform) {
      console.log(`[DEBUG_FLAMES_PARAMS] ❌ Transform is null, returning null`);
      return null;
    }

    const shipRotation = transform.rotation;
    const flamePosition = this.calculateFlamePosition(shipRotation, screenX, screenY);
    const flameRotation = shipRotation + Math.PI; // Opposite to ship direction
    const flameSpriteRotation = flameRotation - Math.PI / 2; // Rotate from vertical to horizontal
    const frameIndex = this.calculateFrameIndex(animationTime);
    const zoom = camera?.zoom || 1;
    const scale = this.FLAME_SCALE * zoom;

    console.log(`[DEBUG_FLAMES_PARAMS] ✅ Returning valid params - Ship at (${screenX.toFixed(1)}, ${screenY.toFixed(1)}), flames at (${flamePosition.x.toFixed(1)}, ${flamePosition.y.toFixed(1)}), rotation: ${shipRotation.toFixed(2)}, opacity: ${opacity}, scale: ${scale.toFixed(2)}, frameIndex: ${frameIndex}`);

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
    console.log(`[DEBUG_FLAMES_RENDER] Starting render - sprite loaded: ${sprite?.isLoaded()}, frameIndex: ${params.frameIndex}`);

    if (!sprite) {
      console.log(`[DEBUG_FLAMES_RENDER] ❌ Sprite is null`);
      return;
    }

    if (!sprite.isLoaded()) {
      console.log(`[DEBUG_FLAMES_RENDER] ❌ Sprite not loaded`);
      return;
    }

    const frame = sprite.getFrame(params.frameIndex);
    console.log(`[DEBUG_FLAMES_RENDER] Frame retrieved:`, frame ? {
      name: frame.name,
      x: frame.x, y: frame.y,
      width: frame.width, height: frame.height
    } : 'NULL FRAME');

    if (!frame) {
      console.log(`[DEBUG_FLAMES_RENDER] ❌ Frame is null/undefined - checking frames array`);
      console.log(`[DEBUG_FLAMES_RENDER] Sprite frames count: ${sprite.spritesheet.frames?.length || 0}`);
      console.log(`[DEBUG_FLAMES_RENDER] Frame index requested: ${params.frameIndex}`);
      return;
    }

    const destWidth = frame.width * params.scale;
    const destHeight = frame.height * params.scale;

    console.log(`[DEBUG_FLAMES_RENDER] Rendering at (${params.screenX.toFixed(1)}, ${params.screenY.toFixed(1)}) with size ${destWidth.toFixed(1)}x${destHeight.toFixed(1)}, opacity: ${params.opacity}`);

    try {
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

      console.log(`[DEBUG_FLAMES_RENDER] ✅ Flames rendered successfully`);
    } catch (error) {
      console.log(`[DEBUG_FLAMES_RENDER] ❌ Error during rendering:`, error);
    }
  }
}
