import { GameState } from './GameState';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { AuthScreen } from '../../presentation/ui/AuthScreen';

/**
 * Stato della schermata iniziale
 * Gestisce la UI di autenticazione del gioco
 */
export class StartState extends GameState {
  private authScreen: AuthScreen;
  private context: GameContext;

  constructor(context: GameContext) {
    super();
    this.context = context;
    this.authScreen = new AuthScreen(context);
  }

  /**
   * Attiva la start screen
   */
  enter(context: GameContext): void {
    // La start screen è già mostrata nel costruttore
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
   * Disattiva la auth screen
   */
  exit(): void {
    this.authScreen.destroy();
  }

  /**
   * Restituisce la AuthScreen per accesso esterno
   */
  getAuthScreen(): AuthScreen {
    return this.authScreen;
  }
}
