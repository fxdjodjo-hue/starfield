/**
 * Helper for player rendering logic
 */
export class PlayerRenderer {
  /**
   * Get the vertical floating offset for player visual animation
   * @param frameTime Optional timestamp sincronizzato con frame rate (in ms)
   */
  static getFloatOffset(frameTime?: number): number {
    const time = frameTime !== undefined ? frameTime : Date.now();
    return Math.sin(time * 0.003) * 2; // ±2 pixel vertical float
  }
}
