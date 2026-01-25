// AuthenticationManager - Gestione autenticazione e security checks
// Responsabilità: Verifica player ID, security validation, helper auth
// Dipendenze: logger.cjs

const { logger } = require('../../logger.cjs');
const playerConfig = require('../../../shared/player-config.json');

/**
 * Gestisce autenticazione e security checks inline
 * TODO: Valutare se necessario o se può essere parte di WebSocketConnectionManager
 * 
 * Nota: Le validazioni principali sono già in:
 *   - InputValidator (struttura e contenuto messaggi)
 *   - BoundaryEnforcement (intent validation)
 * 
 * Questo modulo potrebbe contenere solo:
 *   - Verifica playerId matching (già inline nel codice)
 *   - Helper per security checks comuni
 */
class AuthenticationManager {
  constructor() {
    // TODO: Inizializzazione se necessaria
  }

  /**
   * Verifica che il playerId corrisponda al client autenticato
   * Usato in: skill_upgrade_request, projectile_fired, start_combat, request_player_data, save_request
   * 
   * @param {string} receivedPlayerId - PlayerId ricevuto nel messaggio
   * @param {Object} playerData - Dati del player dal mapServer
   * @returns {Object} { valid: boolean, error?: string }
   */
  validatePlayerId(receivedPlayerId, playerData) {
    if (!playerData) {
      return { valid: false, error: 'Player data not found' };
    }

    // Accetta sia il playerId numerico che l'UUID userId
    const isValidNumericId = receivedPlayerId == playerData.playerId;
    const isValidUuid = receivedPlayerId === playerData.userId;

    if (!isValidNumericId && !isValidUuid) {
      return { valid: false, error: 'Invalid player ID' };
    }

    return { valid: true };
  }

  /**
   * Verifica che il clientId corrisponda al mittente
   * 
   * @param {string} receivedClientId - ClientId ricevuto nel messaggio
   * @param {Object} playerData - Dati del player dal mapServer
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateClientId(receivedClientId, playerData) {
    if (!playerData) {
      return { valid: false, error: 'Player data not found' };
    }

    if (receivedClientId !== playerData.clientId) {
      return { valid: false, error: 'Invalid client ID' };
    }

    return { valid: true };
  }

  /**
   * Calcola maxHealth basato sugli upgrade HP
   * Formula: baseValue * (1.0 + hpUpgrades * 0.01)
   * 
   * @param {number} hpUpgrades - Numero di upgrade HP
   * @returns {number} Max health calcolato
   */
  calculateMaxHealth(hpUpgrades) {
    const baseHealth = playerConfig.stats.health;
    const bonus = 1.0 + (hpUpgrades * 0.05);
    return Math.floor(baseHealth * bonus);
  }

  /**
   * Calcola maxShield basato sugli upgrade Shield
   * Formula: baseValue * (1.0 + shieldUpgrades * 0.01)
   * 
   * @param {number} shieldUpgrades - Numero di upgrade Shield
   * @returns {number} Max shield calcolato
   */
  calculateMaxShield(shieldUpgrades) {
    const baseShield = playerConfig.stats.shield;
    const bonus = 1.0 + (shieldUpgrades * 0.05);
    return Math.floor(baseShield * bonus);
  }

}

module.exports = AuthenticationManager;
