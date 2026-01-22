import { CONFIG } from '../../core/utils/config/GameConfig';

/**
 * Game loop basato su requestAnimationFrame con delta time
 */
export class GameLoop {
  private lastTime = 0;
  private accumulatedTime = 0;
  private isRunning = false;
  private updateCallback?: (deltaTime: number) => void;
  private renderCallback?: () => void;

  /**
   * Avvia il game loop
   */
  start(updateCallback: (deltaTime: number) => void, renderCallback: () => void): void {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  /**
   * Ferma il game loop
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Loop principale con fixed timestep per update e rendering variabile
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Accumula tempo per fixed timestep
    this.accumulatedTime += frameTime;

    // Update con timestep fisso
    while (this.accumulatedTime >= CONFIG.FIXED_DELTA_TIME) {
      this.updateCallback?.(CONFIG.FIXED_DELTA_TIME);
      this.accumulatedTime -= CONFIG.FIXED_DELTA_TIME;
    }

    // Render sempre (variabile framerate)
    this.renderCallback?.();

    // Richiedi prossimo frame
    requestAnimationFrame(this.loop);
  };
}
