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
  constructor(wss, mapManager, messageCount) {
    this.mapManager = mapManager;
    // For backward compatibility with managers that expect a single mapServer
    const defaultMap = mapManager.getMap('palantir');

    // Crea istanze dei moduli refactorizzati
    this.playerDataManager = new PlayerDataManager(defaultMap || mapManager);
    this.authManager = new AuthenticationManager();
    this.messageBroadcaster = new MessageBroadcaster(defaultMap || mapManager);
    this.connectionManager = new WebSocketConnectionManagerCore(wss, mapManager, messageCount);

    // Inietta dipendenze nel connection manager
    this.connectionManager.setPlayerDataManager(this.playerDataManager);
    this.connectionManager.setAuthManager(this.authManager);
    this.connectionManager.setMessageBroadcaster(this.messageBroadcaster);

    // Wire websocket manager into each map server for immediate saves/rewards
    if (this.mapManager && this.mapManager.maps) {
      for (const mapInstance of this.mapManager.maps.values()) {
        mapInstance.websocketManager = this;
      }
    } else if (this.mapManager) {
      // Single-map fallback
      this.mapManager.websocketManager = this;
    }

    // SECURITY: Esponi il validatore globalmente per PositionUpdateProcessor
    // In un'architettura ideale, PositionUpdateProcessor dovrebbe riceverlo via DI
    global.inputValidator = this.connectionManager.inputValidator || new (require('../InputValidator.cjs'))();

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
  async savePlayerData(playerData, options = {}) {
    return this.playerDataManager.savePlayerData(playerData, options);
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

}

module.exports = WebSocketConnectionManager;
