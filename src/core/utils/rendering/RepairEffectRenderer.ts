import { RepairEffect } from '../../../entities/combat/RepairEffect';
import { Transform } from '../../../entities/spatial/Transform';

export interface RepairEffectRenderParams {
  x: number;
  y: number;
  width: number;
  height: number;
  image: HTMLImageElement | null;
}

/**
 * Renderer per effetti di riparazione
 * Simile a ExplosionRenderer ma per effetti di riparazione
 */
export class RepairEffectRenderer {
  private static readonly SCALE_FACTOR = 0.8; // Adjust as needed

  /**
   * Ottiene i parametri di rendering per un effetto di riparazione
   */
  static getRenderParams(
    repairEffect: RepairEffect,
    transform: Transform,
    screenX: number,
    screenY: number
  ): RepairEffectRenderParams | null {
    const currentFrame = repairEffect.getCurrentFrame();

    if (!currentFrame || !currentFrame.complete || currentFrame.naturalWidth === 0) {
      return null;
    }

    const scaledWidth = currentFrame.width * this.SCALE_FACTOR;
    const scaledHeight = currentFrame.height * this.SCALE_FACTOR;

    // Centra perfettamente l'effetto sul player
    return {
      x: screenX - scaledWidth / 2,
      y: screenY - scaledHeight / 2,
      width: scaledWidth,
      height: scaledHeight,
      image: currentFrame
    };
  }
}
