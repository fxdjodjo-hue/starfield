/**
 * Configurazioni globali del gioco Starfield
 */
export const CONFIG = {
  // Dimensioni canvas e mondo
  CANVAS_WIDTH: 1920,
  CANVAS_HEIGHT: 1080,
  WORLD_WIDTH: 21000,
  WORLD_HEIGHT: 13100,

  // Parametri di gioco (FPS, timing)
  TARGET_FPS: 60,
  FIXED_DELTA_TIME: 1000 / 60, // 16.67ms per frame fisso
  MAX_DELTA_TIME: 1000 / 30, // Limite massimo per evitare spirale della morte

  // Colori e temi visuali
  BACKGROUND_COLOR: '#000011',
  STAR_COLORS: ['#ffffff', '#ffe4b5', '#87ceeb', '#ffa500'],

  // Debug flags
  DEBUG_MODE: false,
  SHOW_FPS: false,
  SHOW_COLLISION_BOXES: false,

  // Parametri di gioco
  PLAYER_SPEED: 300,
  NPC_COUNT: 50,
  PROJECTILE_SPEED: 500,
  MAX_HEALTH: 100,

  // Layer parallasse
  PARALLAX_LAYERS: 5,
  PARALLAX_SPEED_MULTIPLIER: 0.8,
} as const;
