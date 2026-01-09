/**
 * Costanti di gioco centralizzate
 * Elimina valori hardcoded sparsi nel codice
 */

export const PROJECTILE = {
  SPEED: 400,                    // Velocità proiettili (px/s)
  LIFETIME: 3000,               // Durata proiettili (ms)
  SPAWN_OFFSET: 25,             // Offset spawn dalla nave (px)
  HIT_RADIUS: 15                // Raggio collisione (px)
} as const;

export const COMBAT = {
  PLAYER_RANGE: 600,            // Range attacco player (px)
  PLAYER_COOLDOWN: 1000,        // Cooldown attacco player (ms) - NON UTILIZZATO, vedi player-config.json
  NPC_MIN_COOLDOWN: 500,        // Cooldown minimo NPC (ms)
  DAMAGE_TIMEOUT: 10000         // Timeout danno NPC (ms)
} as const;

export const NETWORK = {
  INTEREST_RADIUS: 1500,        // Raggio interesse broadcasting
  BROADCAST_INTERVAL: 100       // Intervallo broadcast (ms)
} as const;

export const PHYSICS = {
  FIXED_DELTA_TIME: 1000 / 60,  // 16.67ms per frame
  MAX_DELTA_TIME: 1000 / 30     // Limite massimo delta time
} as const;

export const UI = {
  LOG_INTERVAL: 30000,          // Intervallo logging periodico (ms)
  DAMAGE_TEXT_DURATION: 3000,   // Durata testi danno (ms)
  EXPLOSION_DURATION: 1000      // Durata esplosioni (ms)
} as const;

/**
 * Oggetto principale contenente tutte le costanti di gioco
 */
export const GAME_CONSTANTS = {
  PROJECTILE,
  COMBAT,
  NETWORK,
  PHYSICS,
  UI
} as const;
