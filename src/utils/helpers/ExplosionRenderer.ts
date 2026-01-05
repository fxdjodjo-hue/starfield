import { Explosion } from '../../entities/combat/Explosion';

/**
 * Rendering parameters for explosions
 */
export interface ExplosionRenderParams {
  x: number;
  y: number;
  width: number;
  height: number;
  image: HTMLImageElement | null;
}

/**
 * Helper for explosion rendering logic
 */
export class ExplosionRenderer {
  private static readonly SCALE_FACTOR = 0.8;

  /**
   * Get rendering parameters for explosion
   */
  static getRenderParams(explosion: Explosion, screenX: number, screenY: number): ExplosionRenderParams | null {
    const currentFrame = explosion.getCurrentFrame();

    if (!currentFrame || !currentFrame.complete || currentFrame.naturalWidth === 0) {
      return null;
    }

    const scaledWidth = currentFrame.width * this.SCALE_FACTOR;
    const scaledHeight = currentFrame.height * this.SCALE_FACTOR;

    return {
      x: screenX - scaledWidth / 2,
      y: screenY - scaledHeight / 2,
      width: scaledWidth,
      height: scaledHeight,
      image: currentFrame
    };
  }
}
