/**
 * UIManager - Sistema di gestione delle interfacce utente HTML
 * Gestisce icone flottanti e pannelli che si aprono/chiudono
 * Architettura modulare e future-proof per aggiungere nuove UI
 */

import type { PanelConfig } from './PanelConfig';
import { DisplayManager } from '../../infrastructure/display';
import { BasePanel, FloatingIcon } from './FloatingIcon';

export interface PanelData {
  [key: string]: any; // Flexible data structure for different panels
}

/**
 * UIManager - Gestore principale delle UI
 * Coordina icone flottanti e pannelli
 */
export class UIManager {
  private panels: Map<string, BasePanel> = new Map();
  private icons: Map<string, FloatingIcon> = new Map();
  private isVisible: boolean = false; // Inizia nascosto, verrà mostrato dopo l'animazione camera
  private unsubscribeResize: (() => void) | null = null;

  constructor() {
    this.setupResizeHandler();
    this.setupPanelEventListeners();
  }

  /**
   * Imposta i listener per gli eventi dei pannelli
   */
  private setupPanelEventListeners(): void {
    // Ascolta eventi personalizzati per i cambi di stato dei pannelli
    document.addEventListener('panelVisibilityChanged', (event: any) => {
      const { panelId, isVisible } = event.detail;
      this.updatePanelIcon(panelId);
    });
  }

  /**
   * Imposta l'event handler per il resize usando DisplayManager
   */
  private setupResizeHandler(): void {
    // Usa DisplayManager per gestione centralizzata del resize
    this.unsubscribeResize = DisplayManager.getInstance().onResize(() => {
      // Ricalcola la posizione di tutti i pannelli visibili quando la finestra viene ridimensionata
      this.panels.forEach(panel => {
        if (panel.isPanelVisible()) {
          panel.updatePosition();
        }
      });
    });
  }

  /**
   * Registra un nuovo pannello con la sua icona
   */
  registerPanel(panel: BasePanel): void {
    // La configurazione è già nel pannello stesso (single source of truth)
    const config = panel.getConfig();
    const icon = new FloatingIcon(panel, (panelId) => this.openPanel(panelId));

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
   * Apre un pannello specifico chiudendo tutti gli altri (solo un pannello per volta)
   * Se il pannello è già aperto, lo chiude
   */
  openPanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    // Se il pannello è già aperto, chiudilo
    if (panel.isPanelVisible()) {
      panel.hide();
      return;
    }

    // Altrimenti chiudi tutti i pannelli e apri quello specifico
    this.closeAllPanels();
    panel.show();
  }

  /**
   * Restituisce un pannello specifico
   */
  getPanel(panelId: string): BasePanel | undefined {
    return this.panels.get(panelId);
  }

  /**
   * Aggiorna lo stato dell'icona di un pannello specifico
   */
  updatePanelIcon(panelId: string): void {
    const icon = this.icons.get(panelId);
    if (icon) {
      icon.updateState();
    }
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
    // Rimuovi la sottoscrizione al resize
    if (this.unsubscribeResize) {
      this.unsubscribeResize();
      this.unsubscribeResize = null;
    }

    this.panels.forEach(panel => panel.destroy());
    this.icons.forEach(icon => icon.destroy());
    this.panels.clear();
    this.icons.clear();
  }
}
