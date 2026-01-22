import { AuthState } from './AuthState';
import { AuthUIRenderer } from './AuthUIRenderer';
import { AuthSessionManager } from './AuthSessionManager';
import { PlaytestCodeModal } from './PlaytestCodeModal';

/**
 * Manages initialization and lifecycle
 */
export class AuthInitializationManager {
  private uiRenderer: AuthUIRenderer;
  private container: HTMLDivElement;
  private loadingContainer: HTMLDivElement;
  private authContainer: HTMLDivElement;
  private playtestModal: PlaytestCodeModal;

  constructor() {
    // Initialize UI renderer
    this.uiRenderer = new AuthUIRenderer();
    this.uiRenderer.addGlobalStyles();

    const uiElements = this.uiRenderer.createUI();
    this.container = uiElements.container;
    this.loadingContainer = uiElements.loadingContainer;
    this.authContainer = uiElements.authContainer;

    this.playtestModal = new PlaytestCodeModal();
  }

  /**
   * Inizializza la schermata
   */
  async initialize(sessionManager: AuthSessionManager, hasJustLoggedIn: boolean): Promise<void> {
    // Se siamo in modalità playtest, mostra prima il popup del codice
    // Per ora lo mostriamo sempre per semplicità come richiesto dall'utente
    this.playtestModal.show(this.authContainer, (code) => {
      // Quando sbloccato, procedi con il controllo sessione
      if (!hasJustLoggedIn) {
        sessionManager.checkExistingSession();
      }
    });
  }

  /**
   * Aggiorna il testo di loading
   */
  updateLoadingText(text: string): void {
    this.uiRenderer.updateLoadingText(this.loadingContainer, text);
  }

  /**
   * Nasconde la schermata (chiamato quando i dati sono pronti)
   */
  hide(): void {

    // Fade out animato più duraturo
    this.container.style.transition = 'opacity 1.2s ease-out';
    this.container.style.opacity = '0';

    // Nascondi anche il DiscordIcon
    this.uiRenderer.hide();

    // Dopo l'animazione, nascondi completamente
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 1200);
  }

  /**
   * Distrugge la schermata
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Rimuovi stili
    const style = document.getElementById('authscreen-styles');
    if (style) {
      style.remove();
    }
  }

  /**
   * Gets container
   */
  getContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Gets loading container
   */
  getLoadingContainer(): HTMLDivElement {
    return this.loadingContainer;
  }

  /**
   * Gets auth container
   */
  getAuthContainer(): HTMLDivElement {
    return this.authContainer;
  }

  /**
   * Mostra l'icona Discord
   */
  showDiscordIcon(): void {
    this.uiRenderer.showDiscordIcon();
  }

  /**
   * Nasconde l'icona Discord
   */
  hideDiscordIcon(): void {
    this.uiRenderer.hideDiscordIcon();
  }
}
