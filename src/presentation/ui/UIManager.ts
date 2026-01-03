/**
 * UIManager - Sistema di gestione delle interfacce utente HTML
 * Gestisce icone flottanti e pannelli che si aprono/chiudono
 * Architettura modulare e future-proof per aggiungere nuove UI
 */

import type { PanelConfig } from './PanelConfig';

export interface PanelData {
  [key: string]: any; // Flexible data structure for different panels
}

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
    this.setupEventListeners();
  }

  /**
   * Crea il contenitore principale del pannello
   */
  private createPanelContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = `panel-${this.config.id}`;
    container.className = 'ui-panel';
    container.style.cssText = `
      position: fixed;
      ${this.getPositionStyles()}
      width: ${this.config.size.width}px;
      height: ${this.config.size.height}px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      box-shadow:
        0 20px 40px rgba(0, 0, 0, 0.4),
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
    const centerX = window.innerWidth / 2 - this.config.size.width / 2;
    const centerY = window.innerHeight / 2 - this.config.size.height / 2;

    return `top: ${centerY}px; left: ${centerX}px;`;
  }

  /**
   * Imposta gli event listener
   */
  private setupEventListeners(): void {
    // Chiudi pannello cliccando fuori
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.container.contains(e.target as Node)) {
        this.hide();
      }
    });

    // Previeni chiusura quando si clicca dentro il pannello
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Mostra il pannello
   */
  show(): void {
    if (this.isVisible) return;

    this.isVisible = true;

    // Assicura che sia nel DOM PRIMA di applicare gli stili
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    // Ricalcola posizione centrale (responsive) - PRIMA degli stili di animazione
    this.updatePosition();

    // Piccola pausa per permettere al browser di applicare la posizione
    setTimeout(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
      this.container.style.pointerEvents = 'auto';
    }, 10);

    // Assicura che sia nel DOM
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    this.onShow();
  }

  /**
   * Nasconde il pannello
   */
  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95)';
    this.container.style.pointerEvents = 'none';

    this.onHide();
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
   * Aggiorna i dati del pannello
   */
  abstract update(data: PanelData): void;

  /**
   * Callback chiamato quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Implementato dalle sottoclassi se necessario
  }

  /**
   * Callback chiamato quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Implementato dalle sottoclassi se necessario
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
   * Aggiorna la posizione del pannello (usato per il responsive design)
   */
  updatePosition(): void {
    if (!this.isVisible) return;

    const centerX = window.innerWidth / 2 - this.config.size.width / 2;
    const centerY = window.innerHeight / 2 - this.config.size.height / 2;

    this.container.style.left = `${centerX}px`;
    this.container.style.top = `${centerY}px`;
  }

  /**
   * Distrugge il pannello e rimuove gli elementi dal DOM
   */
  destroy(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }
  }
}

/**
 * Gestore delle icone flottanti che aprono i pannelli
 */
export class FloatingIcon {
  private element: HTMLElement;
  private panel: BasePanel;
  private config: PanelConfig;
  private isHovered: boolean = false;

  constructor(panel: BasePanel) {
    this.panel = panel;
    this.config = panel.getConfig();
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

    icon.style.cssText = `
      position: fixed;
      ${this.getIconPosition(config.position)}
      width: 48px;
      height: 48px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: rgba(148, 163, 184, 0.8);
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
   * Restituisce la posizione dell'icona
   */
  private getIconPosition(position: string): string {
    const margin = 20;

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
      this.panel.toggle();
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
      this.element.style.background = 'rgba(59, 130, 246, 0.9)';
      this.element.style.color = 'rgba(255, 255, 255, 0.9)';
      this.element.style.borderColor = 'rgba(59, 130, 246, 0.5)';
    } else if (this.isHovered) {
      this.element.style.background = 'rgba(148, 163, 184, 0.9)';
      this.element.style.color = 'rgba(15, 23, 42, 0.9)';
      this.element.style.borderColor = 'rgba(148, 163, 184, 0.5)';
    } else {
      this.element.style.background = 'rgba(15, 23, 42, 0.9)';
      this.element.style.color = 'rgba(148, 163, 184, 0.8)';
      this.element.style.borderColor = 'rgba(148, 163, 184, 0.3)';
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
   * Distrugge l'icona
   */
  destroy(): void {
    if (document.body.contains(this.element)) {
      document.body.removeChild(this.element);
    }
  }
}

/**
 * UIManager - Gestore principale delle UI
 * Coordina icone flottanti e pannelli
 */
export class UIManager {
  private panels: Map<string, BasePanel> = new Map();
  private icons: Map<string, FloatingIcon> = new Map();
  private isVisible: boolean = true;
  private resizeHandler: (() => void) | null = null;

  constructor() {
    this.setupResizeHandler();
  }

  /**
   * Imposta l'event handler per il resize della finestra
   */
  private setupResizeHandler(): void {
    this.resizeHandler = () => {
      // Ricalcola la posizione di tutti i pannelli visibili quando la finestra viene ridimensionata
      this.panels.forEach(panel => {
        if (panel.isPanelVisible()) {
          panel.updatePosition();
        }
      });
    };

    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Registra un nuovo pannello con la sua icona
   */
  registerPanel(panel: BasePanel): void {
    // La configurazione è già nel pannello stesso (single source of truth)
    const config = panel.getConfig();
    const icon = new FloatingIcon(panel);

    this.panels.set(config.id, panel);
    this.icons.set(config.id, icon);

    // Mostra l'icona se il manager è visibile
    if (this.isVisible) {
      icon.show();
    }
  }

  /**
   * Rimuove un pannello e la sua icona
   */
  unregisterPanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    const icon = this.icons.get(panelId);

    if (panel) {
      panel.destroy();
      this.panels.delete(panelId);
    }

    if (icon) {
      icon.destroy();
      this.icons.delete(panelId);
    }
  }

  /**
   * Mostra tutte le icone UI
   */
  showUI(): void {
    this.isVisible = true;
    this.icons.forEach(icon => icon.show());
  }

  /**
   * Nasconde tutte le icone UI
   */
  hideUI(): void {
    this.isVisible = false;
    this.icons.forEach(icon => icon.hide());
    // Chiudi anche tutti i pannelli aperti
    this.panels.forEach(panel => panel.hide());
  }

  /**
   * Aggiorna tutti i pannelli con nuovi dati
   */
  updatePanels(updates: { [panelId: string]: PanelData }): void {
    Object.entries(updates).forEach(([panelId, data]) => {
      const panel = this.panels.get(panelId);
      if (panel) {
        panel.update(data);
      }
    });

    // Aggiorna lo stato delle icone
    this.icons.forEach(icon => icon.updateState());
  }

  /**
   * Chiude tutti i pannelli aperti
   */
  closeAllPanels(): void {
    this.panels.forEach(panel => panel.hide());
    this.icons.forEach(icon => icon.updateState());
  }

  /**
   * Restituisce un pannello specifico
   */
  getPanel(panelId: string): BasePanel | undefined {
    return this.panels.get(panelId);
  }

  /**
   * Verifica se almeno un pannello è aperto
   */
  hasOpenPanels(): boolean {
    return Array.from(this.panels.values()).some(panel => panel.isPanelVisible());
  }

  /**
   * Distrugge tutti i pannelli e icone
   */
  destroy(): void {
    // Rimuovi l'event listener per il resize
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.panels.forEach(panel => panel.destroy());
    this.icons.forEach(icon => icon.destroy());
    this.panels.clear();
    this.icons.clear();
  }
}
