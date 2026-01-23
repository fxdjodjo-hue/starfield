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
const playerConfig = require('../../../shared/player-config.json');

class DamageCalculationSystem {
  /**
   * Calcola il danno del player basato su base damage e upgrade
   * 
   * @param {number} baseDamage - Danno base (default: da config)
   * @param {Object} upgrades - Oggetto con upgrade del player (opzionale)
   * @param {number} upgrades.damageUpgrades - Numero di upgrade danno
   * @returns {number} Danno calcolato
   */
  static calculatePlayerDamage(baseDamage = playerConfig.stats.damage, upgrades = null) {
    if (!upgrades || !upgrades.damageUpgrades) {
      return baseDamage;
    }

    // Formula: damageBonus = 1.0 + (damageUpgrades * 0.05)
    // Ogni upgrade aumenta il danno del 5%
    const damageBonus = 1.0 + (upgrades.damageUpgrades * 0.05);
    return Math.floor(baseDamage * damageBonus);
  }

  /**
   * Ottiene il danno base del player
   * 
   * @returns {number} Danno base
   */
  static getBasePlayerDamage() {
    return playerConfig.stats.damage;
  }
}

module.exports = DamageCalculationSystem;
