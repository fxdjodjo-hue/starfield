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

    ServerLoggerWrapper.info('REWARDS', `Player ${playerId} awarded: ${rewards.credits} credits, ${rewards.cosmos} cosmos, ${rewards.experience} XP, ${rewards.honor} honor`);

    // Invia notifica delle ricompense al client
    const finalRewards = {
      ...rewards
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
