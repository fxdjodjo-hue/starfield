/**
 * UIManager - Sistema di gestione delle interfacce utente HTML
 * Gestisce icone flottanti e pannelli che si aprono/chiudono
 * Architettura modulare e future-proof per aggiungere nuove UI
 */

import type { PanelConfig } from './PanelConfig';
import { DisplayManager } from '../../infrastructure/display';
import { BasePanel, FloatingIcon } from './FloatingIcon';
import { ConfirmationModal } from './ConfirmationModal';

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
  private logoutModal: ConfirmationModal;
  private isVisible: boolean = false; // Inizia nascosto, verrà mostrato dopo l'animazione camera
  private unsubscribeResize: (() => void) | null = null;
  private documentClickHandler: ((e: Event) => void) | null = null;
  private documentKeydownHandler: ((e: Event) => void) | null = null;
  private panelJustOpened: boolean = false;

  private isStickyPanel(panelId: string): boolean {
    return panelId === 'log-panel';
  }

  private isBlockingPanel(panelId: string): boolean {
    return !this.isStickyPanel(panelId);
  }

  private hasBlockingOpenPanels(): boolean {
    return Array.from(this.panels.values()).some(
      (panel) => panel.isPanelVisible() && this.isBlockingPanel(panel.getConfig().id)
    );
  }

  constructor() {
    this.logoutModal = new ConfirmationModal();
    this.setupResizeHandler();
    this.setupPanelEventListeners();
  }

  /**
   * Imposta i listener per gli eventi dei pannelli
   */
  private setupPanelEventListeners(): void {
    // Ascolta eventi personalizzati per i cambi di stato dei pannelli
    // Ascolta eventi personalizzati per i cambi di stato dei pannelli
    document.addEventListener('panelVisibilityChanged', (event: any) => {
      const { panelId, isVisible } = event.detail;
      this.updatePanelIcon(panelId);

      // Se un pannello è stato chiuso, verifica se tutti i pannelli sono chiusi
      // e in tal caso riabilita i controlli
      if (!isVisible) {
        // Usa un piccolo timeout per permettere l'aggiornamento dello stato isVisible del pannello
        // (anche se l'evento viene emesso dopo l'aggiornamento della flag, è più sicuro)
        setTimeout(() => {
          if (!this.hasBlockingOpenPanels()) {
            // console.log('[UIManager] All panels closed, emitting uiPanelClosed');
            document.dispatchEvent(new CustomEvent('uiPanelClosed'));
          }
        }, 10);
      }
    });

    // Gestione centralizzata del click fuori dai pannelli
    this.documentClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;

      if (this.panelJustOpened) return;
      if (target.closest('.ui-floating-icon') || target.closest('.ui-panel')) return;

      const visiblePanels = Array.from(this.panels.values()).filter((panel) => panel.isPanelVisible());
      if (visiblePanels.length === 0) return;

      // Chiudi solo i pannelli non sticky (il log resta aperto)
      const panelsToClose = visiblePanels.filter((panel) => !this.isStickyPanel(panel.getConfig().id));
      if (panelsToClose.length === 0) return;

      panelsToClose.forEach((panel) => panel.hide());
      if (!this.hasBlockingOpenPanels()) {
        document.dispatchEvent(new CustomEvent('uiPanelClosed'));
      }

      // Ferma l'evento solo se e stato chiuso almeno un pannello.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    document.addEventListener('click', this.documentClickHandler);

    // Gestione centralizzata di ESC per chiudere pannelli
    this.documentKeydownHandler = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Escape') {
        // 1. Priority: If Logout Modal is open, close it (Cancel)
        if (this.logoutModal && this.logoutModal.isModalVisible()) {
          this.logoutModal.hide();
          return;
        }

        // 2. If a blocking panel is open, close it first.
        // If none is blocking, close any visible sticky panel (e.g. log panel).
        const openBlockingPanel = Array.from(this.panels.values()).find(
          (panel) => panel.isPanelVisible() && this.isBlockingPanel(panel.getConfig().id)
        );
        const openStickyPanel = Array.from(this.panels.values()).find(
          (panel) => panel.isPanelVisible() && this.isStickyPanel(panel.getConfig().id)
        );
        const openPanel = openBlockingPanel || openStickyPanel;
        if (openPanel) {
          openPanel.hide();
          if (this.isBlockingPanel(openPanel.getConfig().id) && !this.hasBlockingOpenPanels()) {
            // Notifica che i controlli del player possono essere riabilitati
            document.dispatchEvent(new CustomEvent('uiPanelClosed'));
          }
        } else {
          // 3. If nothing is open, show Logout/Exit Confirmation
          this.logoutModal.show(
            'EXIT GAME',
            'Are you sure you want to quit the game?',
            () => {
              document.dispatchEvent(new CustomEvent('settings:logout'));
            },
            undefined,
            true
          );
        }
      }
    };

    document.addEventListener('keydown', this.documentKeydownHandler);
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
    const resolvedAutoPosition = this.resolveAutoIconPosition(config.position);
    if (resolvedAutoPosition !== config.position) {
      config.position = resolvedAutoPosition;
    }
    const icon = new FloatingIcon(panel, (panelId) => this.openPanel(panelId));

    this.panels.set(config.id, panel);
    this.icons.set(config.id, icon);

    // Mostra l'icona se il manager è visibile
    if (this.isVisible) {
      icon.show();
    }
  }

  private resolveAutoIconPosition(position: PanelConfig['position']): PanelConfig['position'] {
    if (position !== 'center-left-col2') {
      return position;
    }

    const col2Slots: PanelConfig['position'][] = [
      'center-left-col2',
      'center-left-col2-below',
      'center-left-col2-below2',
      'center-left-col2-below3',
      'center-left-col2-below4',
      'center-left-col2-below5'
    ];

    let existingCol2Count = 0;
    for (const registeredPanel of this.panels.values()) {
      const registeredPosition = registeredPanel.getConfig().position;
      if (registeredPosition.startsWith('center-left-col2')) {
        existingCol2Count += 1;
      }
    }

    return col2Slots[Math.min(existingCol2Count, col2Slots.length - 1)];
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
   * Chiude tutti i pannelli tranne quello specificato
   */
  closeAllPanelsExcept(exceptPanelId: string): void {
    this.panels.forEach((panel, panelId) => {
      const keepStickyLogOpen = panelId !== exceptPanelId && this.isStickyPanel(panelId) && exceptPanelId !== 'log-panel';
      if (panelId !== exceptPanelId && !keepStickyLogOpen) {
        panel.hide();
      }
    });
    this.icons.forEach(icon => icon.updateState());
  }

  /**
   * Apre un pannello specifico chiudendo tutti gli altri (solo un pannello per volta)
   * Se il pannello è già aperto, lo chiude (comportamento toggle intuitivo)
   */
  openPanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    const isBlockingPanel = this.isBlockingPanel(panelId);

    // Se il pannello è già aperto, chiudilo (toggle behavior)
    if (panel.isPanelVisible()) {
      panel.hide();
      if (isBlockingPanel && !this.hasBlockingOpenPanels()) {
        // Notifica che i controlli del player possono essere riabilitati
        document.dispatchEvent(new CustomEvent('uiPanelClosed'));
      }
      return;
    }

    // Notifica che i controlli del player dovrebbero essere disabilitati
    if (isBlockingPanel && !this.hasBlockingOpenPanels()) {
      document.dispatchEvent(new CustomEvent('uiPanelOpened'));
    }

    // Altrimenti chiudi tutti i pannelli tranne quello specifico e apri quello specifico
    this.closeAllPanelsExcept(panelId);
    panel.show();

    // Previene chiusura immediata per 300ms dopo apertura
    this.panelJustOpened = true;
    setTimeout(() => {
      this.panelJustOpened = false;
    }, 300);
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
    // Rimuovi gli event listener globali
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
    if (this.documentKeydownHandler) {
      document.removeEventListener('keydown', this.documentKeydownHandler);
      this.documentKeydownHandler = null;
    }

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

