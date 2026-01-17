import { GameLoop } from './GameLoop';
import { GameContext } from './GameContext';
import { GameState } from '../../game/states/GameState';
import { StartState } from '../../game/states/StartState';
import { PlayState } from '../../game/states/PlayState';
import { DisplayManager } from '../display';

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
  private displayManager: DisplayManager;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    // Inizializza DisplayManager prima di tutto per gestione DPI/viewport
    this.displayManager = DisplayManager.getInstance();
    this.displayManager.initialize();

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
    console.log('[Game] init() chiamato');
    const authScreen = this.startState.getAuthScreen();
    
    // Salva riferimento a AuthScreen nel context per accesso da PlayState
    this.context.authScreen = authScreen;
    console.log('[Game] AuthScreen salvato nel context');

    // Imposta il callback per il passaggio a PlayState quando autenticato
    authScreen.setOnAuthenticated(async () => {
      console.log('[Game] onAuthenticated callback chiamato, inizializzando PlayState in background...');
      
      // Inizializza PlayState in background SENZA cambiare stato ancora
      // Lo spinner rimarrà visibile durante l'inizializzazione
      try {
        await this.playState.enter(this.context);
        console.log('[Game] PlayState inizializzato, cambiando stato...');
        
        // Solo ora cambia stato (lo spinner verrà nascosto da PlayState quando tutto è pronto)
        await this.changeState(this.playState);
        console.log('[Game] Stato cambiato a PlayState');
      } catch (error) {
        console.error('[Game] CRITICAL: Errore durante inizializzazione PlayState:', error);

        // 🔴 SECURITY: Se è un errore critico (connessione, rete, etc), ferma tutto
        // Non continuare con inizializzazioni inconsistenti
        const errorString = error.toString() + (error.message || '') + (error.stack || '');

        if (error.message === 'CONNECTION_FAILED' ||
            errorString.includes('WebSocket') ||
            errorString.includes('connection') ||
            errorString.includes('network') ||
            errorString.includes('ECONNREFUSED') ||
            errorString.includes('ENOTFOUND') ||
            errorString.includes('ETIMEDOUT')) {

          console.error('[Game] CRITICAL: Network/connection error - stopping initialization completely');

          if (authScreen && typeof authScreen.showConnectionError === 'function') {
            authScreen.showConnectionError(
              'Cannot connect to game server. Please check your internet connection and refresh the page.',
              () => window.location.reload()
            );
          } else {
            alert('CRITICAL ERROR: Cannot connect to game server. Please refresh the page.');
          }

          // 🔴 CRITICAL: Non continuare per nessun motivo - ferma tutto qui
          return;
        }

        // 🔴 SECURITY: QUALUNQUE errore durante inizializzazione critica è fatale
        // Non continuare mai con stati inconsistenti
        console.error('[Game] CRITICAL: Fatal error during PlayState initialization - stopping completely');

        if (authScreen && typeof authScreen.showConnectionError === 'function') {
          authScreen.showConnectionError(
            'Critical system error during game initialization. Please refresh the page.',
            () => window.location.reload()
          );
        } else {
          alert('CRITICAL ERROR: System initialization failed. Please refresh the page.');
        }

        // 🔴 CRITICAL: Non continuare per NESSUN errore - ferma tutto qui
        return;
      }
    });

    // Inizia con lo StartState
    console.log('[Game] Cambiando stato a StartState...');
    await this.changeState(this.startState);
    console.log('[Game] StartState attivato');
  }

  /**
   * Avvia il game loop
   */
  start(): void {
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
    this.gameLoop.stop();

    // Esci dallo stato corrente
    if (this.currentState) {
      this.currentState.exit();
      this.currentState = null;
    }

    // Cleanup DisplayManager
    this.displayManager.destroy();
  }

  /**
   * Cambia lo stato del gioco
   */
  private async changeState(newState: GameState): Promise<void> {
    console.log('[Game] changeState() chiamato, nuovo stato:', newState.constructor.name);
    
    // Esci dallo stato corrente
    if (this.currentState) {
      console.log('[Game] Uscendo da stato corrente:', this.currentState.constructor.name);
      this.currentState.exit();
    }

    // Imposta il nuovo stato
    this.currentState = newState;
    this.context.currentState = newState;
    console.log('[Game] Nuovo stato impostato:', newState.constructor.name);

    // Se lo stato è già stato inizializzato (enter() già chiamato), non chiamarlo di nuovo
    // Questo permette di inizializzare PlayState in background prima di cambiare stato
    if (newState === this.playState && (newState as any)._initialized) {
      console.log('[Game] PlayState già inizializzato, saltando enter()');
      return;
    }

    // Entra nel nuovo stato
    console.log('[Game] Chiamando enter() sul nuovo stato...');
    await newState.enter(this.context);
    console.log('[Game] enter() completato per stato:', newState.constructor.name);
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
