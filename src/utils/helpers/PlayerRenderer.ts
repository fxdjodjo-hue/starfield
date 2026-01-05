/**
 * Helper for player rendering logic
 */
export class PlayerRenderer {
  /**
   * Get the vertical floating offset for player visual animation
   */
  static getFloatOffset(): number {
    return Math.sin(Date.now() * 0.003) * 2; // ±2 pixel vertical float
  }
}
