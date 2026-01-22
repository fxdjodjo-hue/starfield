import { DisplayManager } from '../../../../infrastructure/display';

/**
 * AlphaDisclaimerModal - Popup disclaimer per gioco in early access/development
 */
export class AlphaDisclaimerModal {
  private modal: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private onAccept?: () => void;
  private dprCompensation: number;

  constructor() {
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
  }

  /**
   * Mostra il popup disclaimer
   */
  show(onAccept: () => void): void {
    if (this.modal) {
      this.hide();
    }

    this.onAccept = onAccept;
    const c = this.dprCompensation;

    // Overlay scuro
    this.overlay = document.createElement('div');
    this.overlay.id = 'alpha-disclaimer-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      animation: fadeIn 0.3s ease-out both;
    `;

    // Modal principale
    this.modal = document.createElement('div');
    this.modal.id = 'alpha-disclaimer-modal';
    this.modal.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: ${Math.round(24 * c)}px;
      padding: ${Math.round(40 * c)}px ${Math.round(48 * c)}px;
      max-width: ${Math.round(520 * c)}px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      animation: modalAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    `;

    // Titolo container
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      margin: 0 0 ${Math.round(16 * c)}px 0;
      text-align: center;
    `;

    // Emoji sopra
    const emoji = document.createElement('div');
    emoji.textContent = '⚠️';
    emoji.style.cssText = `
      font-size: ${Math.round(48 * c)}px;
      line-height: 1;
      margin-bottom: ${Math.round(12 * c)}px;
    `;

    // Testo titolo
    const title = document.createElement('h2');
    title.textContent = 'IN DEVELOPMENT';
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-size: ${Math.round(24 * c)}px;
      margin: 0;
      text-align: center;
      font-weight: 600;
      letter-spacing: 1px;
    `;

    titleContainer.appendChild(emoji);
    titleContainer.appendChild(title);

    // Contenuto
    const content = document.createElement('div');
    content.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: ${Math.round(14 * c)}px;
      line-height: 1.7;
      margin: 0 0 ${Math.round(32 * c)}px 0;
      text-align: left;
    `;

    const disclaimerText = document.createElement('p');
    disclaimerText.style.cssText = `margin: 0 0 ${Math.round(16 * c)}px 0;`;
    disclaimerText.innerHTML = `
      This game is currently in <strong>active development</strong>. Please be aware that:
    `;

    const list = document.createElement('ul');
    list.style.cssText = `
      margin: ${Math.round(12 * c)}px 0;
      padding-left: ${Math.round(24 * c)}px;
      list-style: none;
    `;

    const items = [
      'Graphics and UI may change significantly',
      'Game mechanics are subject to modification',
      'Bugs and incomplete features are expected',
      'Progress may be reset during updates',
      'Some features may not be fully functional'
    ];

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.textContent = item;
      li.style.cssText = `
        margin: ${Math.round(8 * c)}px 0;
        padding-left: ${Math.round(20 * c)}px;
        position: relative;
      `;
      li.innerHTML = `<span style="position: absolute; left: 0;">•</span> ${item}`;
      list.appendChild(li);
    });

    const footerText = document.createElement('p');
    footerText.style.cssText = `
      margin: ${Math.round(20 * c)}px 0 0 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: ${Math.round(13 * c)}px;
      text-align: center;
    `;
    footerText.textContent = 'Thank you for testing and helping us improve the game!';

    content.appendChild(disclaimerText);
    content.appendChild(list);
    content.appendChild(footerText);

    // Pulsante "I Understand"
    const button = document.createElement('button');
    button.textContent = 'I UNDERSTAND';
    button.style.cssText = `
      width: 100%;
      padding: ${Math.round(16 * c)}px ${Math.round(32 * c)}px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: ${Math.round(12 * c)}px;
      color: rgba(255, 255, 255, 0.95);
      font-size: ${Math.round(14 * c)}px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: 1px;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.15)';
      button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    button.addEventListener('click', () => {
      this.hide();
      if (this.onAccept) {
        this.onAccept();
      }
    });

    // Assembla modal
    this.modal.appendChild(titleContainer);
    this.modal.appendChild(content);
    this.modal.appendChild(button);

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Aggiungi animazioni CSS se non esistono
    this.addAnimations();
  }

  /**
   * Nasconde il popup
   */
  hide(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.style.animation = 'fadeOut 0.2s ease-out both';
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.modal = null;
      }, 200);
    }
  }

  /**
   * Aggiunge animazioni CSS
   */
  private addAnimations(): void {
    const existingStyle = document.getElementById('alpha-disclaimer-animations');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'alpha-disclaimer-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      @keyframes modalAppear {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }
}
