/**
 * Costanti server centralizzate
 * Include costanti di gioco e configurazione NPC
 */

// Carica configurazione player condivisa (single source of truth)
const playerConfig = require('../../shared/player-config.json');

const SERVER_TPS = 20;

// Combat constants
const SERVER_CONSTANTS = {
  LOOP: {
    TPS: SERVER_TPS,
    TICK_DELTA_MS: 1000 / SERVER_TPS
  },

  PROJECTILE: {
    SPEED: 1000,     // Velocità proiettili player
    NPC_SPEED: 800, // Velocità proiettili NPC (deve essere > player speed per raggiungerlo)
    LIFETIME: 3000, // Durata proiettili (ms)
    HIT_RADIUS: 15, // Raggio collisione (px)
    SPAWN_OFFSET: 50, // Offset spawn per evitare auto-collisione (px)
    MISSILE_SPEED: 500 // Velocità missili (leggermente aumentata da 250)
  },

  COMBAT: {
    PLAYER_RANGE_WIDTH: playerConfig.stats.rangeWidth || (playerConfig.stats.range * 2),
    PLAYER_RANGE_HEIGHT: playerConfig.stats.rangeHeight || (playerConfig.stats.range * 2),
    NPC_MIN_COOLDOWN: 500
  },

  NETWORK: {
    INTEREST_RADIUS: 1500,
    WORLD_RADIUS: 15000
  },

  TIMEOUTS: {
    DAMAGE_TIMEOUT: 10000
  },

  REPAIR: {
    START_DELAY: 5000,      // 5 secondi fuori dal combattimento
    PERCENT: 0.1,           // 10% HP/shield ogni applicazione
    INTERVAL: 2000          // Ogni 2 secondi
  },

  NPC_REPAIR: {
    START_DELAY: 10000,     // 10 secondi fuori dal combattimento
    PERCENT: 0.1,           // 10% HP/shield ogni applicazione
    INTERVAL: 2000          // Ogni 2 secondi (sincronizzato con player)
  },

  SAFE_ZONES: [
    {
      name: 'Space Station',
      x: 0,
      y: 0,
      radius: 800 // Raggio della zona sicura attorno alla stazione
    }
  ]
};

// Configurazione NPC caricata da file condiviso (single source of truth)
// Le ricompense (Credits, Cosmos, XP, Honor) vengono prese direttamente dai file di configurazione
const npcConfigData = require('../../shared/npc-config.json');
const NPC_CONFIG = {};

for (const [npcType, npcData] of Object.entries(npcConfigData)) {
  NPC_CONFIG[npcType] = {
    ...npcData,
    rewards: {
      ...npcData.rewards
    }
  };
}

module.exports = {
  SERVER_CONSTANTS,
  NPC_CONFIG
};
