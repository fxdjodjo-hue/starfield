/**
 * Costanti server centralizzate
 * Include costanti di gioco e configurazione NPC
 */

// Combat constants
const SERVER_CONSTANTS = {
  PROJECTILE: {
    SPEED: 400,     // Velocità proiettili player
    NPC_SPEED: 800, // Velocità proiettili NPC (più veloci per homing efficace)
    LIFETIME: 3000,
    HIT_RADIUS: 15,
    SPAWN_OFFSET: 50  // Offset spawn per evitare auto-collisione (px)
  },

  COMBAT: {
    PLAYER_START_RANGE: 600,  // Distanza per iniziare combattimento
    PLAYER_STOP_RANGE: 600,   // Distanza per fermare combattimento (senza isteresi)
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
      range: 600,
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
      range: 600,
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
