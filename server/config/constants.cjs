/**
 * Costanti server centralizzate
 * Include costanti di gioco e configurazione NPC
 */

// Combat constants
const SERVER_CONSTANTS = {
  PROJECTILE: {
    SPEED: 1000,     // Velocità proiettili player
    NPC_SPEED: 800, // Velocità proiettili NPC (deve essere > player speed per raggiungerlo)
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
  },

  REPAIR: {
    START_DELAY: 10000,      // 10 secondi fuori dal combattimento
    AMOUNT: 10000,            // 10k HP/shield ogni applicazione
    INTERVAL: 2000            // Ogni 2 secondi
  }
};

// Configurazione NPC caricata da file condiviso (single source of truth)
// Aggiungi skillPoints: 0 a ogni NPC (non assegnano mai SkillPoints)
const npcConfigData = require('../../shared/npc-config.json');
const NPC_CONFIG = {};

for (const [npcType, npcData] of Object.entries(npcConfigData)) {
  NPC_CONFIG[npcType] = {
    ...npcData,
    rewards: {
      ...npcData.rewards,
      skillPoints: 0 // NPC non assegnano mai SkillPoints
    }
  };
}

module.exports = {
  SERVER_CONSTANTS,
  NPC_CONFIG
};
