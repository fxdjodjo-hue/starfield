// NpcRewardSystem - Sistema ricompense e notifiche
// Responsabilità: Assegnazione ricompense, notifiche client
// Dipendenze: logger, NPC_CONFIG, mapServer.players, mapServer.websocketManager

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const CrashReporter = require('../../core/infrastructure/CrashReporter.cjs');
const { NPC_CONFIG } = require('../../config/constants.cjs');

function toNonNegativeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

const RECENT_KILL_OPS_LIMIT = Number(process.env.KILL_OP_DEDUPE_BUFFER_SIZE || 300);

function ensureKillOpsState(playerData) {
  if (!playerData._recentKillOps || !Array.isArray(playerData._recentKillOps.order)) {
    playerData._recentKillOps = {
      order: [],
      seen: Object.create(null)
    };
  }
  return playerData._recentKillOps;
}

function hasKillOp(playerData, killOpId) {
  if (!killOpId) return false;
  const state = ensureKillOpsState(playerData);
  return state.seen[killOpId] === true;
}

function rememberKillOp(playerData, killOpId) {
  if (!killOpId) return;
  const state = ensureKillOpsState(playerData);
  if (state.seen[killOpId] === true) return;

  state.order.push(killOpId);
  state.seen[killOpId] = true;

  while (state.order.length > RECENT_KILL_OPS_LIMIT) {
    const oldest = state.order.shift();
    if (oldest) {
      delete state.seen[oldest];
    }
  }
}

class NpcRewardSystem {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Assegna ricompense al giocatore che ha ucciso un NPC
   * @param {string} playerId - ID del player
   * @param {string} npcType - Tipo di NPC ucciso
   * @param {Object} options - metadata evento kill
   */
  awardNpcKillRewards(playerId, npcType, options = {}) {
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

    const rewardFields = ['credits', 'cosmos', 'experience', 'honor'];
    for (const field of rewardFields) {
      const value = Number(rewards[field] || 0);
      if (!Number.isFinite(value) || value < 0) {
        ServerLoggerWrapper.error('REWARDS', `Invalid reward field ${field}=${rewards[field]} for npcType=${npcType}`);
        return;
      }
    }

    const killOpId = options.killOpId || `${playerId}:${npcType}:${Date.now()}`;
    const npcId = options.npcId || null;

    if (hasKillOp(playerData, killOpId)) {
      ServerLoggerWrapper.warn('REWARDS', `Duplicate kill reward suppressed for player=${playerId} killOpId=${killOpId}`);
      CrashReporter.recordEventForClient(playerId, 'loot_duplicate_suppressed', {
        killOpId,
        npcId,
        npcType
      });
      return;
    }
    rememberKillOp(playerData, killOpId);

    // Aggiungi ricompense all'inventario del giocatore (assicurati che siano numeri)
    playerData.inventory.credits = Number(playerData.inventory.credits || 0) + (rewards.credits || 0);
    playerData.inventory.cosmos = Number(playerData.inventory.cosmos || 0) + (rewards.cosmos || 0);
    const oldExp = Number(playerData.inventory.experience || 0);
    const newExp = oldExp + (rewards.experience || 0);
    playerData.inventory.experience = newExp;
    const oldHonor = Number(playerData.inventory.honor || 0);
    const newHonor = oldHonor + (rewards.honor || 0);
    playerData.inventory.honor = newHonor;

    // Hardening transazioni: mai lasciare currency invalide o negative.
    playerData.inventory.credits = toNonNegativeNumber(playerData.inventory.credits);
    playerData.inventory.cosmos = toNonNegativeNumber(playerData.inventory.cosmos);
    playerData.inventory.experience = toNonNegativeNumber(playerData.inventory.experience);
    playerData.inventory.honor = toNonNegativeNumber(playerData.inventory.honor);

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

      // 🎲 SINGLE ROLL SYSTEM (Fair & Weighted)
      // Calculate probability segments for all potential drops
      const candidates = [];
      for (const itemId of npcPossibleDrops) {
        const itemDef = ITEM_REGISTRY[itemId];
        if (itemDef && itemDef.dropChance > 0) {
          candidates.push({
            id: itemId,
            chance: itemDef.dropChance,
            def: itemDef
          });
        }
      }

      // Shuffle candidates to ensure fairness if total probability > 100% (rare edge case)
      // preventing the same items from always being "cut off" at the end of the 0-1 range
      candidates.sort(() => Math.random() - 0.5);

      // Single Roll (0.0 to 1.0)
      const roll = Math.random();
      let cumulative = 0;

      for (const candidate of candidates) {
        // Define the winning window for this item
        // [cumulative, cumulative + chance)
        if (roll >= cumulative && roll < cumulative + candidate.chance) {
          // WINNER!
          const itemDef = candidate.def;
          const dropChance = candidate.chance;
          const itemId = candidate.id;

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

          // Only one drop per roll (implicit by loop break)
          break;
        }

        // Move window forward
        cumulative += candidate.chance;
      }
    }

    // Persist changes immediately to prevent data loss (items, currencies)
    const websocketManager = this.mapServer.websocketManager;
    if (websocketManager && typeof websocketManager.savePlayerData === 'function') {
      websocketManager.savePlayerData(playerData, { reason: `npc_reward:${killOpId}` }).catch(err => {
        ServerLoggerWrapper.error('REWARDS', `Immediate save failed for ${playerId}: ${err.message}`);
      });
    }

    ServerLoggerWrapper.info('REWARDS', `Player ${playerId} awarded: ${rewards.credits} credits, ${rewards.cosmos} cosmos, ${rewards.experience} XP, ${rewards.honor} honor`);

    // Invia notifica delle ricompense al client
    const finalRewards = {
      ...rewards,
      droppedItems: droppedItems,
      killOpId,
      npcId
    };

    CrashReporter.recordEventForClient(playerId, 'loot', {
      killOpId,
      npcId,
      npcType,
      rewards: {
        credits: rewards.credits || 0,
        cosmos: rewards.cosmos || 0,
        experience: rewards.experience || 0,
        honor: rewards.honor || 0
      },
      droppedItems: droppedItems.map(item => item.id)
    });

    // Invia notifica delle ricompense al client
    this.sendRewardsNotification(playerId, finalRewards, npcType, {
      killOpId,
      npcId
    });

    // QUEST HOOK: Notify QuestManager about the kill
    if (this.mapServer.questManager) {
      this.mapServer.questManager.onNpcKilled(playerId, npcType).catch(err => {
        ServerLoggerWrapper.error('QUEST', `Error updating quest progress for ${playerId}: ${err.message}`);
      });
    }
  }

  /**
   * Invia notifica delle ricompense al client
   * @param {string} playerId - ID del player
   * @param {Object} rewards - Oggetto ricompense
   * @param {string} npcType - Tipo di NPC ucciso
   * @param {Object} metadata - metadata idempotenza reward
   */
  sendRewardsNotification(playerId, rewards, npcType, metadata = {}) {
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
        npcType: npcType,
        killOpId: metadata.killOpId || rewards.killOpId || null,
        npcId: metadata.npcId || rewards.npcId || null
      }
    };

    playerData.ws.send(JSON.stringify(message));
  }
}

module.exports = NpcRewardSystem;
