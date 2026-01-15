/**
 * DisplayManager - Sistema centralizzato per gestione DPI e viewport
 * 
 * Singleton che fornisce:
 * - Gestione corretta del devicePixelRatio
 * - Conversione tra pixel logici e fisici
 * - Setup automatico canvas per HiDPI
 * - CSS variables per UI responsive
 * - Event system per resize
 */

import type {
  DisplayInfo,
  ViewportSize,
  ResizeCallback,
  CanvasSetupOptions,
} from './DisplayConfig';
import {
  DISPLAY_CONSTANTS,
  CSS_VARIABLES,
} from './DisplayConfig';

export class DisplayManager {
  private static instance: DisplayManager | null = null;
  
  private currentDpr: number;
  private logicalSize: ViewportSize;
  private resizeCallbacks: Set<ResizeCallback>;
  private resizeTimeoutId: number | null;
  private mediaQueryList: MediaQueryList | null;
  private boundHandleResize: () => void;
  private boundHandleDprChange: () => void;
  private initialized: boolean;

  private constructor() {
    this.currentDpr = this.getSystemDpr();
    this.logicalSize = this.getWindowSize();
    this.resizeCallbacks = new Set();
    this.resizeTimeoutId = null;
    this.mediaQueryList = null;
    this.initialized = false;
    
    // Bind methods per event listeners
    this.boundHandleResize = this.handleResize.bind(this);
    this.boundHandleDprChange = this.handleDprChange.bind(this);
  }

  /**
   * Ottiene l'istanza singleton del DisplayManager
   */
  static getInstance(): DisplayManager {
    if (!DisplayManager.instance) {
      DisplayManager.instance = new DisplayManager();
    }
    return DisplayManager.instance;
  }

  /**
   * Inizializza il DisplayManager e attiva i listener
   * Chiamare una sola volta all'avvio dell'applicazione
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('DisplayManager già inizializzato');
      return;
    }

    // Listener per resize finestra
    window.addEventListener('resize', this.boundHandleResize);

    // Listener per cambio DPR (es. spostamento tra monitor)
    this.setupDprListener();

    // Inietta CSS variables iniziali
    this.updateCSSVariables();

    this.initialized = true;
  }

  /**
   * Configura listener per cambio devicePixelRatio
   */
  private setupDprListener(): void {
    // Usa matchMedia per rilevare cambi di DPR
    const dprQuery = `(resolution: ${this.currentDpr}dppx)`;
    this.mediaQueryList = window.matchMedia(dprQuery);
    this.mediaQueryList.addEventListener('change', this.boundHandleDprChange);
  }

  /**
   * Handler per cambio DPR
   */
  private handleDprChange(): void {
    const newDpr = this.getSystemDpr();
    if (newDpr !== this.currentDpr) {
      this.currentDpr = newDpr;
      
      // Ricrea listener per nuovo DPR
      if (this.mediaQueryList) {
        this.mediaQueryList.removeEventListener('change', this.boundHandleDprChange);
      }
      this.setupDprListener();
      
      // Notifica i subscriber
      this.notifyResizeCallbacks();
      this.updateCSSVariables();
    }
  }

  /**
   * Handler per resize finestra con debounce
   */
  private handleResize(): void {
    if (this.resizeTimeoutId !== null) {
      window.clearTimeout(this.resizeTimeoutId);
    }

    this.resizeTimeoutId = window.setTimeout(() => {
      this.logicalSize = this.getWindowSize();
      this.currentDpr = this.getSystemDpr();
      this.notifyResizeCallbacks();
      this.updateCSSVariables();
      this.resizeTimeoutId = null;
    }, DISPLAY_CONSTANTS.RESIZE_DEBOUNCE_MS);
  }

  /**
   * Notifica tutti i callback registrati
   */
  private notifyResizeCallbacks(): void {
    const info = this.getDisplayInfo();
    this.resizeCallbacks.forEach(callback => {
      try {
        callback(info);
      } catch (error) {
        console.error('Error in resize callback:', error);
      }
    });
  }

  /**
   * Aggiorna le CSS custom properties nel :root
   * Compensa il DPR di Windows per mantenere l'UI alla dimensione corretta
   */
  private updateCSSVariables(): void {
    const root = document.documentElement;
    const scaleFactor = this.getScaleFactor();
    
    // Fattore di compensazione per DPR di Windows
    // Quando Windows è al 125%, DPR = 1.25, quindi dividiamo per compensare
    const dprCompensation = 1 / this.currentDpr;

    root.style.setProperty(CSS_VARIABLES.DPR, this.currentDpr.toString());
    root.style.setProperty(CSS_VARIABLES.BASE_UNIT, `${DISPLAY_CONSTANTS.BASE_UNIT * dprCompensation}px`);
    root.style.setProperty(CSS_VARIABLES.ICON_SIZE, `${DISPLAY_CONSTANTS.ICON_SIZE * scaleFactor * dprCompensation}px`);
    root.style.setProperty(CSS_VARIABLES.PANEL_PADDING, `${DISPLAY_CONSTANTS.PANEL_PADDING * scaleFactor * dprCompensation}px`);
    root.style.setProperty(CSS_VARIABLES.SCREEN_MARGIN, `${DISPLAY_CONSTANTS.SCREEN_MARGIN * scaleFactor * dprCompensation}px`);
    root.style.setProperty(CSS_VARIABLES.VIEWPORT_WIDTH, this.logicalSize.width.toString());
    root.style.setProperty(CSS_VARIABLES.VIEWPORT_HEIGHT, this.logicalSize.height.toString());
    root.style.setProperty(CSS_VARIABLES.SCALE_FACTOR, (scaleFactor * dprCompensation).toString());
  }

  /**
   * Ottiene il DPR dal sistema, limitato ai valori supportati
   */
  private getSystemDpr(): number {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(
      Math.max(dpr, DISPLAY_CONSTANTS.MIN_DPR),
      DISPLAY_CONSTANTS.MAX_DPR
    );
  }

  /**
   * Ottiene le dimensioni correnti della finestra
   */
  private getWindowSize(): ViewportSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /**
   * Calcola un fattore di scala per UI responsive
   * Basato sulla viewport e DPR per adattare elementi UI
   */
  getScaleFactor(): number {
    // Scala base: 1.0 per viewport 1920x1080 con DPR 1
    const baseWidth = 1920;
    const widthRatio = this.logicalSize.width / baseWidth;
    
    // Limita il fattore di scala tra 0.7 e 1.3
    return Math.min(Math.max(widthRatio, 0.7), 1.3);
  }

  // ============== API PUBBLICA ==============

  /**
   * Restituisce il devicePixelRatio corrente
   */
  getDevicePixelRatio(): number {
    return this.currentDpr;
  }

  /**
   * Restituisce le dimensioni logiche (CSS pixels)
   */
  getLogicalSize(): ViewportSize {
    return { ...this.logicalSize };
  }

  /**
   * Restituisce le dimensioni fisiche (device pixels)
   */
  getPhysicalSize(): ViewportSize {
    return {
      width: Math.floor(this.logicalSize.width * this.currentDpr),
      height: Math.floor(this.logicalSize.height * this.currentDpr),
    };
  }

  /**
   * Restituisce tutte le informazioni sul display
   */
  getDisplayInfo(): DisplayInfo {
    return {
      dpr: this.currentDpr,
      logical: this.getLogicalSize(),
      physical: this.getPhysicalSize(),
    };
  }

  /**
   * Converte pixel logici in pixel fisici
   */
  toPhysical(logicalPixels: number): number {
    return logicalPixels * this.currentDpr;
  }

  /**
   * Converte pixel fisici in pixel logici
   */
  toLogical(physicalPixels: number): number {
    return physicalPixels / this.currentDpr;
  }

  /**
   * Configura un canvas per rendering HiDPI corretto
   * 
   * @param canvas - Il canvas da configurare
   * @param options - Opzioni di configurazione
   * @returns Il context 2D configurato
   */
  setupCanvas(
    canvas: HTMLCanvasElement,
    options: CanvasSetupOptions = {}
  ): CanvasRenderingContext2D {
    const { fullscreen = true, backgroundColor } = options;
    const dpr = this.currentDpr;
    const logical = this.logicalSize;

    // Imposta dimensioni fisiche del buffer
    canvas.width = Math.floor(logical.width * dpr);
    canvas.height = Math.floor(logical.height * dpr);

    // Imposta dimensioni CSS (logiche)
    if (fullscreen) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
    } else {
      canvas.style.width = `${logical.width}px`;
      canvas.style.height = `${logical.height}px`;
    }

    if (backgroundColor) {
      canvas.style.backgroundColor = backgroundColor;
    }

    // Ottieni e configura il context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossibile ottenere il contesto 2D del canvas');
    }

    // Scala il context per compensare il DPR
    ctx.scale(dpr, dpr);

    return ctx;
  }

  /**
   * Riscala un canvas esistente (utile dopo resize)
   * Preserva il context esistente
   */
  rescaleCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    const dpr = this.currentDpr;
    const logical = this.logicalSize;

    // Reset transform prima di ridimensionare
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Aggiorna dimensioni buffer
    canvas.width = Math.floor(logical.width * dpr);
    canvas.height = Math.floor(logical.height * dpr);

    // Riapplica scala DPR
    ctx.scale(dpr, dpr);
  }

  /**
   * Converte coordinate mouse da evento a coordinate logiche canvas
   * Usa questo per gestire correttamente input su canvas HiDPI
   */
  eventToCanvasCoords(
    event: MouseEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    
    // Le coordinate dell'evento sono già in pixel logici (CSS)
    // getBoundingClientRect restituisce dimensioni CSS
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    return { x, y };
  }

  /**
   * Registra un callback per eventi di resize/DPR change
   * @returns Funzione per rimuovere il callback
   */
  onResize(callback: ResizeCallback): () => void {
    this.resizeCallbacks.add(callback);
    return () => {
      this.resizeCallbacks.delete(callback);
    };
  }

  /**
   * Forza un aggiornamento manuale (utile per test o casi speciali)
   */
  forceUpdate(): void {
    this.logicalSize = this.getWindowSize();
    this.currentDpr = this.getSystemDpr();
    this.notifyResizeCallbacks();
    this.updateCSSVariables();
  }

  /**
   * Verifica se il display è considerato "small" (mobile/tablet)
   */
  isSmallScreen(): boolean {
    return this.logicalSize.width < DISPLAY_CONSTANTS.BREAKPOINTS.MD;
  }

  /**
   * Verifica se il display è HiDPI (retina)
   */
  isHiDPI(): boolean {
    return this.currentDpr > 1;
  }

  /**
   * Cleanup: rimuove tutti i listener e resetta lo stato
   */
  destroy(): void {
    window.removeEventListener('resize', this.boundHandleResize);
    
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener('change', this.boundHandleDprChange);
      this.mediaQueryList = null;
    }

    if (this.resizeTimeoutId !== null) {
      window.clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }

    this.resizeCallbacks.clear();
    this.initialized = false;
    DisplayManager.instance = null;
  }
}
