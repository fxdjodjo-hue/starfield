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
   * Calcola il danno del player basato su base damage, upgrade e item
   * 
   * @param {number} baseDamage - Danno base (default: da config)
   * @param {Object} upgrades - Oggetto con upgrade del player (opzionale)
   * @param {Array} items - Oggetti nell'inventario (opzionale)
   * @returns {number} Danno calcolato
   */
  static calculatePlayerDamage(baseDamage = playerConfig.stats.damage, upgrades = null, items = []) {
    let bonus = 1.0;

    if (upgrades && upgrades.damageUpgrades) {
      bonus += (upgrades.damageUpgrades * 0.05);
    }

    // Aggiungi bonus dagli item equipaggiati
    if (items && Array.isArray(items)) {
      const itemConfig = require('../../../shared/item-config.json');
      const ITEM_REGISTRY = itemConfig.ITEM_REGISTRY;

      const equippedLaserItem = items.find(i => i.slot === 'LASER');
      if (equippedLaserItem) {
        const itemDef = ITEM_REGISTRY[equippedLaserItem.id];
        if (itemDef?.stats?.damageBonus) {
          bonus += itemDef.stats.damageBonus;
        }
      }
    }

    return Math.floor(baseDamage * bonus);
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
