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
  BACKGROUND_COLOR: '#000000',
  STAR_COLORS: ['#ffffff', '#ffe4b5', '#87ceeb', '#ffa500'],

  // Debug flags
  DEBUG_MODE: false,
  SHOW_FPS: false,
  SHOW_COLLISION_BOXES: false,

  // Parametri di gioco
  NPC_COUNT: 50,
  PROJECTILE_SPEED: 500,
  MAX_HEALTH: 100,

  // Sistema respawn NPC
  NPC_RESPAWN_DELAY: 10000, // 10 secondi dopo la morte
  NPC_RESPAWN_DISTANCE_MIN: 800, // Distanza minima dal player
  NPC_RESPAWN_DISTANCE_MAX: 2000, // Distanza massima dal player
  NPC_RESPAWN_ANGLE_VARIATION: Math.PI * 0.5, // ±90 gradi variazione

  // Dimensioni minimappa
  MINIMAP_WIDTH: 320,
  MINIMAP_HEIGHT: 200,

  // Layer parallasse
  PARALLAX_LAYERS: 5,
  PARALLAX_SPEED_MULTIPLIER: 0.8,
} as const;
