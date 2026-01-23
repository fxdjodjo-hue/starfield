import { DisplayManager } from '../../infrastructure/display';

/**
 * DiscordIcon - Icona Discord cliccabile in alto a destra
 */
export class DiscordIcon {
  private container: HTMLElement;
  private discordUrl: string;
  private dprCompensation: number;

  constructor(discordUrl: string = 'https://discord.gg/eCa927g2mm') {
    this.discordUrl = discordUrl;
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.container = this.createIcon();
  }

  /**
   * Crea l'icona Discord
   */
  private createIcon(): HTMLElement {
    const c = this.dprCompensation;
    const margin = Math.round(20 * c);
    const size = Math.round(40 * c);

    const icon = document.createElement('a');
    icon.href = this.discordUrl;
    icon.target = '_blank';
    icon.rel = 'noopener noreferrer';
    icon.id = 'discord-icon';
    icon.style.cssText = `
      position: fixed;
      top: ${margin}px;
      right: ${margin}px;
      width: ${size}px;
      height: ${size}px;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(88, 101, 242, 0.15);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(88, 101, 242, 0.3);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1001;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    `;

    // Icona Discord
    const img = document.createElement('img');
    img.src = 'discordlogo.webp';
    img.alt = 'Discord';
    img.style.cssText = `
      width: ${Math.round(24 * c)}px;
      height: ${Math.round(24 * c)}px;
      object-fit: contain;
      pointer-events: none;
    `;
    icon.appendChild(img);

    // Hover effects
    icon.addEventListener('mouseenter', () => {
      icon.style.background = 'rgba(88, 101, 242, 0.25)';
      icon.style.borderColor = 'rgba(88, 101, 242, 0.5)';
      icon.style.transform = 'scale(1.1)';
      icon.style.boxShadow = '0 6px 20px rgba(88, 101, 242, 0.4)';
    });

    icon.addEventListener('mouseleave', () => {
      icon.style.background = 'rgba(88, 101, 242, 0.15)';
      icon.style.borderColor = 'rgba(88, 101, 242, 0.3)';
      icon.style.transform = 'scale(1)';
      icon.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
    });

    // Click effect
    icon.addEventListener('mousedown', () => {
      icon.style.transform = 'scale(0.95)';
    });

    icon.addEventListener('mouseup', () => {
      icon.style.transform = 'scale(1.1)';
    });

    document.body.appendChild(icon);
    return icon;
  }

  /**
   * Mostra l'icona
   */
  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /**
   * Nasconde l'icona
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Aggiorna l'URL Discord
   */
  setDiscordUrl(url: string): void {
    this.discordUrl = url;
    if (this.container) {
      (this.container as HTMLAnchorElement).href = url;
    }
  }

  /**
   * Distrugge l'icona
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
