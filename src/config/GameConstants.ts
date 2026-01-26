/**
 * Costanti di gioco centralizzate
 * Elimina valori hardcoded sparsi nel codice
 * Single source of truth per tutte le costanti di gioco
 */

import PLAYER_CONFIG from '../../shared/player-config.json';

export const PROJECTILE = {
  SPEED: 1000,                    // Velocità proiettili normali (px/s)
  VISUAL_SPEED: 500,                // Velocità proiettili visivi (px/s) - ora più veloce del player per colpire in movimento
  LIFETIME: 3000,               // Durata proiettili (ms)
  SPAWN_OFFSET: 25,             // Offset spawn dalla nave (px)
  HIT_RADIUS: 30,                // Raggio collisione (px)
  MISSILE_SPEED: 300            // Velocità missili (px/s) - aumentata da 250
} as const;

// Missile constants removed - missiles are no longer supported

export const COMBAT = {
  NPC_MIN_COOLDOWN: 500,        // Cooldown minimo NPC (ms)
  DAMAGE_TIMEOUT: 10000,        // Timeout danno NPC (ms)
  PLAYER_DAMAGE_COOLDOWN: PLAYER_CONFIG.stats.cooldown, // Cooldown danno effettivo player (ms) - da PLAYER_CONFIG
  PLAYER_LASER_VISUAL_INTERVAL: 350 // Intervallo laser visivi player (ms) - effetto più responsivo
} as const;

export const NETWORK = {
  INTEREST_RADIUS: 5000,        // Raggio interesse broadcasting (sincronizzato con server)
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
 * Configurazione playtest (disabilita log verbose per produzione)
 */
export const PLAYTEST_CONFIG = {
  ENABLE_VERBOSE_LOGGING: false, // Disabilitato per playtest
  ENABLE_DEBUG_UI: false,
  ENABLE_PERFORMANCE_LOGGING: false,
  ENABLE_DEBUG_MESSAGES: false // Disabilita tutti i messaggi [DEBUG_*] per playtest
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
