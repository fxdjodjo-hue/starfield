import { GameLoop } from './GameLoop';
import { World } from './World';

/**
 * Classe principale del gioco che coordina tutto
 */
export class Game {
  private gameLoop: GameLoop;
  private world: World;

  constructor(canvas: HTMLCanvasElement) {
    this.gameLoop = new GameLoop();
    this.world = new World(canvas);
  }

  /**
   * Inizializza il gioco
   */
  async init(): Promise<void> {
    // Qui in futuro potremmo caricare risorse, inizializzare sistemi, etc.
    console.log('Game initialized');
  }

  /**
   * Avvia il gioco
   */
  start(): void {
    console.log('Game started');

    this.gameLoop.start(
      // Update callback
      (deltaTime: number) => {
        this.world.update(deltaTime);
      },
      // Render callback
      () => {
        this.world.render();
      }
    );
  }

  /**
   * Ferma il gioco
   */
  stop(): void {
    console.log('Game stopped');
    this.gameLoop.stop();
  }

  /**
   * Restituisce il world per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
