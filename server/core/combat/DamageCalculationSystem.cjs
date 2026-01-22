/**
 * DamageCalculationSystem - Calcolo del danno (logica di gioco)
 * 
 * Responsabilità: Calcola il danno basato su base damage e upgrade del player
 * 
 * Separazione delle responsabilità:
 * - Manager decide QUANDO calcolare (orchestrazione)
 * - System decide COME calcolare (logica di gioco)
 */

const { SERVER_CONSTANTS } = require('../../config/constants.cjs');

class DamageCalculationSystem {
  /**
   * Calcola il danno del player basato su base damage e upgrade
   * 
   * @param {number} baseDamage - Danno base (default: 500)
   * @param {Object} upgrades - Oggetto con upgrade del player (opzionale)
   * @param {number} upgrades.damageUpgrades - Numero di upgrade danno
   * @returns {number} Danno calcolato
   */
  static calculatePlayerDamage(baseDamage = 500, upgrades = null) {
    if (!upgrades || !upgrades.damageUpgrades) {
      return baseDamage;
    }

    // Formula: damageBonus = 1.0 + (damageUpgrades * 0.01)
    // Ogni upgrade aumenta il danno dell'1%
    const damageBonus = 1.0 + (upgrades.damageUpgrades * 0.01);
    return Math.floor(baseDamage * damageBonus);
  }

  /**
   * Ottiene il danno base del player
   * 
   * @returns {number} Danno base (500)
   */
  static getBasePlayerDamage() {
    return 500;
  }
}

module.exports = DamageCalculationSystem;
