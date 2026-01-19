import { DisplayManager, DISPLAY_CONSTANTS } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';
import type { PanelConfig } from './PanelConfig';

/**
 * Classe base astratta per i pannelli UI
 * Definisce l'interfaccia comune per tutti i pannelli
 */
export abstract class BasePanel {
  protected container: HTMLElement;
  protected content: HTMLElement;
  protected isVisible: boolean = false;
  protected config: PanelConfig;

  constructor(config: PanelConfig) {
    this.config = config;
    this.container = this.createPanelContainer();
    this.content = this.createPanelContent();
    this.container.appendChild(this.content); // AGGIUNGI IL CONTENT AL CONTAINER!
  }

  /**
   * Crea il contenitore principale del pannello
   */
  private createPanelContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = `panel-${this.config.id}`;
    container.className = 'ui-panel';

    // Usa border-radius compensato per DPR
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    const borderRadius = Math.round(DISPLAY_CONSTANTS.BORDER_RADIUS_LG / dpr);

    container.style.cssText = `
      position: fixed;
      ${this.getPositionStyles()}
      width: ${this.config.size.width}px;
      height: ${this.config.size.height}px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: ${borderRadius}px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      z-index: 2000;
      opacity: 0;
      transform: scale(0.95);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    return container;
  }

  /**
   * Crea il contenuto del pannello (implementato dalle sottoclassi)
   */
  protected abstract createPanelContent(): HTMLElement;

  /**
   * Restituisce gli stili di posizione basati sulla configurazione
   */
  private getPositionStyles(): string {
    // Calcola la posizione centrale basandosi sulle dimensioni del pannello
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const centerX = width / 2 - this.config.size.width / 2;
    const centerY = height / 2 - this.config.size.height / 2;

    return `top: ${centerY}px; left: ${centerX}px;`;
  }


  /**
   * Mostra il pannello
   */
  show(): void {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.container.style.display = 'block';
    this.container.style.pointerEvents = 'auto';

    // Trigger reflow per animazione
    this.container.offsetHeight;

    this.container.style.opacity = '1';
    this.container.style.transform = 'scale(1)';
    this.isVisible = true;
  }

  /**
   * Nasconde il pannello
   */
  hide(): void {
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95)';
    this.container.style.pointerEvents = 'none';

    // Rimuovi dal DOM dopo l'animazione
    setTimeout(() => {
      if (this.container.parentNode) {
        this.container.style.display = 'none';
      }
    }, 300);

    this.isVisible = false;
  }

  /**
   * Toggle visibilità pannello
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Verifica se il pannello è visibile
   */
  isPanelVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Restituisce la configurazione del pannello
   */
  getConfig(): PanelConfig {
    return this.config;
  }

  /**
   * Distrugge il pannello
   */
  destroy(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }
  }
}

/**
 * FloatingIcon - Gestisce le icone flottanti per aprire pannelli UI
 * Gestisce l'aspetto visuale e interazione delle icone flottanti
 */
export class FloatingIcon {
  private element: HTMLElement;
  private panel: BasePanel;
  private config: PanelConfig;
  private isHovered: boolean = false;
  private onOpenPanel?: (panelId: string) => void;

  constructor(panel: BasePanel, onOpenPanel?: (panelId: string) => void) {
    this.panel = panel;
    this.config = panel.getConfig();
    this.onOpenPanel = onOpenPanel;
    this.element = this.createIconElement(this.config);
    this.setupEventListeners();
  }

  /**
   * Crea l'elemento icona
   */
  private createIconElement(config: PanelConfig): HTMLElement {
    const icon = document.createElement('div');
    icon.id = `icon-${config.id}`;
    icon.className = 'ui-floating-icon';
    icon.innerHTML = config.icon;
    icon.title = config.title;

    // Usa dimensioni responsive con compensazione DPR
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    const dprCompensation = 1 / dpr;
    const iconSize = Math.round(DISPLAY_CONSTANTS.ICON_SIZE * dprCompensation);
    const borderRadius = Math.round(DISPLAY_CONSTANTS.BORDER_RADIUS_SM * dprCompensation);
    const fontSize = Math.round(20 * dprCompensation);

    icon.style.cssText = `
      position: fixed;
      ${this.getIconPosition(config.position)}
      width: ${iconSize}px;
      height: ${iconSize}px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: ${borderRadius}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${fontSize}px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      z-index: 1500;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    return icon;
  }

  /**
   * Restituisce la posizione dell'icona usando margini responsive compensati per DPR
   */
  private getIconPosition(position: string): string {
    // Usa il margine standard compensato per DPR
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    const margin = Math.round(DISPLAY_CONSTANTS.SCREEN_MARGIN / dpr);

    switch (position) {
      case 'top-left':
        return `top: ${margin}px; left: ${margin}px;`;
      case 'top-right':
        return `top: ${margin}px; right: ${margin}px;`;
      case 'center-left':
        return `top: 50%; left: ${margin}px; transform: translateY(-50%);`;
      case 'center-left-below':
        return `top: 56%; left: ${margin}px; transform: translateY(-50%);`;
      case 'center-left-below2':
        return `top: 62%; left: ${margin}px; transform: translateY(-50%);`;
      case 'bottom-left':
        return `bottom: ${margin}px; left: ${margin}px;`;
      case 'bottom-right':
        return `bottom: ${margin}px; right: ${margin}px;`;
      default:
        return `top: 50%; left: ${margin}px; transform: translateY(-50%);`; // Default al centro sinistro
    }
  }

  /**
   * Imposta gli event listeners
   */
  private setupEventListeners(): void {
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onOpenPanel) {
        // Usa il nuovo sistema: apri pannello chiudendo tutti gli altri
        this.onOpenPanel(this.config.id);
      } else {
        // Fallback al comportamento precedente
        this.panel.toggle();
      }
    });

    this.element.addEventListener('mouseenter', () => {
      this.isHovered = true;
      this.updateStyle();
    });

    this.element.addEventListener('mouseleave', () => {
      this.isHovered = false;
      this.updateStyle();
    });
  }

  /**
   * Aggiorna lo stile dell'icona basato sullo stato
   */
  private updateStyle(): void {
    if (this.panel.isPanelVisible()) {
      // Stato attivo - glass con accento bianco
      this.element.style.background = 'rgba(255, 255, 255, 0.2)';
      this.element.style.color = 'rgba(255, 255, 255, 0.9)';
      this.element.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      this.element.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    } else if (this.isHovered) {
      // Hover - glass più intenso
      this.element.style.background = 'rgba(255, 255, 255, 0.15)';
      this.element.style.color = 'rgba(255, 255, 255, 0.9)';
      this.element.style.borderColor = 'rgba(255, 255, 255, 0.25)';
      this.element.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
    } else {
      // Stato normale - glass sottile
      this.element.style.background = 'rgba(255, 255, 255, 0.1)';
      this.element.style.color = 'rgba(255, 255, 255, 0.8)';
      this.element.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    }
  }

  /**
   * Mostra l'icona
   */
  show(): void {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    this.element.style.display = 'flex';

    // Usa fade-in sincronizzato
    applyFadeIn(this.element);
  }

  /**
   * Nasconde l'icona
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Aggiorna lo stato visuale dell'icona
   */
  updateState(): void {
    this.updateStyle();
  }

  /**
   * Restituisce l'ID del pannello associato
   */
  getPanelId(): string {
    return this.config.id;
  }

  /**
   * Distrugge l'icona
   */
  destroy(): void {
    if (document.body.contains(this.element)) {
      document.body.removeChild(this.element);
    }
  }
}