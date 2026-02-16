import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { Transform } from '../../../entities/spatial/Transform';
import { Camera } from '../../../entities/spatial/Camera';
import { PLAYTEST_CONFIG } from '../../../config/GameConstants';
import { getPlayerShipSkinById, type ShipSkinEngineFlameConfig } from '../../../config/ShipSkinConfig';

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

interface EngineFlameVisualConfig {
  backwardOffset: number;
  lateralOffset: number;
  scale: number;
}

/**
 * Helper for engine flames rendering logic
 */
export class EngineFlamesRenderer {
  private static readonly FLAME_SCALE_BASE = 0.5;
  private static readonly DEFAULT_BASE_OFFSET_RATIO = 0.34;
  private static readonly DEFAULT_HORIZONTAL_OFFSET_BONUS_RATIO = 0;
  private static readonly DEFAULT_REFERENCE_FRAME_SIZE = 189;
  private static readonly ANIMATION_FRAME_DURATION = 100; // ms per frame
  private static readonly TOTAL_FRAMES = 32;

  private static resolveSkinFlameConfig(shipSprite?: AnimatedSprite): ShipSkinEngineFlameConfig | null {
    const shipSkinId = (shipSprite as AnimatedSprite & { shipSkinId?: string } | undefined)?.shipSkinId;
    if (!shipSkinId) return null;
    return getPlayerShipSkinById(shipSkinId).engineFlame || null;
  }

  private static getShipFrameReferenceSize(shipSprite?: AnimatedSprite): number {
    const frameWidth = shipSprite?.spritesheet?.frameWidth || 0;
    const frameHeight = shipSprite?.spritesheet?.frameHeight || 0;
    const measured = Math.max(frameWidth, frameHeight);
    return measured > 0 ? measured : this.DEFAULT_REFERENCE_FRAME_SIZE;
  }

  private static getShipScreenScale(
    transform: Transform,
    camera?: Camera,
    shipSprite?: AnimatedSprite
  ): number {
    const zoom = camera?.zoom || 1;
    const transformScaleX = Math.abs(transform.scaleX || 1);
    const transformScaleY = Math.abs(transform.scaleY || 1);
    const transformScale = Math.max(transformScaleX, transformScaleY, 1);
    const spriteScale = Math.abs(shipSprite?.scale || 1);
    return zoom * transformScale * spriteScale;
  }

  private static getVisualConfig(
    transform: Transform,
    camera?: Camera,
    shipSprite?: AnimatedSprite
  ): EngineFlameVisualConfig {
    const skinFlame = this.resolveSkinFlameConfig(shipSprite);
    const referenceFrameSize = this.getShipFrameReferenceSize(shipSprite);
    const shipScreenScale = this.getShipScreenScale(transform, camera, shipSprite);
    const adaptiveBackwardOffset = referenceFrameSize * this.DEFAULT_BASE_OFFSET_RATIO;

    // Keep a skin-specific override only when it increases the separation.
    // This avoids large skins covering flames with too-short fixed offsets.
    const baseBackwardOffset = Math.max(adaptiveBackwardOffset, skinFlame?.backwardOffset ?? 0);
    const extraBackwardOffset =
      skinFlame?.horizontalOffsetBonus ?? (referenceFrameSize * this.DEFAULT_HORIZONTAL_OFFSET_BONUS_RATIO);
    const lateralOffset = skinFlame?.lateralOffset ?? 0;
    const flameScaleMultiplier = skinFlame?.flameScale ?? 1;

    return {
      backwardOffset: (baseBackwardOffset + extraBackwardOffset) * shipScreenScale,
      lateralOffset: lateralOffset * shipScreenScale,
      scale: this.FLAME_SCALE_BASE * shipScreenScale * flameScaleMultiplier
    };
  }

  /**
   * Calculate flame position behind the ship
   */
  static calculateFlamePosition(
    shipRotation: number,
    screenX: number,
    screenY: number,
    config: EngineFlameVisualConfig
  ): { x: number; y: number } {
    const flameRotation = shipRotation + Math.PI; // Opposite to ship direction
    const lateralRotation = flameRotation + Math.PI / 2;

    return {
      x: screenX + Math.cos(flameRotation) * config.backwardOffset + Math.cos(lateralRotation) * config.lateralOffset,
      y: screenY + Math.sin(flameRotation) * config.backwardOffset + Math.sin(lateralRotation) * config.lateralOffset
    };
  }

  /**
   * Calculate frame index for animation
   */
  static calculateFrameIndex(animationTime: number): number {
    const frameIndex = Math.floor((animationTime / this.ANIMATION_FRAME_DURATION) % this.TOTAL_FRAMES);
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_FRAME] Animation time: ${animationTime.toFixed(2)}, calculated frame: ${frameIndex}/${this.TOTAL_FRAMES} (duration: ${this.ANIMATION_FRAME_DURATION}ms)`);
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
    camera?: Camera,
    shipSprite?: AnimatedSprite
  ): EngineFlamesRenderParams | null {
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_PARAMS] getRenderParams called with:`, {
      transform: transform ? 'VALID' : 'NULL',
      opacity,
      screenX: screenX.toFixed(1),
      screenY: screenY.toFixed(1),
      animationTime: animationTime.toFixed(2)
    });

    if (opacity <= 0) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_PARAMS] ❌ Opacity <= 0, returning null`);
      return null;
    }

    if (!transform) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_PARAMS] ❌ Transform is null, returning null`);
      return null;
    }

    const shipRotation = transform.rotation;
    const visualConfig = this.getVisualConfig(transform, camera, shipSprite);
    const flamePosition = this.calculateFlamePosition(shipRotation, screenX, screenY, visualConfig);
    const flameRotation = shipRotation + Math.PI; // Opposite to ship direction
    const flameSpriteRotation = flameRotation - Math.PI / 2; // Rotate from vertical to horizontal
    const frameIndex = this.calculateFrameIndex(animationTime);
    const scale = visualConfig.scale;

    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_PARAMS] ✅ Returning valid params - Ship at (${screenX.toFixed(1)}, ${screenY.toFixed(1)}), flames at (${flamePosition.x.toFixed(1)}, ${flamePosition.y.toFixed(1)}), rotation: ${shipRotation.toFixed(2)}, opacity: ${opacity}, scale: ${scale.toFixed(2)}, frameIndex: ${frameIndex}`);

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
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] Starting render - sprite loaded: ${sprite?.isLoaded()}, frameIndex: ${params.frameIndex}`);

    if (!sprite) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] ❌ Sprite is null`);
      return;
    }

    if (!sprite.isLoaded()) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] ❌ Sprite not loaded`);
      return;
    }

    const frame = sprite.getFrame(params.frameIndex);
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] Frame retrieved:`, frame ? {
      name: frame.name,
      x: frame.x, y: frame.y,
      width: frame.width, height: frame.height
    } : 'NULL FRAME');

    if (!frame) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) {
        console.log(`[DEBUG_FLAMES_RENDER] ❌ Frame is null/undefined - checking frames array`);
        console.log(`[DEBUG_FLAMES_RENDER] Sprite frames count: ${sprite.spritesheet.frames?.length || 0}`);
        console.log(`[DEBUG_FLAMES_RENDER] Frame index requested: ${params.frameIndex}`);
      }
      return;
    }

    const destWidth = frame.width * params.scale;
    const destHeight = frame.height * params.scale;

    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] Rendering at (${params.screenX.toFixed(1)}, ${params.screenY.toFixed(1)}) with size ${destWidth.toFixed(1)}x${destHeight.toFixed(1)}, opacity: ${params.opacity}`);

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

      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] ✅ Flames rendered successfully`);
    } catch (error) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES_RENDER] ❌ Error during rendering:`, error);
    }
  }
}
