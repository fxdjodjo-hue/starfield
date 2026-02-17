const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const {
  PET_XP_SHARE_FROM_PLAYER,
  getPetExperienceCap,
  resolvePetLevelFromExperience,
  getPetStatsForLevel,
  createDefaultPlayerPetState,
  normalizePlayerPetState
} = require('../../config/PetCatalog.cjs');

class PetProgressionManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  ensurePetState(playerData) {
    if (!playerData || typeof playerData !== 'object') {
      return createDefaultPlayerPetState();
    }

    const normalizedState = normalizePlayerPetState(playerData.petState);
    playerData.petState = normalizedState;
    return normalizedState;
  }

  applyPlayerExperienceGain(playerData, playerExperienceGain, source = 'unknown') {
    const petState = this.ensurePetState(playerData);
    const safePlayerExperienceGain = Math.max(0, Math.floor(Number(playerExperienceGain || 0)));
    const targetPetExperienceGain = Math.max(0, Math.floor(safePlayerExperienceGain * PET_XP_SHARE_FROM_PLAYER));

    if (targetPetExperienceGain <= 0) {
      return {
        applied: false,
        source,
        playerExperienceGain: safePlayerExperienceGain,
        petExperienceGain: 0,
        previousLevel: petState.level,
        newLevel: petState.level,
        leveledUp: false,
        atCap: petState.experience >= getPetExperienceCap()
      };
    }

    const experienceCap = getPetExperienceCap();
    const previousExperience = petState.experience;
    const previousLevel = petState.level;
    const nextExperience = Math.min(experienceCap, previousExperience + targetPetExperienceGain);

    if (nextExperience <= previousExperience) {
      return {
        applied: false,
        source,
        playerExperienceGain: safePlayerExperienceGain,
        petExperienceGain: 0,
        previousLevel,
        newLevel: previousLevel,
        leveledUp: false,
        atCap: true
      };
    }

    const nextLevel = resolvePetLevelFromExperience(nextExperience);
    const nextState = {
      ...petState,
      experience: nextExperience,
      level: nextLevel
    };

    if (nextLevel !== previousLevel) {
      const healthRatio = petState.maxHealth > 0
        ? Math.max(0, Math.min(1, petState.currentHealth / petState.maxHealth))
        : 1;
      const shieldRatio = petState.maxShield > 0
        ? Math.max(0, Math.min(1, petState.currentShield / petState.maxShield))
        : 1;

      const nextStats = getPetStatsForLevel(nextLevel);
      nextState.maxHealth = nextStats.maxHealth;
      nextState.maxShield = nextStats.maxShield;
      nextState.currentHealth = Math.max(0, Math.min(nextStats.maxHealth, Math.round(nextStats.maxHealth * healthRatio)));
      nextState.currentShield = Math.max(0, Math.min(nextStats.maxShield, Math.round(nextStats.maxShield * shieldRatio)));
    }

    const normalizedNextState = normalizePlayerPetState(nextState);
    playerData.petState = normalizedNextState;

    if (normalizedNextState.level > previousLevel) {
      ServerLoggerWrapper.info(
        'PET',
        `Pet level up for player ${playerData.playerId || 'unknown'}: ${previousLevel} -> ${normalizedNextState.level}`
      );
    }

    return {
      applied: true,
      source,
      playerExperienceGain: safePlayerExperienceGain,
      petExperienceGain: normalizedNextState.experience - previousExperience,
      previousLevel,
      newLevel: normalizedNextState.level,
      leveledUp: normalizedNextState.level > previousLevel,
      atCap: normalizedNextState.experience >= experienceCap
    };
  }
}

module.exports = PetProgressionManager;
