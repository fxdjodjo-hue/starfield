/**
 * Costanti server centralizzate
 * Elimina valori hardcoded sparsi nel server
 */

// Combat constants
const SERVER_CONSTANTS = {
  PROJECTILE: {
    SPEED: 400,
    LIFETIME: 3000,
    SPAWN_OFFSET: 25,
    HIT_RADIUS: 15
  },

  COMBAT: {
    PLAYER_RANGE: 300,
    NPC_MIN_COOLDOWN: 500
  },

  NETWORK: {
    INTEREST_RADIUS: 1500,
    WORLD_RADIUS: 15000
  },

  TIMEOUTS: {
    DAMAGE_TIMEOUT: 10000
  }
};

module.exports = SERVER_CONSTANTS;
