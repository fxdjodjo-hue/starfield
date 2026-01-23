// AuthenticationManager - Gestione autenticazione e security checks
// Responsabilità: Verifica player ID, security validation, helper auth
// Dipendenze: logger.cjs

const { logger } = require('../../logger.cjs');

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
    const baseHealth = 100000;
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
    const baseShield = 50000;
    const bonus = 1.0 + (shieldUpgrades * 0.05);
    return Math.floor(baseShield * bonus);
  }

  /**
   * Calcola il rank militare basato sui ranking points
   * 
   * @param {number} rankingPoints - Punti ranking del player
   * @param {boolean} isAdministrator - Se il player è un amministratore
   * @returns {string} Nome del rank
   */
  calculateRankName(rankingPoints, isAdministrator = false) {
    if (isAdministrator) {
      return 'Administrator';
    }

    const ranks = [
      { name: 'Chief General', minPoints: 100000 },
      { name: 'General', minPoints: 75000 },
      { name: 'Basic General', minPoints: 50000 },
      { name: 'Chief Colonel', minPoints: 35000 },
      { name: 'Colonel', minPoints: 25000 },
      { name: 'Basic Colonel', minPoints: 15000 },
      { name: 'Chief Major', minPoints: 10000 },
      { name: 'Major', minPoints: 7500 },
      { name: 'Basic Major', minPoints: 5000 },
      { name: 'Chief Captain', minPoints: 3500 },
      { name: 'Captain', minPoints: 2500 },
      { name: 'Basic Captain', minPoints: 1500 },
      { name: 'Chief Lieutenant', minPoints: 1000 },
      { name: 'Lieutenant', minPoints: 750 },
      { name: 'Basic Lieutenant', minPoints: 500 },
      { name: 'Chief Sergeant', minPoints: 350 },
      { name: 'Sergeant', minPoints: 250 },
      { name: 'Basic Sergeant', minPoints: 150 },
      { name: 'Chief Space Pilot', minPoints: 100 },
      { name: 'Space Pilot', minPoints: 50 },
      { name: 'Basic Space Pilot', minPoints: 25 },
      { name: 'Recruit', minPoints: 0 }
    ];

    for (const rank of ranks) {
      if (rankingPoints >= rank.minPoints) {
        return rank.name;
      }
    }

    return 'Recruit';
  }
}

module.exports = AuthenticationManager;
