import { GameLoop } from './GameLoop';
import { GameContext } from './GameContext';
import { GameState } from '../states/GameState';
import { StartState } from '../states/StartState';
import { PlayState } from '../states/PlayState';

/**
 * Classe principale del gioco che coordina stati e game loop
 * Gestisce le transizioni tra stati del gioco
 */
export class Game {
  private gameLoop: GameLoop;
  private context: GameContext;
  private currentState: GameState | null = null;
  private startState: StartState;
  private playState: PlayState;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    this.gameLoop = new GameLoop();
    this.context = new GameContext(canvas, gameContainer);

    // Crea gli stati
    this.startState = new StartState(this.context);
    this.playState = new PlayState(this.context);
  }

  /**
   * Inizializza il gioco e imposta lo stato iniziale
   */
  async init(): Promise<void> {
    console.log('Game initialized');

    // Imposta il callback per il passaggio a PlayState
    this.startState.getStartScreen().setOnPlayCallback((nickname) => {
      console.log(`Starting game for player: ${nickname}`);
      this.changeState(this.playState);
    });

    // Inizia con lo StartState
    await this.changeState(this.startState);
  }

  /**
   * Avvia il game loop
   */
  start(): void {
    console.log('Game loop started');

    this.gameLoop.start(
      // Update callback
      (deltaTime: number) => {
        this.update(deltaTime);
      },
      // Render callback
      () => {
        this.render();
      }
    );
  }

  /**
   * Ferma il gioco
   */
  stop(): void {
    console.log('Game stopped');
    this.gameLoop.stop();

    // Esci dallo stato corrente
    if (this.currentState) {
      this.currentState.exit();
      this.currentState = null;
    }
  }

  /**
   * Cambia lo stato del gioco
   */
  private async changeState(newState: GameState): Promise<void> {
    // Esci dallo stato corrente
    if (this.currentState) {
      this.currentState.exit();
    }

    // Imposta il nuovo stato
    this.currentState = newState;
    this.context.currentState = newState;

    // Entra nel nuovo stato
    await newState.enter(this.context);
  }

  /**
   * Aggiorna il gioco (chiamato dal game loop)
   */
  private update(deltaTime: number): void {
    if (this.currentState) {
      this.currentState.update(deltaTime);
    }
  }

  /**
   * Renderizza il gioco (chiamato dal game loop)
   */
  private render(): void {
    const ctx = this.context.canvas.getContext('2d');
    if (!ctx) return;

    // Renderizza lo stato corrente
    if (this.currentState && this.currentState.render) {
      this.currentState.render(ctx);
    }
  }

  /**
   * Restituisce il contesto del gioco
   */
  getContext(): GameContext {
    return this.context;
  }

  /**
   * Forza il cambio a uno stato specifico (per debug/testing)
   */
  async forceState(state: GameState): Promise<void> {
    await this.changeState(state);
  }
}
