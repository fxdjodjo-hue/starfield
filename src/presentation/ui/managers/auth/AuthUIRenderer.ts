import { getFormattedVersion } from '../../../../utils/config/Version';

/**
 * Manages UI rendering (container, loading, styles, background)
 */
export class AuthUIRenderer {
  private container!: HTMLDivElement;
  private loadingContainer!: HTMLDivElement;
  private authContainer!: HTMLDivElement;
  private versionElement!: HTMLDivElement;

  /**
   * Crea l'interfaccia utente
   */
  createUI(): {
    container: HTMLDivElement;
    loadingContainer: HTMLDivElement;
    authContainer: HTMLDivElement;
    versionElement: HTMLDivElement;
  } {
    // Container principale
    this.container = document.createElement('div');
    this.container.id = 'authscreen-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle at 20% 80%, rgba(20, 40, 80, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(40, 20, 60, 0.15) 0%, transparent 50%),
        linear-gradient(135deg, #000011 0%, #001122 50%, #000018 100%);
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
    `;

    // Container loading
    this.loadingContainer = document.createElement('div');
    this.loadingContainer.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      text-align: center;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    const loadingTitle = document.createElement('h2');
    loadingTitle.textContent = 'STARFIELD MMO';
    loadingTitle.style.cssText = `
      color: #00ff88;
      font-size: 36px;
      margin: 0 0 20px 0;
      text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
      letter-spacing: 2px;
    `;

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading...';
    loadingText.style.cssText = `
      font-size: 18px;
      margin: 20px 0;
      opacity: 0.8;
    `;

    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      border-top-color: #00ff88;
      animation: spin 1s ease-in-out infinite;
      margin: 20px 0;
    `;

    this.loadingContainer.appendChild(loadingTitle);
    this.loadingContainer.appendChild(loadingText);
    this.loadingContainer.appendChild(loadingSpinner);

    // Container autenticazione
    this.authContainer = document.createElement('div');
    this.authContainer.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 400px;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    // Versione
    this.versionElement = document.createElement('div');
    this.versionElement.className = 'authscreen-version';
    this.versionElement.textContent = `Version ${getFormattedVersion()}`;
    this.versionElement.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      text-align: center;
      width: 100%;
      margin-top: 20px;
      opacity: 0;
    `;

    // Aggiungi stelle di sfondo
    this.createStarsBackground();

    // Assembla tutto
    this.container.appendChild(this.loadingContainer);
    this.container.appendChild(this.authContainer);
    this.container.appendChild(this.versionElement);

    // Aggiungi al DOM
    document.body.appendChild(this.container);

    return {
      container: this.container,
      loadingContainer: this.loadingContainer,
      authContainer: this.authContainer,
      versionElement: this.versionElement
    };
  }

  /**
   * Aggiunge stili CSS globali
   */
  addGlobalStyles(): void {
    const existingStyle = document.getElementById('authscreen-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'authscreen-styles';
    style.textContent = `
      @keyframes fadeInUp {
        0% {
          opacity: 0;
          transform: translateY(30px);
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

      @keyframes starTwinkle {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .star-particle {
        position: absolute;
        background: #ffffff;
        border-radius: 50%;
        pointer-events: none;
        animation: starTwinkle 4s ease-in-out infinite;
      }

      .star-particle:nth-child(odd) {
        animation-delay: -2s;
      }

      .star-particle:nth-child(3n) {
        animation-duration: 6s;
      }

      .authscreen-version {
        animation: fadeInUp 1.5s ease-out 1.5s both;
      }

      .loading-spinner {
        display: block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #ffffff;
        animation: spin 1s ease-in-out infinite;
        flex-shrink: 0;
      }

      /* Disabilita selezione testo in tutta la schermata */
      #authscreen-container * {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
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
   * Crea stelle di sfondo per atmosfera spaziale
   */
  createStarsBackground(): void {
    const starCount = 50;

    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'star-particle';

      // Posizione casuale
      const x = Math.random() * 100;
      const y = Math.random() * 100;

      // Dimensione casuale (più piccole per essere rilassanti)
      const size = Math.random() * 2 + 1;

      star.style.cssText = `
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${Math.random() * 4}s;
      `;

      this.container.appendChild(star);
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
