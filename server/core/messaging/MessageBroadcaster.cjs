// MessageBroadcaster - Utility per formattare e inviare messaggi
// Responsabilità: Formattazione messaggi, helper per broadcasting
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');

/**
 * Utility per formattare e gestire messaggi di broadcast
 * TODO: Valutare se necessario o se può essere parte di WebSocketConnectionManager
 * 
 * Nota: Il broadcasting effettivo è già delegato a mapServer.broadcastToMap()
 * e mapServer.broadcastNear(), quindi questo modulo potrebbe contenere solo
 * utility per formattare messaggi specifici.
 */
class MessageBroadcaster {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Formatta messaggio welcome per nuovo player
   * @param {Object} playerData - Dati del player
   * @param {string} nickname - Nickname del player
   * @param {Function} calculateMaxHealth - Funzione per calcolare max health
   * @param {Function} calculateMaxShield - Funzione per calcolare max shield
   * @returns {Object} Welcome message object
   */
  formatWelcomeMessage(playerData, nickname, calculateMaxHealth, calculateMaxShield) {
    return {
      type: 'welcome',
      clientId: playerData.clientId,
      playerId: playerData.userId, // UUID dell'utente (auth_id)
      playerDbId: playerData.playerId, // Player ID numerico per display/HUD
      message: `Welcome ${nickname}! Connected to server.`,
      initialState: {
        // Solo dati critici per iniziare il gioco
        position: {
          x: playerData.position?.x || 0,
          y: playerData.position?.y || 0,
          rotation: playerData.position?.rotation || 0
        },
        // I dati dettagliati verranno richiesti dal client dopo l'inizializzazione
        inventoryLazy: true,  // Flag per indicare lazy loading
        upgradesLazy: true,
        questsLazy: true,
        // Dati essenziali calcolati server-side
        health: calculateMaxHealth(playerData.upgrades.hpUpgrades),
        maxHealth: calculateMaxHealth(playerData.upgrades.hpUpgrades),
        shield: calculateMaxShield(playerData.upgrades.shieldUpgrades),
        maxShield: calculateMaxShield(playerData.upgrades.shieldUpgrades)
      }
    };
  }

  /**
   * Formatta messaggio initial_npcs per nuovo player
   * @param {Array} npcs - Array di NPC
   * @returns {Object} Initial NPCs message
   */
  formatInitialNpcsMessage(npcs) {
    return {
      type: 'initial_npcs',
      npcs: npcs.map(npc => ({
        id: npc.id,
        type: npc.type,
        position: npc.position,
        health: { current: npc.health, max: npc.maxHealth },
        shield: { current: npc.shield, max: npc.maxShield },
        behavior: npc.behavior
      })),
      timestamp: Date.now()
    };
  }

  /**
   * Formatta messaggio player_joined
   * @param {string} clientId - Client ID
   * @param {string} nickname - Nickname
   * @param {number} playerId - Player ID numerico
   * @returns {Object} Player joined message
   */
  formatPlayerJoinedMessage(clientId, nickname, playerId) {
    return {
      type: 'player_joined',
      clientId: clientId,
      nickname: nickname,
      playerId: playerId
    };
  }

  /**
   * Formatta messaggio player_left
   * @param {string} clientId - Client ID
   * @returns {Object} Player left message
   */
  formatPlayerLeftMessage(clientId) {
    return {
      type: 'player_left',
      clientId: clientId
    };
  }

  /**
   * Formatta messaggio combat_update
   * @param {string} playerId - Player ID (auth_id)
   * @param {string|null} npcId - NPC ID o null
   * @param {boolean} isAttacking - Se il player sta attaccando
   * @returns {Object} Combat update message
   */
  formatCombatUpdateMessage(playerId, npcId, isAttacking) {
    return {
      type: 'combat_update',
      playerId: playerId,
      npcId: npcId,
      isAttacking: isAttacking,
      lastAttackTime: Date.now()
    };
  }

  /**
   * Formatta messaggio chat_message
   * @param {string} clientId - Client ID (WebSocket connection)
   * @param {string} senderName - Nome del mittente
   * @param {string} content - Contenuto del messaggio
   * @param {number} timestamp - Timestamp (opzionale)
   * @param {number} playerId - Player ID (database ID, opzionale)
   * @returns {Object} Chat message
   */
  formatChatMessage(clientId, senderName, content, timestamp = null, playerId = null) {
    return {
      type: 'chat_message',
      clientId: clientId,
      senderName: senderName,
      content: content,
      timestamp: timestamp || Date.now(),
      playerId: playerId || null
    };
  }

  /**
   * Formatta messaggio leaderboard_response
   * @param {Array} entries - Array di entry leaderboard
   * @param {string} sortBy - Campo di ordinamento
   * @param {number|undefined} playerRank - Rank del player corrente
   * @returns {Object} Leaderboard response
   */
  formatLeaderboardResponse(entries, sortBy, playerRank) {
    return {
      type: 'leaderboard_response',
      entries: entries,
      sortBy: sortBy,
      playerRank: playerRank
    };
  }

  /**
   * Formatta messaggio player_data_response
   * @param {string} playerId - Player ID (auth_id)
   * @param {Object} inventory - Inventory data
   * @param {Object} upgrades - Upgrades data
   * @param {Array} quests - Quests array
   * @param {number} recentHonor - Recent honor value
   * @param {boolean} isAdministrator - Admin status
   * @returns {Object} Player data response
   */
  formatPlayerDataResponse(playerId, inventory, upgrades, quests, recentHonor, isAdministrator = false) {
    return {
      type: 'player_data_response',
      playerId: playerId,
      inventory: inventory,
      upgrades: upgrades,
      quests: quests || [],
      recentHonor: recentHonor,
      isAdministrator: isAdministrator,
      timestamp: Date.now()
    };
  }
}

module.exports = MessageBroadcaster;
