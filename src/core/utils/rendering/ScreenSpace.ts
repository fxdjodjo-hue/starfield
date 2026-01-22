import { Transform } from '../../../entities/spatial/Transform';
import { Camera } from '../../../entities/spatial/Camera';

/**
 * Screen space conversion utilities
 */
export class ScreenSpace {
  /**
   * Convert world coordinates to screen coordinates
   */
  static toScreen(transform: Transform, camera: Camera, canvasWidth: number, canvasHeight: number): { x: number, y: number } {
    return camera.worldToScreen(transform.x, transform.y, canvasWidth, canvasHeight);
  }

  /**
   * Convert world position to screen coordinates
   */
  static worldToScreen(x: number, y: number, camera: Camera, canvasWidth: number, canvasHeight: number): { x: number, y: number } {
    return camera.worldToScreen(x, y, canvasWidth, canvasHeight);
  }
}
