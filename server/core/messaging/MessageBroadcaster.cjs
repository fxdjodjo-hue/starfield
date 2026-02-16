// MessageBroadcaster - Utility per formattare e inviare messaggi
// Responsabilità: Formattazione messaggi, helper per broadcasting
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');
const { DEFAULT_PLAYER_SHIP_SKIN_ID } = require('../../config/ShipSkinCatalog.cjs');

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
   * @param {boolean} isAdministrator - Status di amministratore
   * @returns {Object} Welcome message object
   */
  formatWelcomeMessage(playerData, nickname, calculateMaxHealth, calculateMaxShield, isAdministrator = false, mapId = 'palantir') {
    return {
      type: 'welcome',
      clientId: playerData.clientId,
      playerId: playerData.userId, // UUID dell'utente (auth_id)
      playerDbId: playerData.playerId, // Player ID numerico per display/HUD
      mapId: mapId, // Aggiunto per permettere al client di inizializzare la mappa corretta
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
        // Dati essenziali: valori attuali salvati nel database
        health: playerData.health,
        maxHealth: playerData.maxHealth,
        shield: playerData.shield,
        maxShield: playerData.maxShield,
        // RecentHonor calcolato dal server (non lazy perché serve per il ranking)
        recentHonor: playerData.recentHonor || 0,
        isAdministrator: isAdministrator,
        rank: playerData.rank || 'Basic Space Pilot',
        leaderboardPodiumRank: Number(playerData.leaderboardPodiumRank || 0),
        shipSkins: {
          selectedSkinId: playerData.shipSkins?.selectedSkinId || DEFAULT_PLAYER_SHIP_SKIN_ID,
          unlockedSkinIds: Array.isArray(playerData.shipSkins?.unlockedSkinIds)
            ? playerData.shipSkins.unlockedSkinIds
            : [DEFAULT_PLAYER_SHIP_SKIN_ID]
        }
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
      // FORMATO COMPATTO: [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behavior_char]
      n: npcs.map(npc => [
        npc.id,
        npc.type,
        Math.round(npc.position.x),
        Math.round(npc.position.y),
        parseFloat(npc.position.rotation.toFixed(2)),
        Math.round(npc.health),
        Math.round(npc.maxHealth),
        Math.round(npc.shield),
        Math.round(npc.maxShield),
        npc.behavior ? npc.behavior[0] : 'c'
      ]),
      t: Date.now()
    };
  }

  /**
   * Formatta messaggio player_joined
   * @param {string} clientId - Client ID
   * @param {string} nickname - Nickname
   * @param {number} playerId - Player ID numerico
   * @param {string} rank - Player rank name
   * @param {number} leaderboardPodiumRank - Posizione podium leaderboard (1-3, altrimenti 0)
   * @param {Object} position - Player position (x, y, rotation, velocityX, velocityY)
   * @param {number} health - Current health
   * @param {number} maxHealth - Max health
   * @param {number} shield - Current shield
   * @param {number} maxShield - Max shield
   * @param {string} shipSkinId - Selected ship skin ID
   * @returns {Object} Player joined message
   */
  formatPlayerJoinedMessage(clientId, nickname, playerId, rank, leaderboardPodiumRank, position, health, maxHealth, shield, maxShield, shipSkinId) {
    return {
      type: 'player_joined',
      clientId: clientId,
      nickname: nickname,
      playerId: playerId,
      rank: rank || 'Basic Space Pilot',
      leaderboardPodiumRank: Number(leaderboardPodiumRank || 0),
      position: position,
      health: health,
      maxHealth: maxHealth,
      shield: shield,
      maxShield: maxShield,
      shipSkinId: shipSkinId || DEFAULT_PLAYER_SHIP_SKIN_ID,
      t: Date.now()
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
   * @param {string} clientId - Client ID (per identificazione univoca nel client)
   * @param {string|null} sessionId - ID univoco della sessione di combattimento
   * @returns {Object} Combat update message
   */
  formatCombatUpdateMessage(playerId, npcId, isAttacking, clientId, sessionId = null) {
    return {
      type: 'combat_update',
      playerId: playerId,
      npcId: npcId,
      isAttacking: isAttacking,
      clientId: clientId, // Aggiunto per permettere al client di trovare l'entità RemotePlayer
      sessionId: sessionId, // ID univoco per tracciare la sessione
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
   * @param {boolean} isAdministrator - Admin status (opzionale)
   * @returns {Object} Chat message
   */
  formatChatMessage(clientId, senderName, content, timestamp = null, playerId = null, isAdministrator = false) {
    return {
      type: 'chat_message',
      clientId: clientId,
      senderName: senderName,
      content: content,
      timestamp: timestamp || Date.now(),
      playerId: playerId || null,
      isAdministrator: isAdministrator || false
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
   * @param {string} rank - Player rank name
   * @param {Array} items - Inventory items array
   * @returns {Object} Player data response
   */
  formatPlayerDataResponse(playerId, inventory, upgrades, quests, recentHonor, isAdministrator = false, rank = 'Basic Space Pilot', items = [], shipSkins = null) {
    return {
      type: 'player_data_response',
      playerId: playerId,
      inventory: inventory,
      upgrades: upgrades,
      quests: quests || [],
      items: items || [],
      recentHonor: recentHonor,
      isAdministrator: isAdministrator,
      rank: rank || 'Basic Space Pilot',
      shipSkins: shipSkins || {
        selectedSkinId: DEFAULT_PLAYER_SHIP_SKIN_ID,
        unlockedSkinIds: [DEFAULT_PLAYER_SHIP_SKIN_ID]
      },
      timestamp: Date.now()
    };
  }
}

module.exports = MessageBroadcaster;
