import { AuthState } from './AuthState';
import { AuthUIRenderer } from './AuthUIRenderer';
import { AuthSessionManager } from './AuthSessionManager';
import { PlaytestCodeModal } from './PlaytestCodeModal';
import { getApiBaseUrl } from '../../../../config/NetworkConfig';
import { GameSettings } from '../../../../core/settings/GameSettings';

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

  // Audio system for login screen
  private backgroundMusic: HTMLAudioElement | null = null;
  private uiSound: HTMLAudioElement | null = null;
  private interactionListener: (() => void) | null = null;

  constructor() {
    // Initialize UI renderer
    this.uiRenderer = new AuthUIRenderer();
    this.uiRenderer.addGlobalStyles();

    const uiElements = this.uiRenderer.createUI();
    this.container = uiElements.container;
    this.loadingContainer = uiElements.loadingContainer;
    this.authContainer = uiElements.authContainer;

    this.playtestModal = new PlaytestCodeModal();

    // Initialize audio systems
    this.initializeMusic();
    this.initializeUISound();
  }

  /**
   * Inizializza l'oggetto Audio per la musica di sottofondo
   */
  private initializeMusic(): void {
    try {
      this.backgroundMusic = new Audio('assets/audio/loginscreenmusic/loginmusic.mp3');
      this.backgroundMusic.loop = true;
      this.backgroundMusic.volume = 0; // Inizia muto per il fade-in

      // Gestione autoplay: molti browser bloccano audio non richiesto dall'utente
      this.interactionListener = () => {
        this.tryPlayMusic();
      };
      document.addEventListener('click', this.interactionListener, { once: true });
      document.addEventListener('keydown', this.interactionListener, { once: true });
    } catch (e) {
      console.warn('[AuthAudio] Failed to initialize background music:', e);
    }
  }

  /**
   * Inizializza l'oggetto Audio per gli effetti sonori UI
   */
  private initializeUISound(): void {
    try {
      this.uiSound = new Audio('assets/audio/loginscreenmusic/uiSounds.mp3');
      this.uiSound.volume = 0.4; // Volume personalizzato per i click
    } catch (e) {
      console.warn('[AuthAudio] Failed to initialize UI sound:', e);
    }
  }

  /**
   * Riproduce l'effetto sonoro dei click
   */
  public playClickSound(): void {
    if (!this.uiSound) return;

    // Reset della traccia per permettere riproduzioni veloci consecutive
    this.uiSound.currentTime = 0;
    this.uiSound.play().catch(err => {
      // Ignora errori di riproduzione silenziosamente
    });
  }

  /**
   * Tenta di riprodurre la musica con un effetto di entrata graduale
   */
  private tryPlayMusic(): void {
    if (!this.backgroundMusic || !this.backgroundMusic.paused) return;
    this.fadeInMusic();
  }

  /**
   * Entrata graduale della musica
   */
  private fadeInMusic(): void {
    if (!this.backgroundMusic) return;

    const settings = GameSettings.getInstance().audio;
    const masterVol = settings.master / 100;
    const musicVol = settings.music / 100;
    const targetVolume = masterVol * musicVol * 0.5; // Mantiene il tetto dello 0.5 per il login
    this.backgroundMusic.volume = 0;

    this.backgroundMusic.play().then(() => {
      const fadeDuration = 10000; // 3 secondi per un'entrata molto dolce
      const interval = 50; // ogni 50ms
      const steps = fadeDuration / interval;
      const volumeStep = targetVolume / steps;

      const fadeInterval = setInterval(() => {
        if (!this.backgroundMusic) {
          clearInterval(fadeInterval);
          return;
        }

        if (this.backgroundMusic.volume < targetVolume - volumeStep) {
          this.backgroundMusic.volume += volumeStep;
        } else {
          this.backgroundMusic.volume = targetVolume;
          clearInterval(fadeInterval);
        }
      }, interval);
    }).catch(err => {
      // Autoplay ancora bloccato o file non trovato
      console.log('[AuthAudio] Playback blocked or failed:', err.message);
    });
  }

  /**
   * Inizializza la schermata
   */
  async initialize(sessionManager: AuthSessionManager, hasJustLoggedIn: boolean): Promise<void> {
    // Tenta il play immediato (potrebbe fallire se non c'è stata interazione)
    this.tryPlayMusic();

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
    // Dissolvenza musica
    this.fadeOutMusic();

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
   * Sfuma gradualmente la musica fino a fermarla
   */
  private fadeOutMusic(): void {
    if (!this.backgroundMusic) return;

    const startVolume = this.backgroundMusic.volume;
    const fadeDuration = 1000; // 1 secondo
    const interval = 50; // ogni 50ms
    const steps = fadeDuration / interval;
    const volumeStep = startVolume / steps;

    const fadeInterval = setInterval(() => {
      if (!this.backgroundMusic) {
        clearInterval(fadeInterval);
        return;
      }

      if (this.backgroundMusic.volume > volumeStep) {
        this.backgroundMusic.volume -= volumeStep;
      } else {
        this.backgroundMusic.volume = 0;
        this.backgroundMusic.pause();
        clearInterval(fadeInterval);
      }
    }, interval);
  }

  /**
   * Distrugge la schermata
   */
  destroy(): void {
    // Cleanup audio
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic = null;
    }

    if (this.interactionListener) {
      document.removeEventListener('click', this.interactionListener);
      document.removeEventListener('keydown', this.interactionListener);
    }

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

  /**
   * Mostra il logo del gioco
   */
  showLogo(): void {
    this.uiRenderer.showLogo();
  }

  /**
   * Nasconde il logo del gioco
   */
  hideLogo(): void {
    this.uiRenderer.hideLogo();
  }
}
