import { AuthState } from './AuthState';
import { AuthUIRenderer } from './AuthUIRenderer';
import { AuthSessionManager } from './AuthSessionManager';
import { PlaytestCodeModal } from './PlaytestCodeModal';
import { getApiBaseUrl } from '../../../../config/NetworkConfig';

/**
 * Manages initialization and lifecycle
 */
export class AuthInitializationManager {
  private uiRenderer: AuthUIRenderer;
  private container: HTMLDivElement;
  private loadingContainer: HTMLDivElement;
  private authContainer: HTMLDivElement;
  private playtestModal: PlaytestCodeModal;
  private statusInterval?: any;

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
    // Playtest disabilitato - procedi direttamente
    if (!hasJustLoggedIn) {
      await sessionManager.checkExistingSession();
    }

    // Inizia il controllo dello stato del server
    this.checkServerStatus();
    this.statusInterval = setInterval(() => this.checkServerStatus(), 10000); // Ogni 10 secondi
  }

  /**
   * Verifica se il server è online chiamando l'endpoint /health
   */
  private async checkServerStatus(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${getApiBaseUrl()}/health`, {
        method: 'GET',
        signal: controller.signal,
        // Evita cache per avere lo stato reale ad ogni polling
        cache: 'no-store'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.uiRenderer.updateServerStatus('online');
      } else {
        this.uiRenderer.updateServerStatus('offline');
      }
    } catch (error) {
      this.uiRenderer.updateServerStatus('offline');
    }
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
      // Ferma il polling quando la schermata di auth non è più visibile
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = undefined;
      }
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

    // Ferma polling
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    // Pulisce renderer
    this.uiRenderer.destroy();
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
