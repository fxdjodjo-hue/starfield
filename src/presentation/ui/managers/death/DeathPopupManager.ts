import { GameContext } from '../../../../infrastructure/engine/GameContext';

/**
 * DeathPopupManager - Gestisce il popup di morte e respawn del player
 * Mostra un countdown semplice durante il respawn
 */
export class DeathPopupManager {
  private gameContext: GameContext;
  private isVisible: boolean = false;
  private onRespawnCallback: (() => void) | null = null;

  // Elementi DOM
  private overlay: HTMLDivElement | null = null;
  private popup: HTMLDivElement | null = null;

  constructor(gameContext: GameContext) {
    this.gameContext = gameContext;
    this.createUI();
  }

  /**
   * Imposta il callback da chiamare quando il player clicca respawn
   */
  setOnRespawnCallback(callback: () => void): void {
    this.onRespawnCallback = callback;
  }

  /**
   * Crea gli elementi UI per il popup
   */
  private createUI(): void {
    // Overlay scuro
    this.overlay = document.createElement('div');
    this.overlay.id = 'death-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: none;
      z-index: 10000;
      justify-content: center;
      align-items: center;
    `;

    // Container popup
    this.popup = document.createElement('div');
    this.popup.style.cssText = `
      background-color: rgba(20, 20, 20, 0.95);
      border: 2px solid #ff4444;
      border-radius: 10px;
      padding: 30px;
      text-align: center;
      box-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
      min-width: 300px;
    `;

    // Titolo
    const title = document.createElement('h2');
    title.textContent = 'SHIP DESTROYED';
    title.style.cssText = `
      color: #ff4444;
      margin: 0 0 20px 0;
      font-size: 24px;
      font-family: monospace;
      text-transform: uppercase;
    `;

    // Messaggio
    const message = document.createElement('p');
    message.textContent = 'Your ship has been destroyed!';
    message.style.cssText = `
      color: #cccccc;
      margin: 0 0 30px 0;
      font-family: monospace;
      font-size: 16px;
    `;

    // Bottone Respawn
    const respawnButton = document.createElement('button');
    respawnButton.textContent = 'RESPAWN';
    respawnButton.style.cssText = `
      background-color: #ff4444;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 12px 24px;
      font-size: 18px;
      font-family: monospace;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    respawnButton.onmouseover = () => respawnButton.style.backgroundColor = '#cc3333';
    respawnButton.onmouseout = () => respawnButton.style.backgroundColor = '#ff4444';
    respawnButton.onclick = () => this.onRespawnClick();

    // Assembla elementi
    this.popup.appendChild(title);
    this.popup.appendChild(message);
    this.popup.appendChild(respawnButton);
    this.overlay.appendChild(this.popup);
    document.body.appendChild(this.overlay);

  }

  /**
   * Mostra il popup di morte
   */
  showDeathPopup(): void {

    if (this.isVisible) {
      return;
    }

    if (!this.overlay || !this.popup) {
      console.error('[DeathPopupManager] UI elements not created!');
      return;
    }

    this.isVisible = true;
    this.overlay.style.display = 'flex';

    // Verifica che gli elementi siano nel DOM
  }

  /**
   * Gestisce il click del bottone respawn
   */
  private onRespawnClick(): void {
    if (this.onRespawnCallback) {
      this.onRespawnCallback();
    } else {
      console.error('[DeathPopupManager] No respawn callback set!');
    }
  }


  /**
   * Nasconde il popup di morte
   */
  hideDeathPopup(): void {

    if (!this.isVisible) {
      return;
    }

    this.isVisible = false;

    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }


  /**
   * Verifica se il popup è visibile
   */
  isPopupVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Distrugge il manager e rimuove gli elementi DOM
   */
  destroy(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    this.overlay = null;
    this.popup = null;
    this.onRespawnCallback = null;
  }
}
