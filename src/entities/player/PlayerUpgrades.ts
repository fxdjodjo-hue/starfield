import { Component } from '../../infrastructure/ecs/Component';
import { Inventory } from './Inventory';
import { ItemSlot, getItem } from '../../config/ItemConfig';

/**
 * Componente PlayerUpgrades - gestisce gli upgrade delle statistiche del giocatore
 * Ogni upgrade costa 1 skill point e dà +1% alla statistica corrispondente
 */
export class PlayerUpgrades extends Component {
  private _hpUpgrades: number = 0;
  private _shieldUpgrades: number = 0;
  private _speedUpgrades: number = 0;
  private _damageUpgrades: number = 0;
  private _missileDamageUpgrades: number = 0;

  constructor(hpUpgrades: number = 0, shieldUpgrades: number = 0, speedUpgrades: number = 0) {
    super();
    this._hpUpgrades = hpUpgrades;
    this._shieldUpgrades = shieldUpgrades;
    this._speedUpgrades = speedUpgrades;
    this._missileDamageUpgrades = 0; // Default
  }

  // Getters
  get hpUpgrades(): number {
    return this._hpUpgrades;
  }

  get shieldUpgrades(): number {
    return this._shieldUpgrades;
  }

  get speedUpgrades(): number {
    return this._speedUpgrades;
  }

  get damageUpgrades(): number {
    return this._damageUpgrades;
  }

  get missileDamageUpgrades(): number {
    return this._missileDamageUpgrades;
  }

  get totalUpgrades(): number {
    return this._hpUpgrades + this._shieldUpgrades + this._speedUpgrades + this._damageUpgrades + this._missileDamageUpgrades;
  }

  // Methods
  /**
   * Acquista un upgrade HP (+5% HP)
   */
  upgradeHP(): boolean {
    this._hpUpgrades++;
    return true;
  }

  /**
   * Acquista un upgrade Shield (+5% Shield)
   */
  upgradeShield(): boolean {
    this._shieldUpgrades++;
    return true;
  }

  /**
   * Acquista un upgrade Speed (+0.5% Speed)
   */
  upgradeSpeed(): boolean {
    this._speedUpgrades++;
    return true;
  }

  /**
   * Acquista un upgrade Weapon Damage (+5% Weapon Damage)
   */
  upgradeDamage(): boolean {
    this._damageUpgrades++;
    return true;
  }

  /**
   * Acquista un upgrade Missile Damage (+5% Missile Damage)
   */
  upgradeMissileDamage(): boolean {
    this._missileDamageUpgrades++;
    return true;
  }

  /**
   * Rollback upgrade HP (per errori)
   */
  rollbackHP(): boolean {
    if (this._hpUpgrades > 0) {
      this._hpUpgrades--;
      return true;
    }
    return false;
  }

  /**
   * Rollback upgrade Shield (per errori)
   */
  rollbackShield(): boolean {
    if (this._shieldUpgrades > 0) {
      this._shieldUpgrades--;
      return true;
    }
    return false;
  }

  /**
   * Rollback upgrade Speed (per errori)
   */
  rollbackSpeed(): boolean {
    if (this._speedUpgrades > 0) {
      this._speedUpgrades--;
      return true;
    }
    return false;
  }

  /**
   * Rollback upgrade Weapon Damage (per errori)
   */
  rollbackDamage(): boolean {
    if (this._damageUpgrades > 0) {
      this._damageUpgrades--;
      return true;
    }
    return false;
  }

  /**
   * Rollback upgrade Missile Damage (per errori)
   */
  rollbackMissileDamage(): boolean {
    if (this._missileDamageUpgrades > 0) {
      this._missileDamageUpgrades--;
      return true;
    }
    return false;
  }

  /**
   * Calcola il bonus moltiplicatore per HP ((1.0 + upgrades * 0.05) * itemMultiplier)
   */
  getHPBonus(inventory?: Inventory): number {
    const upgradeBonus = this._hpUpgrades * 0.05;
    let itemMultiplier = 1.0;
    if (inventory) {
      const equippedItemId = inventory.getEquippedItemId(ItemSlot.HULL);
      if (equippedItemId) {
        const item = getItem(equippedItemId);
        if (item?.stats?.hpBonus) {
          itemMultiplier += item.stats.hpBonus;
        }
      }
    }
    return (1.0 + upgradeBonus) * itemMultiplier;
  }

  /**
   * Calcola il bonus moltiplicatore per Shield ((1.0 + upgrades * 0.05) * itemMultiplier)
   */
  getShieldBonus(inventory?: Inventory): number {
    const upgradeBonus = this._shieldUpgrades * 0.05;
    let itemMultiplier = 1.0;
    if (inventory) {
      const equippedItemId = inventory.getEquippedItemId(ItemSlot.SHIELD);
      if (equippedItemId) {
        const item = getItem(equippedItemId);
        if (item?.stats?.shieldBonus) {
          itemMultiplier += item.stats.shieldBonus;
        }
      }
    }
    return (1.0 + upgradeBonus) * itemMultiplier;
  }

  /**
   * Calcola il bonus moltiplicatore per Speed ((1.0 + upgrades * 0.005) * itemMultiplier)
   */
  getSpeedBonus(inventory?: Inventory): number {
    const upgradeBonus = this._speedUpgrades * 0.005;
    let itemMultiplier = 1.0;
    if (inventory) {
      const equippedItemId = inventory.getEquippedItemId(ItemSlot.ENGINE);
      if (equippedItemId) {
        const item = getItem(equippedItemId);
        if (item?.stats?.speedBonus) {
          itemMultiplier += item.stats.speedBonus;
        }
      }
    }
    return (1.0 + upgradeBonus) * itemMultiplier;
  }

  /**
   * Calcola il bonus moltiplicatore per Weapon Damage ((1.0 + upgrades * 0.05) * itemMultiplier)
   */
  getDamageBonus(inventory?: Inventory): number {
    const upgradeBonus = this._damageUpgrades * 0.05;
    let itemMultiplier = 1.0;
    if (inventory) {
      const equippedItemId = inventory.getEquippedItemId(ItemSlot.LASER);
      if (equippedItemId) {
        const item = getItem(equippedItemId);
        if (item?.stats?.damageBonus) {
          itemMultiplier += item.stats.damageBonus;
        }
      }
    }
    return (1.0 + upgradeBonus) * itemMultiplier;
  }

  /**
   * Calcola il bonus moltiplicatore per Missile Damage ((1.0 + upgrades * 0.05) * itemMultiplier)
   */
  getMissileDamageBonus(inventory?: Inventory): number {
    const upgradeBonus = this._missileDamageUpgrades * 0.05;
    let itemMultiplier = 1.0;
    if (inventory) {
      const equippedItemId = inventory.getEquippedItemId(ItemSlot.MISSILE);
      if (equippedItemId) {
        const item = getItem(equippedItemId);
        if (item?.stats?.missileBonus) {
          itemMultiplier += item.stats.missileBonus;
        }
      }
    }
    return (1.0 + upgradeBonus) * itemMultiplier;
  }

  /**
   * Resetta tutti gli upgrade (per debug o reset)
   */
  reset(): void {
    this._hpUpgrades = 0;
    this._shieldUpgrades = 0;
    this._speedUpgrades = 0;
    this._damageUpgrades = 0;
    this._missileDamageUpgrades = 0;
  }


  /**
   * Imposta direttamente il numero di upgrade per ogni statistica
   */
  setUpgrades(hp: number, shield: number, speed: number, damage: number = 0, missileDamage: number = 0): void {
    this._hpUpgrades = Math.max(0, hp);
    this._shieldUpgrades = Math.max(0, shield);
    this._speedUpgrades = Math.max(0, speed);
    this._damageUpgrades = Math.max(0, damage);
    this._missileDamageUpgrades = Math.max(0, missileDamage);
  }

  /**
   * Serializza i dati per la sincronizzazione di rete (multiplayer)
   */
  toNetworkData(): object {
    return {
      hpUpgrades: this._hpUpgrades,
      shieldUpgrades: this._shieldUpgrades,
      speedUpgrades: this._speedUpgrades,
      damageUpgrades: this._damageUpgrades,
      missileDamageUpgrades: this._missileDamageUpgrades
    };
  }

  /**
   * Deserializza i dati dalla rete (multiplayer)
   */
  fromNetworkData(data: any): void {
    if (data && typeof data === 'object') {
      this._hpUpgrades = Math.max(0, data.hpUpgrades || 0);
      this._shieldUpgrades = Math.max(0, data.shieldUpgrades || 0);
      this._speedUpgrades = Math.max(0, data.speedUpgrades || 0);
      this._damageUpgrades = Math.max(0, data.damageUpgrades || 0);
      this._missileDamageUpgrades = Math.max(0, data.missileDamageUpgrades || 0);
    }
  }
}
