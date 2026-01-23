/**
 * PlayerStatsCalculator - Calcolo centralizzato delle statistiche giocatore
 * Sostituisce calcoli duplicati di maxHealth/maxShield in tutto il progetto
 * @deprecated Use shared/player-config.json and UpgradeValidationManager instead
 */

import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { InputValidator } from '../utils/InputValidator';

export interface PlayerUpgrades {
  hpUpgrades: number;
  shieldUpgrades: number;
  speedUpgrades: number;
  damageUpgrades: number;
}

export interface PlayerStats {
  maxHealth: number;
  maxShield: number;
  maxSpeed: number;
  damageMultiplier: number;
  totalUpgrades: number;
  upgradeCost: {
    hp: number;
    shield: number;
    speed: number;
    damage: number;
  };
}

export interface UpgradeValidation {
  isValid: boolean;
  error?: string;
  canAfford: boolean;
  cost: number;
}

export class PlayerStatsCalculator {
  // Valori base del giocatore (allineati con server)
  private static readonly BASE_STATS = {
    health: 100000,  // allineato con server
    shield: 50000,   // allineato con server
    speed: 300,      // velocità base (da player-config.json)
    damage: 500      // danno base
  };

  // Moltiplicatori per upgrade (allineati con server)
  private static readonly UPGRADE_MULTIPLIERS = {
    health: 0.05,    // +5% per upgrade
    shield: 0.05,    // +5% per upgrade
    speed: 0.005,    // +0.5% per upgrade
    damage: 0.05     // +5% per upgrade
  };

  // Costi base per upgrade
  private static readonly BASE_UPGRADE_COSTS = {
    hp: 5000,
    shield: 3000,
    speed: 8000,
    damage: 15000
  };

  // Moltiplicatore costo per livello (costo aumenta con il livello)
  private static readonly COST_SCALING = 1.5;

  /**
   * Calcola salute massima basata sugli upgrade
   */
  static calculateMaxHealth(hpUpgrades: number): number {
    const upgrades = InputValidator.validateNumber(hpUpgrades, 'hpUpgrades');
    if (!upgrades.isValid) {
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Invalid HP upgrades value: ${hpUpgrades}`, {
        hpUpgrades,
        error: upgrades.error
      });
      hpUpgrades = 0;
    }

    const maxHealth = Math.floor(this.BASE_STATS.health * (1 + hpUpgrades * this.UPGRADE_MULTIPLIERS.health));

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Calculated max health`, {
      hpUpgrades,
      baseHealth: this.BASE_STATS.health,
      maxHealth,
      multiplier: this.UPGRADE_MULTIPLIERS.health
    });

    return maxHealth;
  }

  /**
   * Calcola scudo massimo basato sugli upgrade
   */
  static calculateMaxShield(shieldUpgrades: number): number {
    const upgrades = InputValidator.validateNumber(shieldUpgrades, 'shieldUpgrades');
    if (!upgrades.isValid) {
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Invalid shield upgrades value: ${shieldUpgrades}`, {
        shieldUpgrades,
        error: upgrades.error
      });
      shieldUpgrades = 0;
    }

    const maxShield = Math.floor(this.BASE_STATS.shield * (1 + shieldUpgrades * this.UPGRADE_MULTIPLIERS.shield));

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Calculated max shield`, {
      shieldUpgrades,
      baseShield: this.BASE_STATS.shield,
      maxShield,
      multiplier: this.UPGRADE_MULTIPLIERS.shield
    });

    return maxShield;
  }

  /**
   * Calcola velocità massima basata sugli upgrade
   */
  static calculateMaxSpeed(speedUpgrades: number): number {
    const upgrades = InputValidator.validateNumber(speedUpgrades, 'speedUpgrades');
    if (!upgrades.isValid) {
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Invalid speed upgrades value: ${speedUpgrades}`, {
        speedUpgrades,
        error: upgrades.error
      });
      speedUpgrades = 0;
    }

    const maxSpeed = Math.floor(this.BASE_STATS.speed * (1 + speedUpgrades * this.UPGRADE_MULTIPLIERS.speed));

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Calculated max speed`, {
      speedUpgrades,
      baseSpeed: this.BASE_STATS.speed,
      maxSpeed,
      multiplier: this.UPGRADE_MULTIPLIERS.speed
    });

    return maxSpeed;
  }

  /**
   * Calcola moltiplicatore danno basato sugli upgrade
   */
  static calculateDamageMultiplier(damageUpgrades: number): number {
    const upgrades = InputValidator.validateNumber(damageUpgrades, 'damageUpgrades');
    if (!upgrades.isValid) {
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Invalid damage upgrades value: ${damageUpgrades}`, {
        damageUpgrades,
        error: upgrades.error
      });
      damageUpgrades = 0;
    }

    const multiplier = 1 + damageUpgrades * this.UPGRADE_MULTIPLIERS.damage;

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Calculated damage multiplier`, {
      damageUpgrades,
      baseDamage: this.BASE_STATS.damage,
      multiplier,
      multiplierPercent: this.UPGRADE_MULTIPLIERS.damage * 100
    });

    return multiplier;
  }

  /**
   * Calcola danno effettivo
   */
  static calculateDamage(baseDamage: number, damageUpgrades: number): number {
    const multiplier = this.calculateDamageMultiplier(damageUpgrades);
    return Math.floor(baseDamage * multiplier);
  }

  /**
   * Calcola tutte le statistiche del giocatore
   */
  static calculatePlayerStats(upgrades: PlayerUpgrades): PlayerStats {
    const validation = this.validateUpgrades(upgrades);
    if (!validation.isValid) {
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Invalid upgrades provided, using defaults`, {
        upgrades,
        error: validation.error
      });
      upgrades = { hpUpgrades: 0, shieldUpgrades: 0, speedUpgrades: 0, damageUpgrades: 0 };
    }

    const stats: PlayerStats = {
      maxHealth: this.calculateMaxHealth(upgrades.hpUpgrades),
      maxShield: this.calculateMaxShield(upgrades.shieldUpgrades),
      maxSpeed: this.calculateMaxSpeed(upgrades.speedUpgrades),
      damageMultiplier: this.calculateDamageMultiplier(upgrades.damageUpgrades),
      totalUpgrades: upgrades.hpUpgrades + upgrades.shieldUpgrades + upgrades.speedUpgrades + upgrades.damageUpgrades,
      upgradeCost: {
        hp: this.calculateUpgradeCost('hp', upgrades.hpUpgrades),
        shield: this.calculateUpgradeCost('shield', upgrades.shieldUpgrades),
        speed: this.calculateUpgradeCost('speed', upgrades.speedUpgrades),
        damage: this.calculateUpgradeCost('damage', upgrades.damageUpgrades)
      }
    };

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Calculated complete player stats`, {
      upgrades,
      stats
    });

    return stats;
  }

  /**
   * Calcola costo di un upgrade specifico
   */
  static calculateUpgradeCost(upgradeType: keyof typeof PlayerStatsCalculator.BASE_UPGRADE_COSTS, currentLevel: number): number {
    const baseCost = this.BASE_UPGRADE_COSTS[upgradeType];
    // Costo aumenta esponenzialmente con il livello
    const cost = Math.floor(baseCost * Math.pow(this.COST_SCALING, currentLevel));

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Calculated upgrade cost`, {
      upgradeType,
      currentLevel,
      baseCost,
      cost,
      scalingFactor: this.COST_SCALING
    });

    return cost;
  }

  /**
   * Valida se un giocatore può permettersi un upgrade
   */
  static validateUpgradePurchase(
    upgradeType: keyof typeof PlayerStatsCalculator.BASE_UPGRADE_COSTS,
    currentLevel: number,
    playerCredits: number
  ): UpgradeValidation {
    const cost = this.calculateUpgradeCost(upgradeType, currentLevel);

    const canAfford = playerCredits >= cost;

    if (!canAfford) {
      return {
        isValid: false,
        error: `Insufficient credits. Need ${cost}, have ${playerCredits}`,
        canAfford: false,
        cost
      };
    }

    return {
      isValid: true,
      canAfford: true,
      cost
    };
  }

  /**
   * Applica un upgrade (incrementa livello)
   */
  static applyUpgrade(upgrades: PlayerUpgrades, upgradeType: keyof PlayerUpgrades): PlayerUpgrades {
    const newUpgrades = { ...upgrades };

    switch (upgradeType) {
      case 'hpUpgrades':
        newUpgrades.hpUpgrades++;
        break;
      case 'shieldUpgrades':
        newUpgrades.shieldUpgrades++;
        break;
      case 'speedUpgrades':
        newUpgrades.speedUpgrades++;
        break;
      case 'damageUpgrades':
        newUpgrades.damageUpgrades++;
        break;
      default:
        LoggerWrapper.warn(LogCategory.GAMEPLAY, `Unknown upgrade type: ${upgradeType}`, {
          upgradeType,
          upgrades
        });
        return upgrades;
    }

    LoggerWrapper.info(LogCategory.GAMEPLAY, `Applied upgrade: ${upgradeType}`, {
      upgradeType,
      oldLevel: upgrades[upgradeType],
      newLevel: newUpgrades[upgradeType]
    });

    return newUpgrades;
  }

  /**
   * Valida struttura upgrades
   */
  static validateUpgrades(upgrades: any): { isValid: boolean; error?: string } {
    if (!upgrades || typeof upgrades !== 'object') {
      return { isValid: false, error: 'Upgrades must be an object' };
    }

    const requiredFields: (keyof PlayerUpgrades)[] = ['hpUpgrades', 'shieldUpgrades', 'speedUpgrades', 'damageUpgrades'];

    for (const field of requiredFields) {
      const validation = InputValidator.validateNumber(upgrades[field], field);
      if (!validation.isValid) {
        return { isValid: false, error: `${field}: ${validation.error}` };
      }

      if (upgrades[field] < 0) {
        return { isValid: false, error: `${field} cannot be negative` };
      }

      // Limite massimo upgrade ragionevole
      if (upgrades[field] > 1000) {
        return { isValid: false, error: `${field} exceeds maximum allowed value (1000)` };
      }
    }

    return { isValid: true };
  }

  /**
   * Ottiene statistiche di progresso del giocatore
   */
  static getProgressStats(upgrades: PlayerUpgrades): {
    totalUpgrades: number;
    averageLevel: number;
    dominantStat: keyof PlayerUpgrades;
    upgradeDistribution: Record<keyof PlayerUpgrades, number>;
  } {
    const validation = this.validateUpgrades(upgrades);
    if (!validation.isValid) {
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Invalid upgrades for progress stats`, {
        upgrades,
        error: validation.error
      });
      upgrades = { hpUpgrades: 0, shieldUpgrades: 0, speedUpgrades: 0, damageUpgrades: 0 };
    }

    const totalUpgrades = upgrades.hpUpgrades + upgrades.shieldUpgrades + upgrades.speedUpgrades + upgrades.damageUpgrades;
    const averageLevel = totalUpgrades / 4;

    // Trova statistica dominante
    const stats = [
      { type: 'hpUpgrades' as keyof PlayerUpgrades, value: upgrades.hpUpgrades },
      { type: 'shieldUpgrades' as keyof PlayerUpgrades, value: upgrades.shieldUpgrades },
      { type: 'speedUpgrades' as keyof PlayerUpgrades, value: upgrades.speedUpgrades },
      { type: 'damageUpgrades' as keyof PlayerUpgrades, value: upgrades.damageUpgrades }
    ];

    const dominantStat = stats.reduce((prev, current) => current.value > prev.value ? current : prev).type;

    const upgradeDistribution = {
      hpUpgrades: upgrades.hpUpgrades,
      shieldUpgrades: upgrades.shieldUpgrades,
      speedUpgrades: upgrades.speedUpgrades,
      damageUpgrades: upgrades.damageUpgrades
    };

    return {
      totalUpgrades,
      averageLevel,
      dominantStat,
      upgradeDistribution
    };
  }

  /**
   * Resetta tutti gli upgrade (per testing o admin)
   */
  static resetUpgrades(): PlayerUpgrades {
    LoggerWrapper.info(LogCategory.GAMEPLAY, 'Player upgrades reset to defaults');
    return {
      hpUpgrades: 0,
      shieldUpgrades: 0,
      speedUpgrades: 0,
      damageUpgrades: 0
    };
  }

  /**
   * Ottiene valori base del sistema
   */
  static getBaseStats() {
    return { ...this.BASE_STATS };
  }

  /**
   * Ottiene moltiplicatori upgrade
   */
  static getUpgradeMultipliers() {
    return { ...this.UPGRADE_MULTIPLIERS };
  }

  /**
   * Ottiene costi base upgrade
   */
  static getBaseUpgradeCosts() {
    return { ...this.BASE_UPGRADE_COSTS };
  }
}