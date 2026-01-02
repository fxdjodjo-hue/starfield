import { GameContext } from '../core/GameContext';

/**
 * Componente UI per la schermata iniziale
 * Gestisce HTML, validazione input e interazioni utente
 */
export class StartScreen {
  private container: HTMLElement;
  private nicknameInput: HTMLInputElement;
  private playButton: HTMLButtonElement;
  private errorMessage: HTMLElement;
  private onPlayCallback?: (nickname: string) => void;
  private context: GameContext;

  constructor(context: GameContext) {
    this.context = context;
    this.container = this.createUI();
    this.nicknameInput = this.container.querySelector('#nickname-input') as HTMLInputElement;
    this.playButton = this.container.querySelector('#play-button') as HTMLButtonElement;
    this.errorMessage = this.container.querySelector('#error-message') as HTMLElement;

    this.setupEventListeners();
    this.updateUI();
  }

  /**
   * Crea l'HTML della schermata iniziale
   */
  private createUI(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'start-screen';
    container.innerHTML = `
      <div class="start-screen-overlay">
        <div class="start-screen-content">
          <h1 class="game-title">Starfield</h1>

          <div class="nickname-section">
            <label for="nickname-input" class="input-label">Enter your nickname:</label>
            <input
              type="text"
              id="nickname-input"
              class="nickname-input"
              placeholder="Your space pilot name"
              maxlength="16"
              autocomplete="off"
            />
            <div id="error-message" class="error-message"></div>
          </div>

          <button id="play-button" class="play-button" disabled>
            Start Mission
          </button>

          <div class="game-info">
            <p>Navigate with mouse • Explore the cosmos • Ready for multiplayer</p>
          </div>
        </div>
      </div>
    `;

    // Aggiungi gli stili CSS
    this.addStyles();

    return container;
  }

  /**
   * Aggiunge gli stili CSS per la start screen
   */
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      #start-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        font-family: 'Arial', sans-serif;
      }

      .start-screen-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .start-screen-content {
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid #00ff88;
        border-radius: 15px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 0 30px rgba(0, 255, 136, 0.3);
      }

      .game-title {
        color: #00ff88;
        font-size: 3em;
        margin: 0 0 10px 0;
        text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        font-weight: bold;
      }


      .nickname-section {
        margin-bottom: 30px;
      }

      .input-label {
        display: block;
        color: #ffffff;
        margin-bottom: 10px;
        font-size: 1.1em;
      }

      .nickname-input {
        width: 100%;
        padding: 12px;
        font-size: 1.1em;
        border: 2px solid #333;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        outline: none;
        transition: border-color 0.3s ease;
      }

      .nickname-input:focus {
        border-color: #00ff88;
        box-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
      }

      .nickname-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      .error-message {
        color: #ff6b6b;
        font-size: 0.9em;
        margin-top: 8px;
        min-height: 20px;
      }

      .play-button {
        background: linear-gradient(135deg, #00ff88, #00ccaa);
        color: #000;
        border: none;
        padding: 15px 40px;
        font-size: 1.2em;
        font-weight: bold;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
      }

      .play-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 255, 136, 0.5);
      }

      .play-button:disabled {
        background: #555;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
      }

      .game-info {
        margin-top: 30px;
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.9em;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Imposta gli event listeners per input e pulsante
   */
  private setupEventListeners(): void {
    // Validazione in tempo reale dell'input
    this.nicknameInput.addEventListener('input', () => {
      this.updateUI();
    });

    // Gestione invio con Enter
    this.nicknameInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !this.playButton.disabled) {
        this.handlePlay();
      }
    });

    // Click sul pulsante Play
    this.playButton.addEventListener('click', () => {
      this.handlePlay();
    });
  }

  /**
   * Gestisce il click sul pulsante Play
   */
  private handlePlay(): void {
    const nickname = this.nicknameInput.value.trim();
    try {
      this.context.setPlayerNickname(nickname);
      this.onPlayCallback?.(nickname);
    } catch (error) {
      this.showError('Nickname non valido');
    }
  }

  /**
   * Aggiorna l'aspetto della UI basato sulla validazione
   */
  private updateUI(): void {
    const nickname = this.nicknameInput.value.trim();
    const isValid = this.context.validateNickname(nickname);

    // Abilita/disabilita il pulsante
    this.playButton.disabled = !isValid;

    // Mostra/nascondi errori
    if (nickname.length > 0 && !isValid) {
      if (nickname.length < 3) {
        this.showError('Il nickname deve essere di almeno 3 caratteri');
      } else if (nickname.length > 16) {
        this.showError('Il nickname non può superare i 16 caratteri');
      } else {
        this.showError('Il nickname può contenere solo lettere e numeri');
      }
    } else {
      this.hideError();
    }
  }

  /**
   * Mostra un messaggio di errore
   */
  private showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
  }

  /**
   * Nasconde il messaggio di errore
   */
  private hideError(): void {
    this.errorMessage.textContent = '';
    this.errorMessage.style.display = 'none';
  }

  /**
   * Imposta il callback per quando l'utente clicca Play
   */
  setOnPlayCallback(callback: (nickname: string) => void): void {
    this.onPlayCallback = callback;
  }

  /**
   * Mostra la start screen
   */
  show(): void {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.nicknameInput.focus();
  }

  /**
   * Nasconde la start screen
   */
  hide(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }
  }

  /**
   * Distrugge la start screen e rimuove tutti gli event listeners
   */
  destroy(): void {
    this.hide();
    // Gli event listeners verranno automaticamente rimossi quando l'elemento viene rimosso dal DOM
  }
}
