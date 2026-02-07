import { getFormattedVersion } from '../../../../core/utils/config/AppVersion';
import { DiscordIcon } from '../../DiscordIcon';

/**
 * Manages UI rendering (container, loading, styles, background)
 * Modern, minimal design with animated space background
 */
export class AuthUIRenderer {
  private container!: HTMLDivElement;
  private loadingContainer!: HTMLDivElement;
  private authContainer!: HTMLDivElement;
  private versionElement!: HTMLDivElement;
  private statusElement!: HTMLDivElement;
  private discordIcon!: DiscordIcon;
  private videoBackground?: HTMLVideoElement;

  /**
   * Crea l'interfaccia utente
   */
  createUI(): {
    container: HTMLDivElement;
    loadingContainer: HTMLDivElement;
    authContainer: HTMLDivElement;
    versionElement: HTMLDivElement;
  } {
    // Aggiungi stili globali prima di creare gli elementi
    this.addGlobalStyles();

    // Container principale con sfondo nero e gradienti animati
    this.container = document.createElement('div');
    this.container.id = 'authscreen-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      opacity: 0;
      animation: fadeIn 1.5s ease-out forwards;
    `;


    // Container loading - minimal e elegante
    this.loadingContainer = document.createElement('div');
    this.loadingContainer.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      text-align: center;
      user-select: none;
      z-index: 10;
    `;

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading...';
    loadingText.style.cssText = `
      font-size: 14px;
      margin: 0 0 32px 0;
      opacity: 0.6;
      font-weight: 300;
      letter-spacing: 2px;
      opacity: 0;
      animation: fadeInUp 0.8s ease-out 0.4s both;
    `;

    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'modern-spinner';
    loadingSpinner.style.cssText = `
      width: 48px;
      height: 48px;
      border: 2px solid rgba(255, 255, 255, 0.05);
      border-radius: 50%;
      border-top-color: rgba(255, 255, 255, 0.8);
      animation: spin 1s linear infinite, fadeIn 0.8s ease-out 0.6s both;
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.05);
    `;

    this.loadingContainer.appendChild(loadingText);
    this.loadingContainer.appendChild(loadingSpinner);

    // Container autenticazione - centrato e pulito
    this.authContainer = document.createElement('div');
    this.authContainer.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 420px;
      user-select: none;
      z-index: 10;
    `;

    // Versione - discreta in basso
    this.versionElement = document.createElement('div');
    this.versionElement.className = 'authscreen-version';
    this.versionElement.textContent = `v${getFormattedVersion()}`;
    this.versionElement.style.cssText = `
      color: rgba(255, 255, 255, 0.3);
      font-size: 11px;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      text-align: center;
      width: 100%;
      margin-top: 8px;
    `;

    // Status del Server - sopra la versione
    this.statusElement = document.createElement('div');
    this.statusElement.className = 'authscreen-status';
    this.statusElement.innerHTML = `Status: <span class="status-indicator status-checking">checking...</span>`;
    this.statusElement.style.cssText = `
      color: rgba(255, 255, 255, 0.4);
      font-size: 11px;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      text-align: center;
      width: 100%;
      margin-top: 32px;
      opacity: 0;
      animation: fadeIn 1s ease-out 1.2s both;
    `;

    // Footer container per raggruppare status e versione
    const footer = document.createElement('div');
    footer.style.cssText = `
      position: absolute;
      bottom: 24px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 10;
    `;
    footer.appendChild(this.statusElement);
    footer.appendChild(this.versionElement);

    // Animazione fade in per la versione (spostata sul container se necessario o lasciata singola)
    this.versionElement.style.opacity = '0';
    this.versionElement.style.animation = 'fadeIn 1s ease-out 1.5s both';

    // Crea video background
    this.createVideoBackground();

    // Assembla tutto
    this.container.appendChild(this.loadingContainer);
    this.container.appendChild(this.authContainer);
    this.container.appendChild(footer);

    // Aggiungi al DOM
    document.body.appendChild(this.container);

    // Crea icona Discord (non mostrata subito, solo durante login)
    this.discordIcon = new DiscordIcon('https://discord.gg/eCa927g2mm');

    return {
      container: this.container,
      loadingContainer: this.loadingContainer,
      authContainer: this.authContainer,
      versionElement: this.versionElement
    };
  }

  /**
   * Aggiunge stili CSS globali moderni
   */
  addGlobalStyles(): void {
    const existingStyle = document.getElementById('authscreen-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'authscreen-styles';
    style.textContent = `
      /* Animazioni principali */
      @keyframes fadeInUp {
        0% {
          opacity: 0;
          transform: translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeIn {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes starFloat {
        0%, 100% {
          transform: translate(0, 0) scale(1);
          opacity: 0.4;
        }
        50% {
          transform: translate(10px, -10px) scale(1.1);
          opacity: 0.8;
        }
      }

      @keyframes starTwinkle {
        0%, 100% { 
          opacity: 0.3;
        }
        50% { 
          opacity: 1;
        }
      }

      @keyframes cardAppear {
        0% {
          opacity: 0;
          transform: translateY(20px) scale(0.98);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Stelle animate */
      .star-particle {
        position: absolute;
        background: #ffffff;
        border-radius: 50%;
        pointer-events: none;
        will-change: transform, opacity;
      }

      .star-particle.small {
        width: 1px;
        height: 1px;
        box-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
      }

      .star-particle.medium {
        width: 2px;
        height: 2px;
        box-shadow: 0 0 3px rgba(255, 255, 255, 0.9);
      }

      .star-particle.large {
        width: 3px;
        height: 3px;
        box-shadow: 0 0 4px rgba(255, 255, 255, 1);
      }

      /* Spinner moderno */
      .modern-spinner {
        will-change: transform;
      }

      /* Versione */
      .authscreen-version {
        font-weight: 300;
      }

      /* Disabilita selezione testo */
      #authscreen-container * {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      /* Status Indicator Styles */
      .status-indicator {
        font-weight: bold;
        transition: color 0.3s ease;
      }
      .status-online {
        color: #44ff44;
        text-shadow: 0 0 8px rgba(68, 255, 68, 0.4);
      }
      .status-offline {
        color: #ff4444;
        text-shadow: 0 0 8px rgba(255, 68, 68, 0.4);
      }
      .status-checking {
        color: rgba(255, 255, 255, 0.4);
      }

      /* Permetti selezione solo per input fields */
      #authscreen-container input {
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Crea video background con crossfade seamless sul loop
   */
  /**
   * Crea video background con overlay per profondità
   */
  private createVideoBackground(): void {
    // 1. Il Video
    this.videoBackground = document.createElement('video');
    this.videoBackground.src = 'assets/login/bg.mp4';
    this.videoBackground.autoplay = true;
    this.videoBackground.loop = true;
    this.videoBackground.muted = true;
    this.videoBackground.playsInline = true;
    this.videoBackground.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
      pointer-events: none;
      opacity: 0; 
      transition: opacity 2s ease-out;
    `;

    // Insert video element
    this.container.insertBefore(this.videoBackground, this.container.firstChild);

    // Fade in video once ready
    this.videoBackground.addEventListener('canplay', () => {
      if (this.videoBackground) {
        this.videoBackground.style.opacity = '1';
        this.videoBackground.play().catch(e => console.warn('Auto-play blocked:', e));
      }
    });

    // Debug: log video loading errors (but only if not destroying)
    this.videoBackground.addEventListener('error', (e) => {
      if (this.videoBackground && this.videoBackground.src !== window.location.href && this.videoBackground.src !== '') {
        console.error('[AuthUI] Video load error:', e);
        console.error('[AuthUI] Video src:', this.videoBackground?.src);
        console.error('[AuthUI] Video error code:', this.videoBackground?.error?.code);
        console.error('[AuthUI] Video error message:', this.videoBackground?.error?.message);
      }
    });

    // Force loaded check in case event already fired
    if (this.videoBackground.readyState >= 3) {
      this.videoBackground.style.opacity = '1';
    }
  }

  /**
   * Mostra il DiscordIcon
   */
  showDiscordIcon(): void {
    if (this.discordIcon) {
      this.discordIcon.show();
    }
  }

  /**
   * Nasconde il DiscordIcon
   */
  hideDiscordIcon(): void {
    if (this.discordIcon) {
      this.discordIcon.hide();
    }
  }

  /**
   * Mostra il logo del gioco (no-op: logo è ora dentro il form card)
   */
  showLogo(): void {
    // Logo is now rendered inside form card by AuthFormManager
  }

  /**
   * Nasconde il logo del gioco (no-op: logo è ora dentro il form card)
   */
  hideLogo(): void {
    // Logo is now rendered inside form card by AuthFormManager
  }

  /**
   * Nasconde il DiscordIcon (metodo legacy per compatibilità)
   */
  hide(): void {
    this.hideDiscordIcon();
  }

  /**
   * Pulisce quando il componente viene distrutto
   */
  destroy(): void {
    if (this.videoBackground) {
      this.videoBackground.pause();
      this.videoBackground.src = '';
    }
    if (this.discordIcon) {
      this.discordIcon.destroy();
    }
  }

  /**
   * Aggiorna lo stato visivo del server
   */
  updateServerStatus(status: 'online' | 'offline' | 'checking'): void {
    if (!this.statusElement) return;

    const indicator = this.statusElement.querySelector('.status-indicator');
    if (!indicator) return;

    indicator.className = `status-indicator status-${status}`;
    indicator.textContent = status.toUpperCase();

    if (status === 'checking') {
      indicator.textContent = 'CHECKING...';
    }
  }

  /**
   * Aggiorna il testo di loading
   */
  updateLoadingText(loadingContainer: HTMLElement, text: string): void {
    const loadingText = loadingContainer.querySelector('p');
    if (loadingText) {
      loadingText.textContent = text;
    }
  }
}
