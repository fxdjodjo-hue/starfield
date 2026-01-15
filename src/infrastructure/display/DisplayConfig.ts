/**
 * DisplayConfig - Configurazione centralizzata per il sistema di display
 * Definisce costanti, tipi e valori di default per la gestione DPI/viewport
 */

/**
 * Dimensioni viewport in pixel logici (CSS pixels)
 */
export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Informazioni complete sul display corrente
 */
export interface DisplayInfo {
  /** Device Pixel Ratio corrente */
  dpr: number;
  /** Dimensioni logiche (CSS pixels) */
  logical: ViewportSize;
  /** Dimensioni fisiche (device pixels) */
  physical: ViewportSize;
}

/**
 * Callback per eventi di resize
 */
export type ResizeCallback = (info: DisplayInfo) => void;

/**
 * Opzioni per la configurazione del canvas
 */
export interface CanvasSetupOptions {
  /** Se true, applica stili CSS per fullscreen */
  fullscreen?: boolean;
  /** Colore di background del canvas */
  backgroundColor?: string;
}

/**
 * Costanti di configurazione del display
 */
export const DISPLAY_CONSTANTS = {
  /** Unità base in pixel logici per spacing/sizing */
  BASE_UNIT: 8,
  
  /** Dimensione default icone UI */
  ICON_SIZE: 48,
  
  /** Padding standard pannelli */
  PANEL_PADDING: 20,
  
  /** Margine standard dal bordo schermo */
  SCREEN_MARGIN: 20,
  
  /** Border radius standard per elementi glass */
  BORDER_RADIUS_SM: 12,
  BORDER_RADIUS_MD: 20,
  BORDER_RADIUS_LG: 25,
  
  /** Breakpoints per responsive design (in pixel logici) */
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    XXL: 1536,
  },
  
  /** DPR minimo e massimo supportati */
  MIN_DPR: 1,
  MAX_DPR: 3,
  
  /** Debounce time per resize events (ms) */
  RESIZE_DEBOUNCE_MS: 100,
} as const;

/**
 * Nomi delle CSS custom properties iniettate
 */
export const CSS_VARIABLES = {
  DPR: '--display-dpr',
  BASE_UNIT: '--display-base-unit',
  ICON_SIZE: '--display-icon-size',
  PANEL_PADDING: '--display-panel-padding',
  SCREEN_MARGIN: '--display-screen-margin',
  VIEWPORT_WIDTH: '--display-viewport-width',
  VIEWPORT_HEIGHT: '--display-viewport-height',
  SCALE_FACTOR: '--display-scale-factor',
} as const;

/**
 * Tipo per i nomi delle CSS variables
 */
export type CSSVariableName = typeof CSS_VARIABLES[keyof typeof CSS_VARIABLES];
