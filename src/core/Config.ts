/**
 * Configurazioni globali del gioco
 */
export const CONFIG = {
  // Dimensioni canvas (ora dinamiche - si adattano alla finestra)
  CANVAS_WIDTH: 800,  // Valore di default, verrà sovrascritto
  CANVAS_HEIGHT: 600, // Valore di default, verrà sovrascritto

  // Game loop
  TARGET_FPS: 60,
  FIXED_DELTA_TIME: 1000 / 60, // ~16.67ms

  // Rendering
  BACKGROUND_COLOR: '#000011',

  // World
  WORLD_WIDTH: 21000,
  WORLD_HEIGHT: 13100,


  // Debug
  DEBUG_MODE: false,
} as const;
