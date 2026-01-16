// WebSocketConnectionManager - Gestione connessioni e messaggi WebSocket
// REFACTORED: Ora usa moduli separati per responsabilità specifiche
// Dipendenze consentite: logger.cjs, messageCount, mapServer, wss

const { logger } = require('../logger.cjs');

// Import nuovi moduli refactorizzati
const WebSocketConnectionManagerCore = require('./connection/WebSocketConnectionManager.cjs');
const PlayerDataManager = require('./database/PlayerDataManager.cjs');
const MessageBroadcaster = require('./messaging/MessageBroadcaster.cjs');
const AuthenticationManager = require('./auth/AuthenticationManager.cjs');

/**
 * Wrapper che orchestra i moduli refactorizzati
 * Mantiene la stessa API pubblica per backward compatibility
 */
class WebSocketConnectionManager {
  constructor(wss, mapServer, messageCount) {
    // Crea istanze dei moduli refactorizzati
    this.playerDataManager = new PlayerDataManager(mapServer);
    this.authManager = new AuthenticationManager();
    this.messageBroadcaster = new MessageBroadcaster(mapServer);
    this.connectionManager = new WebSocketConnectionManagerCore(wss, mapServer, messageCount);

    // Inietta dipendenze nel connection manager
    this.connectionManager.setPlayerDataManager(this.playerDataManager);
    this.connectionManager.setAuthManager(this.authManager);
    this.connectionManager.setMessageBroadcaster(this.messageBroadcaster);

    // Setup usando i nuovi moduli
    this.connectionManager.setupConnectionHandling();
    this.connectionManager.setupShutdownHandling();
    this.playerDataManager.setupPeriodicSave();
  }

  // Metodi pubblici per backward compatibility (delegano ai moduli)
  
  /**
   * Carica i dati del giocatore dal database
   * @param {string} userId - auth_id del giocatore
   * @returns {Promise<Object>} Player data
   */
  async loadPlayerData(userId) {
    return this.playerDataManager.loadPlayerData(userId);
  }

  /**
   * Salva i dati del giocatore nel database
   * @param {Object} playerData - Dati del giocatore
   */
  async savePlayerData(playerData) {
    return this.playerDataManager.savePlayerData(playerData);
  }

  /**
   * Crea i record iniziali per un nuovo giocatore
   * @param {string} playerId - auth_id del giocatore
   */
  async createInitialPlayerRecords(playerId) {
    return this.playerDataManager.createInitialPlayerRecords(playerId);
  }

  /**
   * Salva uno snapshot dell'honor
   * @param {string} authId - auth_id del giocatore
   * @param {number} honorValue - Valore honor
   * @param {string} reason - Motivo
   */
  async saveHonorSnapshot(authId, honorValue, reason) {
    return this.playerDataManager.saveHonorSnapshot(authId, honorValue, reason);
  }

  /**
   * Recupera la media mobile dell'honor
   * @param {string} authId - auth_id del giocatore
   * @param {number} days - Numero di giorni
   * @returns {Promise<number>} Media honor
   */
  async getRecentHonorAverage(authId, days) {
    return this.playerDataManager.getRecentHonorAverage(authId, days);
  }

  /**
   * Restituisce i dati di default per un nuovo giocatore
   * @returns {Object} Default player data
   */
  getDefaultPlayerData() {
    return this.playerDataManager.getDefaultPlayerData();
  }

  /**
   * Calcola maxHealth basato sugli upgrade HP
   * @param {number} hpUpgrades - Numero di upgrade HP
   * @returns {number} Max health
   */
  calculateMaxHealth(hpUpgrades) {
    return this.authManager.calculateMaxHealth(hpUpgrades);
  }

  /**
   * Calcola maxShield basato sugli upgrade Shield
   * @param {number} shieldUpgrades - Numero di upgrade Shield
   * @returns {number} Max shield
   */
  calculateMaxShield(shieldUpgrades) {
    return this.authManager.calculateMaxShield(shieldUpgrades);
  }

  /**
   * Calcola il rank militare basato sui ranking points
   * @param {number} rankingPoints - Punti ranking
   * @returns {string} Nome del rank
   */
  calculateRankName(rankingPoints) {
    return this.authManager.calculateRankName(rankingPoints);
  }
}

module.exports = WebSocketConnectionManager;
