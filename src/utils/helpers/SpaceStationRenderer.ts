/**
 * Helper for space station rendering logic
 */
export class SpaceStationRenderer {
  /**
   * Get the vertical floating offset for space station visual animation
   * Space station floats slower and with larger amplitude than player
   * @param frameTime Optional timestamp sincronizzato con frame rate (in ms)
   */
  static getFloatOffset(frameTime?: number): number {
    const time = frameTime !== undefined ? frameTime : Date.now();
    // Fluttuazione più lenta (0.002) e ampia (±4 pixel) rispetto al player
    return Math.sin(time * 0.002) * 4;
  }
}
