import { CONFIG } from '../../core/utils/config/GameConfig';
import { WorkerTimer } from './WorkerTimer';

/**
 * Game loop basato su requestAnimationFrame con delta time
 */
export class GameLoop {
  private lastTime = 0;
  private accumulatedTime = 0;
  private isRunning = false;
  private updateCallback?: (deltaTime: number) => void;
  private renderCallback?: () => void;

  // Timer basato su Worker per il background
  private workerTimer: WorkerTimer;
  private usingWorker = false;

  constructor() {
    // Inizializza il worker timer che chiamerà il loop
    this.workerTimer = new WorkerTimer(() => {
      if (this.isRunning && document.hidden) {
        this.loop();
      }
    });

    // Ascolta i cambi di visibilità per switchare strategia
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      console.log('[GameLoop] Tab hidden: switching to Worker Timer');
      // Tab nascosto: ferma rAF (implicito) e avvia Worker
      // Usiamo 33ms (~30fps) per risparmiare risorse ma tenere viva la simulazione
      this.usingWorker = true;
      this.workerTimer.start(33);
    } else {
      console.log('[GameLoop] Tab visible: switching to requestAnimationFrame');
      // Tab visibile: ferma Worker e riprendi rAF
      this.usingWorker = false;
      this.workerTimer.stop();

      // Riavvia il loop rAF se il gioco è in esecuzione
      if (this.isRunning) {
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
      }
    }
  };

  /**
   * Avvia il game loop
   */
  start(updateCallback: (deltaTime: number) => void, renderCallback: () => void): void {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.isRunning = true;
    this.lastTime = performance.now();

    if (document.hidden) {
      this.handleVisibilityChange(); // Avvia subito il worker se siamo già nascosti
    } else {
      this.loop(); // Avvia rAF
    }
  }

  /**
   * Ferma il game loop
   */
  stop(): void {
    this.isRunning = false;
    this.workerTimer.stop();
  }

  /**
   * Distrugge il loop e i listener
   */
  dispose(): void {
    this.stop();
    this.workerTimer.dispose();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Loop principale con fixed timestep per update e rendering variabile
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    try {
      const currentTime = performance.now();
      // Calcola delta time reale
      const frameTime = currentTime - this.lastTime;

      this.lastTime = currentTime;

      // Accumula tempo per fixed timestep
      // Se il tab è visibile, cappiamo a 250ms per evitare spiral of death su lag veri.
      // Se il tab è nascosto, permettiamo recupero totale (10s+) perché il tick del worker 
      // potrebbe essere disallineato o il browser potrebbe aver comunque sospeso per un po'.
      const maxFrameTime = document.hidden ? 10000 : 250;

      this.accumulatedTime += Math.min(frameTime, maxFrameTime);

      // Update con timestep fisso
      while (this.accumulatedTime >= CONFIG.FIXED_DELTA_TIME) {
        this.updateCallback?.(CONFIG.FIXED_DELTA_TIME);
        this.accumulatedTime -= CONFIG.FIXED_DELTA_TIME;
      }

      // Render solo se visibile
      if (!document.hidden) {
        this.renderCallback?.();
      }

    } catch (error) {
      console.error('[GameLoop] Error in game loop:', error);
    }

    // Se NON stiamo usando il worker (quindi siamo visibili), richiedi il prossimo frame.
    // Se stiamo usando il worker, questo metodo verrà richiamato dal prossimo tick del worker.
    if (!this.usingWorker && !document.hidden) {
      requestAnimationFrame(this.loop);
    }
  };
}
