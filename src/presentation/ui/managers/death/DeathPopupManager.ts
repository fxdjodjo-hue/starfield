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
  private messageElement: HTMLParagraphElement | null = null;

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
      background-color: rgba(0, 0, 0, 0.8);
      display: none;
      opacity: 0;
      transition: opacity 0.8s ease-in-out;
      z-index: 10000;
      justify-content: center;
      align-items: center;
    `;

    // Container popup con effetto glassmorphism premium
    this.popup = document.createElement('div');
    this.popup.style.cssText = `
      background: rgba(10, 10, 15, 0.65);
      backdrop-filter: blur(25px) saturate(180%);
      -webkit-backdrop-filter: blur(25px) saturate(180%);
      border: 1px solid rgba(255, 68, 68, 0.25);
      border-radius: 20px;
      padding: 50px 60px;
      text-align: center;
      box-shadow: 
        0 24px 80px rgba(0, 0, 0, 0.8),
        inset 0 1px 1px rgba(255, 255, 255, 0.05),
        0 0 40px rgba(255, 68, 68, 0.1);
      min-width: 420px;
      opacity: 0;
      transform: scale(0.9) translateY(20px);
      transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    `;

    // Titolo con gradiente e glow
    const title = document.createElement('h2');
    title.textContent = 'SHIP DESTROYED';
    title.style.cssText = `
      color: #ff3333;
      margin: 0 0 12px 0;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 4px;
      text-transform: uppercase;
      text-shadow: 0 0 20px rgba(255, 51, 51, 0.4);
    `;

    // Linea separatrice decorativa
    const separator = document.createElement('div');
    separator.style.cssText = `
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, transparent, #ff3333, transparent);
      margin: 0 auto 25px auto;
      border-radius: 2px;
    `;

    // Messaggio con stile pulito
    this.messageElement = document.createElement('p');
    this.messageElement.textContent = 'Your ship was destroyed. Proceed to the space station to repair.';
    this.messageElement.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 40px 0;
      font-size: 16px;
      font-weight: 400;
      letter-spacing: 0.5px;
    `;

    // Bottone Respawn Premium
    const respawnButton = document.createElement('button');
    respawnButton.textContent = 'REPAIR';
    respawnButton.style.cssText = `
      background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 30px;
      padding: 16px 48px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 24px rgba(255, 68, 68, 0.3);
      outline: none;
    `;

    respawnButton.onmouseover = () => {
      respawnButton.style.transform = 'translateY(-2px)';
      respawnButton.style.boxShadow = '0 12px 32px rgba(255, 68, 68, 0.4)';
      respawnButton.style.filter = 'brightness(1.1)';
    };

    respawnButton.onmouseout = () => {
      respawnButton.style.transform = 'translateY(0)';
      respawnButton.style.boxShadow = '0 8px 24px rgba(255, 68, 68, 0.3)';
      respawnButton.style.filter = 'brightness(1)';
    };

    respawnButton.onclick = () => this.onRespawnClick();

    // Assembla elementi
    this.popup.appendChild(title);
    this.popup.appendChild(separator);
    if (this.messageElement) this.popup.appendChild(this.messageElement);
    this.popup.appendChild(respawnButton);
    this.overlay.appendChild(this.popup);
    document.body.appendChild(this.overlay);

  }

  /**
   * Mostra il popup di morte
   */
  showDeathPopup(killerName: string = ''): void {

    if (this.isVisible) {
      return;
    }

    if (!this.overlay || !this.popup || !this.messageElement) {
      console.error('[DeathPopupManager] UI elements not created!');
      return;
    }

    // Aggiorna il messaggio con il nome del killer se disponibile
    if (killerName) {
      this.messageElement.innerHTML = `
        Your ship was destroyed by <span style="color: #ff4444; font-weight: 800;">${killerName}</span>.<br>
        <span style="font-size: 14px; opacity: 0.8; margin-top: 10px; display: block;">Proceed to the space station to repair.</span>
      `;
    } else {
      this.messageElement.innerHTML = 'Your ship was destroyed. Proceed to the space station to repair.';
    }

    this.isVisible = true;
    this.overlay.style.display = 'flex';

    // Trigger animation via requestAnimationFrame
    requestAnimationFrame(() => {
      if (this.overlay && this.popup) {
        this.overlay.style.opacity = '1';
        this.popup.style.opacity = '1';
        this.popup.style.transform = 'scale(1)';
      }
    });
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

    if (this.overlay && this.popup) {
      this.overlay.style.opacity = '0';
      this.popup.style.opacity = '0';
      this.popup.style.transform = 'scale(0.9) translateY(20px)';

      // Nascondi fisicamente dopo la transizione (opzionale, o subito)
      setTimeout(() => {
        if (!this.isVisible && this.overlay) {
          this.overlay.style.display = 'none';
        }
      }, 500);
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
