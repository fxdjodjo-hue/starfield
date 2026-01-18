import { getFormattedVersion } from '../../../../core/utils/config/Version';
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
  private discordIcon!: DiscordIcon;
  private stars: HTMLDivElement[] = [];
  private animationFrameId?: number;

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
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
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      border-top-color: rgba(255, 255, 255, 0.8);
      animation: spin 1s linear infinite;
      opacity: 0;
      animation: spin 1s linear infinite, fadeIn 0.8s ease-out 0.6s both;
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
      margin-top: 32px;
      opacity: 0;
      animation: fadeIn 1s ease-out 1.5s both;
      position: absolute;
      bottom: 24px;
    `;

    // Crea stelle animate
    this.createStarsBackground();

    // Assembla tutto
    this.container.appendChild(this.loadingContainer);
    this.container.appendChild(this.authContainer);
    this.container.appendChild(this.versionElement);

    // Aggiungi al DOM
    document.body.appendChild(this.container);

    // Crea icona Discord (non mostrata subito, solo durante login)
    this.discordIcon = new DiscordIcon('https://discord.gg/eCa927g2mm');

    // Avvia animazione stelle
    this.animateStars();

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
   * Crea stelle animate per effetto spaziale
   */
  createStarsBackground(): void {
    const starCount = 80;
    const sizes = ['small', 'medium', 'large'];

    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      const sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
      star.className = `star-particle ${sizeClass}`;

      // Posizione casuale
      const x = Math.random() * 100;
      const y = Math.random() * 100;

      // Velocità e delay casuali per movimento fluido
      const duration = 8 + Math.random() * 12; // 8-20s
      const delay = Math.random() * 4;
      const floatDelay = Math.random() * 2;

      star.style.cssText = `
        left: ${x}%;
        top: ${y}%;
        animation: starTwinkle ${duration}s ease-in-out infinite,
                   starFloat ${duration * 1.5}s ease-in-out infinite;
        animation-delay: ${delay}s, ${floatDelay}s;
      `;

      this.container.appendChild(star);
      this.stars.push(star);
    }
  }

  /**
   * Anima le stelle con movimento continuo
   */
  private animateStars(): void {
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      // Movimento lento e continuo delle stelle
      this.stars.forEach((star, index) => {
        const speed = 0.0001 + (index % 3) * 0.00005;
        const currentLeft = parseFloat(star.style.left) || 0;
        const currentTop = parseFloat(star.style.top) || 0;

        // Movimento orbitale lento
        const newLeft = (currentLeft + speed * delta) % 100;
        const newTop = (currentTop + speed * delta * 0.5) % 100;

        star.style.left = `${newLeft}%`;
        star.style.top = `${newTop}%`;
      });

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
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
   * Nasconde il DiscordIcon (metodo legacy per compatibilità)
   */
  hide(): void {
    this.hideDiscordIcon();
  }

  /**
   * Pulisce le animazioni quando il componente viene distrutto
   */
  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.discordIcon) {
      this.discordIcon.destroy();
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
