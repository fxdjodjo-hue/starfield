import { GameState } from './GameState.js';
import { GameContext } from '../core/GameContext.js';
import { StartScreen } from '../ui/StartScreen.js';

/**
 * Stato della schermata iniziale
 * Gestisce la UI di avvio del gioco senza logica di gameplay
 */
export class StartState extends GameState {
  private startScreen: StartScreen;

  constructor(private context: GameContext) {
    super();
    this.startScreen = new StartScreen(context);
  }

  /**
   * Attiva la start screen
   */
  enter(context: GameContext): void {
    console.log('Entering StartState');

    // Mostra la start screen
    this.startScreen.show();

    // Nota: il callback è già stato impostato in Game.init()
    // Non sovrascrivere il callback qui!
  }

  /**
   * Aggiorna lo stato (niente da aggiornare nella start screen)
   */
  update(deltaTime: number): void {
    // La start screen è statica, non ha logica di update
  }

  /**
   * Renderizza lo stato (opzionale, la UI è HTML)
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Pulisce il canvas con uno sfondo scuro
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Potrebbe renderizzare qualche effetto visivo di sfondo
    // ma per ora lasciamo solo il canvas pulito
  }

  /**
   * Gestisce input specifici (opzionale)
   */
  handleInput(event: Event): void {
    // Gli input sono gestiti direttamente dalla StartScreen tramite HTML
  }

  /**
   * Disattiva la start screen
   */
  exit(): void {
    console.log('Exiting StartState');
    this.startScreen.hide();
  }

  /**
   * Metodo di debug per testare il callback (rimuovi dopo)
   */
  testCallback(nickname: string): void {
    console.log(`Player ${nickname} ready to start!`);
  }

  /**
   * Restituisce la StartScreen per accesso esterno
   */
  getStartScreen(): StartScreen {
    return this.startScreen;
  }
}
