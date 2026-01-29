// NpcRewardSystem - Sistema ricompense e notifiche
// Responsabilità: Assegnazione ricompense, notifiche client
// Dipendenze: logger, NPC_CONFIG, mapServer.players, mapServer.websocketManager

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const { NPC_CONFIG } = require('../../config/constants.cjs');

class NpcRewardSystem {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Assegna ricompense al giocatore che ha ucciso un NPC
   * @param {string} playerId - ID del player
   * @param {string} npcType - Tipo di NPC ucciso
   */
  awardNpcKillRewards(playerId, npcType) {
    const playerData = this.mapServer.players.get(playerId);
    if (!playerData) {
      logger.warn('REWARDS', `Cannot award rewards to unknown player: ${playerId}`);
      return;
    }

    const rewards = NPC_CONFIG[npcType]?.rewards;
    if (!rewards) {
      logger.warn('REWARDS', `No rewards defined for NPC type: ${npcType}`);
      return;
    }

    // Aggiungi ricompense all'inventario del giocatore (assicurati che siano numeri)
    playerData.inventory.credits = Number(playerData.inventory.credits || 0) + (rewards.credits || 0);
    playerData.inventory.cosmos = Number(playerData.inventory.cosmos || 0) + (rewards.cosmos || 0);
    const oldExp = Number(playerData.inventory.experience || 0);
    const newExp = oldExp + (rewards.experience || 0);
    playerData.inventory.experience = newExp;
    const oldHonor = Number(playerData.inventory.honor || 0);
    const newHonor = oldHonor + (rewards.honor || 0);
    playerData.inventory.honor = newHonor;

    // Salva snapshot honor se è cambiato (non bloccante)
    if (rewards.honor && rewards.honor !== 0) {
      const websocketManager = this.mapServer.websocketManager;
      if (websocketManager && typeof websocketManager.saveHonorSnapshot === 'function') {
        // Chiama in modo asincrono senza bloccare
        websocketManager.saveHonorSnapshot(playerData.userId, newHonor, 'npc_kill').catch(err => {
          // Ignora errori, non blocca il flusso
        });
      }
    }

    // 🚀 Item-Based Drops (Autoritativo)
    const droppedItems = [];
    const npcPossibleDrops = NPC_CONFIG[npcType]?.possibleDrops || [];

    if (npcPossibleDrops.length > 0) {
      const itemConfig = require('../../../shared/item-config.json');
      const ITEM_REGISTRY = itemConfig.ITEM_REGISTRY;

      // Shuffle candidates to give each item a fair chance despite the "one item limit"
      const shuffledDrops = [...npcPossibleDrops].sort(() => Math.random() - 0.5);

      for (const itemId of shuffledDrops) {
        const itemDef = ITEM_REGISTRY[itemId];
        if (!itemDef) continue;

        // Probabilità basata solo sull'item
        const dropChance = itemDef.dropChance || 0;

        if (Math.random() < dropChance) {
          const instanceId = Math.random().toString(36).substring(2, 9);
          const newItem = {
            id: itemId,
            instanceId,
            acquiredAt: Date.now(),
            slot: null
          };

          if (!playerData.items) playerData.items = [];
          playerData.items.push(newItem);
          droppedItems.push(newItem);

          ServerLoggerWrapper.info('REWARDS', `Player ${playerId} dropped ${itemDef.rarity} item: ${itemId} (${instanceId}) [Rate: ${dropChance.toFixed(4)}]`);

          // 🛑 LIMIT: Max one item per NPC
          break;
        }
      }
    }

    // Persist changes immediately to prevent data loss (items, currencies)
    const websocketManager = this.mapServer.websocketManager;
    if (websocketManager && typeof websocketManager.savePlayerData === 'function') {
      websocketManager.savePlayerData(playerData).catch(err => {
        ServerLoggerWrapper.error('REWARDS', `Immediate save failed for ${playerId}: ${err.message}`);
      });
    }

    ServerLoggerWrapper.info('REWARDS', `Player ${playerId} awarded: ${rewards.credits} credits, ${rewards.cosmos} cosmos, ${rewards.experience} XP, ${rewards.honor} honor`);

    // Invia notifica delle ricompense al client
    const finalRewards = {
      ...rewards,
      droppedItems: droppedItems
    };

    // Invia notifica delle ricompense al client
    this.sendRewardsNotification(playerId, finalRewards, npcType);
  }

  /**
   * Invia notifica delle ricompense al client
   * @param {string} playerId - ID del player
   * @param {Object} rewards - Oggetto ricompense
   * @param {string} npcType - Tipo di NPC ucciso
   */
  sendRewardsNotification(playerId, rewards, npcType) {
    const playerData = this.mapServer.players.get(playerId);
    if (!playerData || playerData.ws.readyState !== 1) return; // WebSocket.OPEN = 1

    // Usa RecentHonor cached se disponibile, altrimenti usa honor corrente
    // RecentHonor verrà aggiornato in background per il prossimo messaggio
    const recentHonor = playerData.recentHonor !== undefined ? playerData.recentHonor : playerData.inventory.honor || 0;

    // Aggiorna RecentHonor in background per il prossimo messaggio (non blocca)
    const websocketManager = this.mapServer.websocketManager;
    if (websocketManager && typeof websocketManager.getRecentHonorAverage === 'function') {
      websocketManager.getRecentHonorAverage(playerData.userId, 30).then(avg => {
        playerData.recentHonor = avg;
      }).catch(err => {
        // Ignora errori, mantiene valore cached
      });
    }

    const message = {
      type: 'player_state_update',
      inventory: { ...playerData.inventory },
      upgrades: { ...playerData.upgrades },
      items: playerData.items || [],
      recentHonor: recentHonor,
      source: `killed_${npcType}`,
      rewardsEarned: {
        ...rewards,
        npcType: npcType
      }
    };

    playerData.ws.send(JSON.stringify(message));
  }
}

module.exports = NpcRewardSystem;
