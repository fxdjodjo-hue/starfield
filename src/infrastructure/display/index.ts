/**
 * Display Module - Export pubblico
 * 
 * Fornisce gestione centralizzata di DPI, viewport e scaling
 * per supportare correttamente display HiDPI e responsive design
 */

export { DisplayManager } from './DisplayManager';

// Export tipi
export type {
  DisplayInfo,
  ViewportSize,
  ResizeCallback,
  CanvasSetupOptions,
  CSSVariableName,
} from './DisplayConfig';

// Export costanti (valori runtime)
export {
  DISPLAY_CONSTANTS,
  CSS_VARIABLES,
} from './DisplayConfig';
