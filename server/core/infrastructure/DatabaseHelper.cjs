// DatabaseHelper - Sistema centralizzato per operazioni database
// Sostituisce operazioni duplicate in PlayerDataManager e altri sistemi

const { logger } = require('../../logger.cjs');

class DatabaseHelper {
  /**
   * Prepara dati stats per salvataggio database
   */
  static prepareStatsData(stats) {
    if (!stats) return null;

    try {
      return {
        kills: Number(stats.kills ?? 0),
        deaths: Number(stats.deaths ?? 0),
        ranking_points: Number(stats.rankingPoints ?? 0)
      };
    } catch (error) {
      logger.error('DATABASE', 'Failed to prepare stats data:', error);
      return null;
    }
  }

  /**
   * Prepara dati upgrades per salvataggio database
   */
  static prepareUpgradesData(upgrades) {
    if (!upgrades) return null;

    try {
      return {
        hp_upgrades: Number(upgrades.hpUpgrades ?? 0),
        shield_upgrades: Number(upgrades.shieldUpgrades ?? 0),
        speed_upgrades: Number(upgrades.speedUpgrades ?? 0),
        damage_upgrades: Number(upgrades.damageUpgrades ?? 0)
      };
    } catch (error) {
      logger.error('DATABASE', 'Failed to prepare upgrades data:', error);
      return null;
    }
  }

  /**
   * Prepara dati currencies per salvataggio database
   */
  static prepareCurrenciesData(inventory) {
    if (!inventory) return null;

    try {
      return {
        credits: Number(inventory.credits ?? 0),
        cosmos: Number(inventory.cosmos ?? 0),
        experience: Number(inventory.experience ?? 0),
        honor: Number(inventory.honor ?? 0),
        skill_points: Number(inventory.skillPoints ?? 0),
        skill_points_total: Number(inventory.skillPointsTotal ?? inventory.skillPoints ?? 0),
        // Salva sempre HP/shield correnti per persistenza MMO
        current_health: this.prepareHealthValue(inventory.health),
        current_shield: this.prepareShieldValue(inventory.shield)
      };
    } catch (error) {
      logger.error('DATABASE', 'Failed to prepare currencies data:', error);
      return null;
    }
  }

  /**
   * Prepara valore health per database (sempre salvato per persistenza MMO)
   */
  static prepareHealthValue(health) {
    const value = health !== null && health !== undefined ? health : null;
    // Health save logging removed - covered by PlayerDataManager summary
    return value !== null ? Number(value) : null;
  }

  /**
   * Prepara valore shield per database (sempre salvato per persistenza MMO)
   */
  static prepareShieldValue(shield) {
    const value = shield !== null && shield !== undefined ? shield : null;
    // Shield save logging removed - covered by PlayerDataManager summary
    return value !== null ? Number(value) : null;
  }

  /**
   * Prepara dati quests per salvataggio database
   */
  static prepareQuestsData(quests) {
    if (!quests) return null;

    try {
      return JSON.stringify(quests);
    } catch (error) {
      logger.error('DATABASE', 'Failed to prepare quests data:', error);
      return null;
    }
  }

  /**
   * Prepara dati profile per salvataggio database
   */
  static prepareProfileData(playerData) {
    try {
      return {
        is_administrator: Boolean(playerData.isAdministrator ?? false)
      };
    } catch (error) {
      logger.error('DATABASE', 'Failed to prepare profile data:', error);
      return null;
    }
  }

  /**
   * Valida dati prima del salvataggio
   */
  static validatePlayerDataForSave(playerData) {
    const errors = [];

    if (!playerData) {
      errors.push('Player data is null or undefined');
      return { isValid: false, errors };
    }

    if (!playerData.playerId && !playerData.userId) {
      errors.push('Player ID or User ID is required');
    }

    if (!playerData.inventory) {
      errors.push('Inventory data is required');
    }

    // Validazione numeri
    if (playerData.inventory) {
      const currencies = ['credits', 'cosmos', 'experience', 'honor'];
      for (const currency of currencies) {
        const value = playerData.inventory[currency];
        if (value !== undefined && value !== null && (isNaN(value) || value < 0)) {
          errors.push(`${currency} must be a non-negative number`);
        }
      }
    }

    // Validazione upgrades
    if (playerData.upgrades) {
      const upgradeFields = ['hpUpgrades', 'shieldUpgrades', 'speedUpgrades', 'damageUpgrades'];
      for (const field of upgradeFields) {
        const value = playerData.upgrades[field];
        if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
          errors.push(`${field} must be a non-negative integer`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calcola valori di default per inventory
   */
  static getDefaultInventory() {
    return {
      credits: 1000,
      cosmos: 0,
      experience: 0,
      honor: 0,
      skillPoints: 0,
      skillPointsTotal: 0
    };
  }

  /**
   * Calcola valori di default per upgrades
   */
  static getDefaultUpgrades() {
    return {
      hpUpgrades: 0,
      shieldUpgrades: 0,
      speedUpgrades: 0,
      damageUpgrades: 0
    };
  }

  /**
   * Calcola valori di default per stats
   */
  static getDefaultStats() {
    return {
      kills: 0,
      deaths: 0,
      rankingPoints: 0
    };
  }

  /**
   * Gestisce valori null del database (DATABASE IS SOURCE OF TRUTH)
   */
  static handleNullDatabaseValues(currenciesData, hadNullInDb) {
    if (!currenciesData) return this.getDefaultInventory();

    // Se TUTTI i valori principali sono null, significa record nuovo
    const allMainValuesNull = currenciesData.credits === null &&
                             currenciesData.cosmos === null &&
                             currenciesData.experience === null &&
                             currenciesData.honor === null;

    if (allMainValuesNull) {
      // Record popolato per la prima volta
      return {
        ...this.getDefaultInventory(),
        _hadNullInDb: true
      };
    }

    // Preserva valori esistenti, usa default solo per null
    return {
      credits: currenciesData.credits ?? this.getDefaultInventory().credits,
      cosmos: currenciesData.cosmos ?? this.getDefaultInventory().cosmos,
      experience: currenciesData.experience ?? this.getDefaultInventory().experience,
      honor: currenciesData.honor ?? this.getDefaultInventory().honor,
      skillPoints: currenciesData.skill_points ?? this.getDefaultInventory().skillPoints,
      skillPointsTotal: currenciesData.skill_points_total ?? currenciesData.skill_points ?? this.getDefaultInventory().skillPointsTotal,
      _hadNullInDb: hadNullInDb
    };
  }

  /**
   * Prepara dati completi per salvataggio RPC
   */
  static prepareCompletePlayerData(playerData) {
    const validation = this.validatePlayerDataForSave(playerData);
    if (!validation.isValid) {
      throw new Error(`Invalid player data: ${validation.errors.join(', ')}`);
    }

    try {
      return {
        statsData: this.prepareStatsData(playerData.stats),
        upgradesData: this.prepareUpgradesData(playerData.upgrades),
        currenciesData: this.prepareCurrenciesData(playerData.inventory),
        questsData: this.prepareQuestsData(playerData.quests),
        profileData: this.prepareProfileData(playerData)
      };
    } catch (error) {
      logger.error('DATABASE', 'Failed to prepare complete player data:', error);
      throw error;
    }
  }

  /**
   * Logga operazione database per debugging
   */
  static logDatabaseOperation(operation, playerId, data = null) {
    logger.info('DATABASE', `${operation} for player ${playerId}`, data ? { data } : undefined);
  }

  /**
   * Gestisce errori database in modo consistente
   */
  static handleDatabaseError(operation, error, playerId = 'unknown') {
    logger.error('DATABASE', `${operation} failed for player ${playerId}:`, error);
    return {
      success: false,
      error: error.message || 'Database operation failed',
      operation,
      playerId
    };
  }
}

module.exports = DatabaseHelper;