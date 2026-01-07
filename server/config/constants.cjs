/**
 * Costanti server centralizzate
 * Include costanti di gioco e configurazione NPC
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

// Configurazione NPC integrata
const NPC_CONFIG = {
  Scouter: {
    type: "Scouter",
    defaultBehavior: "cruise",
    stats: {
      health: 800,
      shield: 400,
      damage: 20,
      range: 300,
      cooldown: 1200,
      speed: 250
    },
    rewards: {
      credits: 400,
      cosmos: 1,
      experience: 400,
      honor: 2,
      skillPoints: 0 // Base reward, random drop will add more
    },
    description: "Nemico base dello spazio profondo"
  },
  Frigate: {
    type: "Frigate",
    defaultBehavior: "cruise",
    stats: {
      health: 2000,
      shield: 2000,
      damage: 80,
      range: 300,
      cooldown: 1500,
      speed: 200
    },
    rewards: {
      credits: 800,
      cosmos: 2,
      experience: 800,
      honor: 4,
      skillPoints: 0 // Base reward, random drop will add more
    },
    description: "Nave da guerra di medie dimensioni"
  }
};

module.exports = {
  SERVER_CONSTANTS,
  NPC_CONFIG
};
