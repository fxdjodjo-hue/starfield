import { GameState } from './GameState';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { AuthScreen } from '../../presentation/ui/AuthScreen';
import { DisplayManager } from '../../infrastructure/display';

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
    this.addPlaytestBanner();
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
    // Pulisce il canvas con uno sfondo scuro usando dimensioni logiche
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, width, height);

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
   * Aggiunge un banner di avviso playtest
   */
  private addPlaytestBanner(): void {
    // Rimuovi banner esistente se presente
    const existingBanner = document.getElementById('playtest-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    // Crea il banner
    const banner = document.createElement('div');
    banner.id = 'playtest-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        text-align: center;
        z-index: 10000;
        border: 2px solid white;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
      ">
        🚨 PLAYTEST EARLY - Bug possibili - Progressi resettabili 🚨
        <br>
        <small>Versione sperimentale - Feedback benvenuto!</small>
      </div>
      <style>
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(banner);
  }

  /**
   * Restituisce la AuthScreen per accesso esterno
   */
  getAuthScreen(): AuthScreen {
    return this.authScreen;
  }
}
