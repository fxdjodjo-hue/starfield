const sharedPetConfig = require('../../shared/pets.json');

const RAW_PETS = Array.isArray(sharedPetConfig.pets) ? sharedPetConfig.pets : [];
const PET_IDS = RAW_PETS
  .map((pet) => String(pet?.id || '').trim())
  .filter((petId) => petId.length > 0);

const PET_ID_SET = new Set(PET_IDS);

const DEFAULT_PLAYER_PET_ID =
  typeof sharedPetConfig.defaultPetId === 'string' && PET_ID_SET.has(sharedPetConfig.defaultPetId)
    ? sharedPetConfig.defaultPetId
    : (PET_IDS[0] || 'ship50');

const RAW_PROGRESSION = sharedPetConfig.progression && typeof sharedPetConfig.progression === 'object'
  ? sharedPetConfig.progression
  : {};

const MAX_PET_LEVEL = Math.max(1, Math.min(100, Math.floor(Number(RAW_PROGRESSION.maxLevel || 15))));
const PET_XP_SHARE_FROM_PLAYER = Math.max(0, Math.min(1, Number(RAW_PROGRESSION.xpShareFromPlayer || 0.2)));

const RAW_LEVEL_REQUIREMENTS = RAW_PROGRESSION.levelRequirements && typeof RAW_PROGRESSION.levelRequirements === 'object'
  ? RAW_PROGRESSION.levelRequirements
  : {};

function clampInteger(value, min, max) {
  if (!Number.isFinite(Number(value))) return min;
  const parsed = Math.floor(Number(value));
  return Math.max(min, Math.min(max, parsed));
}

function buildLevelRequirementsByLevel(maxLevel, rawRequirements) {
  const requirements = {};
  let previousRequirement = 0;
  let previousIncrement = Math.max(1, Math.floor(Number(rawRequirements[2] || 2000)));

  for (let level = 2; level <= maxLevel; level++) {
    const rawRequirement = Number(rawRequirements[level]);
    let levelRequirement;

    if (Number.isFinite(rawRequirement)) {
      levelRequirement = Math.max(previousRequirement + 1, Math.floor(rawRequirement));
      previousIncrement = Math.max(1, levelRequirement - previousRequirement);
    } else {
      levelRequirement = previousRequirement + previousIncrement;
      previousIncrement = Math.max(1, previousIncrement * 2);
    }

    requirements[level] = levelRequirement;
    previousRequirement = levelRequirement;
  }

  return requirements;
}

const PET_LEVEL_REQUIREMENTS = buildLevelRequirementsByLevel(MAX_PET_LEVEL, RAW_LEVEL_REQUIREMENTS);

const BASE_PET_HEALTH = Math.max(
  1,
  Math.floor(Number(RAW_PROGRESSION.baseStats?.health || 6000))
);
const BASE_PET_SHIELD = Math.max(
  0,
  Math.floor(Number(RAW_PROGRESSION.baseStats?.shield || 3000))
);

const PET_HEALTH_MULTIPLIER_PER_LEVEL = Math.max(
  1,
  Number(RAW_PROGRESSION.growth?.healthMultiplierPerLevel || 1.11)
);
const PET_SHIELD_MULTIPLIER_PER_LEVEL = Math.max(
  1,
  Number(RAW_PROGRESSION.growth?.shieldMultiplierPerLevel || 1.1)
);

function resolvePlayerPetId(preferredPetId) {
  const normalizedPetId = String(preferredPetId || '').trim();
  if (normalizedPetId && PET_ID_SET.has(normalizedPetId)) {
    return normalizedPetId;
  }
  return DEFAULT_PLAYER_PET_ID;
}

function getPetExperienceRequirement(level) {
  const safeLevel = clampInteger(level, 1, MAX_PET_LEVEL);
  if (safeLevel <= 1) return 0;
  return Number(PET_LEVEL_REQUIREMENTS[safeLevel] || 0);
}

function getPetExperienceCap() {
  return getPetExperienceRequirement(MAX_PET_LEVEL);
}

function resolvePetLevelFromExperience(totalExperience) {
  const safeExperience = Math.max(0, Math.floor(Number(totalExperience || 0)));
  let level = 1;

  for (let nextLevel = 2; nextLevel <= MAX_PET_LEVEL; nextLevel++) {
    const requiredExperience = getPetExperienceRequirement(nextLevel);
    if (safeExperience >= requiredExperience) {
      level = nextLevel;
      continue;
    }
    break;
  }

  return level;
}

function getPetStatsForLevel(level) {
  const safeLevel = clampInteger(level, 1, MAX_PET_LEVEL);
  const growthStep = Math.max(0, safeLevel - 1);

  return {
    maxHealth: Math.max(
      1,
      Math.floor(BASE_PET_HEALTH * Math.pow(PET_HEALTH_MULTIPLIER_PER_LEVEL, growthStep))
    ),
    maxShield: Math.max(
      0,
      Math.floor(BASE_PET_SHIELD * Math.pow(PET_SHIELD_MULTIPLIER_PER_LEVEL, growthStep))
    )
  };
}

function createDefaultPlayerPetState(preferredPetId) {
  const petId = resolvePlayerPetId(preferredPetId);
  const stats = getPetStatsForLevel(1);

  return {
    petId,
    level: 1,
    experience: 0,
    maxLevel: MAX_PET_LEVEL,
    currentHealth: stats.maxHealth,
    maxHealth: stats.maxHealth,
    currentShield: stats.maxShield,
    maxShield: stats.maxShield,
    isActive: true
  };
}

function normalizePlayerPetState(rawState, options = {}) {
  if (!rawState || typeof rawState !== 'object') {
    return createDefaultPlayerPetState(options.preferredPetId);
  }

  const petId = resolvePlayerPetId(
    rawState.petId || rawState.pet_id || options.preferredPetId
  );
  const experience = clampInteger(
    Number(rawState.experience ?? rawState.exp ?? 0),
    0,
    getPetExperienceCap()
  );
  const level = resolvePetLevelFromExperience(experience);
  const stats = getPetStatsForLevel(level);

  const parsedCurrentHealth = Number(rawState.currentHealth ?? rawState.current_health);
  const parsedCurrentShield = Number(rawState.currentShield ?? rawState.current_shield);

  const currentHealth = Number.isFinite(parsedCurrentHealth)
    ? clampInteger(parsedCurrentHealth, 0, stats.maxHealth)
    : stats.maxHealth;
  const currentShield = Number.isFinite(parsedCurrentShield)
    ? clampInteger(parsedCurrentShield, 0, stats.maxShield)
    : stats.maxShield;

  return {
    petId,
    level,
    experience,
    maxLevel: MAX_PET_LEVEL,
    currentHealth,
    maxHealth: stats.maxHealth,
    currentShield,
    maxShield: stats.maxShield,
    isActive: rawState.isActive === undefined ? true : Boolean(rawState.isActive)
  };
}

function buildPetStateSignature(petState) {
  const normalizedState = normalizePlayerPetState(petState);
  return JSON.stringify([
    normalizedState.petId,
    normalizedState.level,
    normalizedState.experience,
    normalizedState.maxLevel,
    normalizedState.currentHealth,
    normalizedState.maxHealth,
    normalizedState.currentShield,
    normalizedState.maxShield,
    normalizedState.isActive
  ]);
}

module.exports = {
  DEFAULT_PLAYER_PET_ID,
  MAX_PET_LEVEL,
  PET_XP_SHARE_FROM_PLAYER,
  getPetExperienceRequirement,
  getPetExperienceCap,
  resolvePetLevelFromExperience,
  getPetStatsForLevel,
  resolvePlayerPetId,
  createDefaultPlayerPetState,
  normalizePlayerPetState,
  buildPetStateSignature
};
