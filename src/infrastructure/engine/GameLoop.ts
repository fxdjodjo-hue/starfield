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
  /**
   * Loop principale con fixed timestep per update e rendering variabile
   * Supporta fallback su setTimeout quando requestAnimationFrame viene throttlato (background tab)
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    // Calcola delta time reale
    const frameTime = currentTime - this.lastTime;

    // Rileva se il browser sta rallentando troppo (throttling > 100ms)
    // Normalmente rAF gira a 16ms (60fps). Se siamo > 100ms, probabilmente siamo in background.
    const isThrottled = frameTime > 100;

    this.lastTime = currentTime;

    // Accumula tempo per fixed timestep
    // Cap frameTime a 250ms per evitare "spirale della morte" se il gioco si blocca per un po'
    this.accumulatedTime += Math.min(frameTime, 250);

    // Update con timestep fisso
    while (this.accumulatedTime >= CONFIG.FIXED_DELTA_TIME) {
      this.updateCallback?.(CONFIG.FIXED_DELTA_TIME);
      this.accumulatedTime -= CONFIG.FIXED_DELTA_TIME;
    }

    // Render sempre (variabile framerate)
    this.renderCallback?.();

    if (isThrottled) {
      // Se siamo throttlati, usiamo setTimeout per garantire un tick rate decente (~30fps)
      // anche se il browser vorrebbe fermarci a 1fps o meno
      setTimeout(() => {
        if (this.isRunning) this.loop();
      }, 33); // Target ~30fps in background
    } else {
      // Funzionamento normale
      requestAnimationFrame(this.loop);
    }
  };
}
