const sharedPetConfig = require('../../shared/pets.json');

const RAW_PETS = Array.isArray(sharedPetConfig.pets) ? sharedPetConfig.pets : [];
const PET_IDS = RAW_PETS
  .map((pet) => String(pet?.id || '').trim())
  .filter((petId) => petId.length > 0);

const PET_ID_SET = new Set(PET_IDS);
const PET_DISPLAY_NAME_BY_ID = RAW_PETS.reduce((accumulator, pet) => {
  const petId = String(pet?.id || '').trim();
  if (!petId) return accumulator;

  const displayName = String(pet?.displayName || petId).trim();
  accumulator[petId] = displayName || petId;
  return accumulator;
}, {});

const DEFAULT_PLAYER_PET_ID =
  typeof sharedPetConfig.defaultPetId === 'string' && PET_ID_SET.has(sharedPetConfig.defaultPetId)
    ? sharedPetConfig.defaultPetId
    : (PET_IDS[0] || 'ship50');

const MAX_PET_NICKNAME_LENGTH = Math.max(
  4,
  Math.min(64, Math.floor(Number(sharedPetConfig.petNicknameMaxLength || 24)))
);

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

const MIN_PET_INVENTORY_CAPACITY = 4;
const MAX_PET_INVENTORY_CAPACITY = 32;

function resolvePlayerPetId(preferredPetId) {
  const normalizedPetId = String(preferredPetId || '').trim();
  if (normalizedPetId && PET_ID_SET.has(normalizedPetId)) {
    return normalizedPetId;
  }
  return DEFAULT_PLAYER_PET_ID;
}

function getDefaultPetNicknameForId(petId) {
  const safePetId = resolvePlayerPetId(petId);
  return String(PET_DISPLAY_NAME_BY_ID[safePetId] || safePetId || 'Pet').trim() || 'Pet';
}

function sanitizePetNickname(rawNickname, fallbackPetId = DEFAULT_PLAYER_PET_ID) {
  const fallbackNickname = getDefaultPetNicknameForId(fallbackPetId);

  if (rawNickname === undefined || rawNickname === null) {
    return fallbackNickname;
  }

  const normalizedNickname = String(rawNickname)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PET_NICKNAME_LENGTH)
    .trim();

  return normalizedNickname || fallbackNickname;
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

function normalizePetModuleSlot(rawSlot) {
  if (!rawSlot || typeof rawSlot !== 'object') return undefined;

  const itemId = String(rawSlot.itemId ?? rawSlot.id ?? rawSlot.moduleId ?? '').trim();
  const itemName = String(rawSlot.itemName ?? rawSlot.name ?? '').trim();
  const normalizedItemId = itemId || itemName.toLowerCase().replace(/\s+/g, '_');
  if (!normalizedItemId) return undefined;

  return {
    itemId: normalizedItemId,
    itemName: itemName || normalizedItemId,
    rarity: String(rawSlot.rarity ?? rawSlot.grade ?? 'common').trim().toLowerCase() || 'common',
    level: Math.max(1, Math.floor(Number(rawSlot.level ?? rawSlot.tier ?? 1)))
  };
}

function normalizePetInventory(rawInventory) {
  if (!Array.isArray(rawInventory)) return [];

  const mergedByItemId = new Map();
  for (const rawItem of rawInventory) {
    if (!rawItem || typeof rawItem !== 'object') continue;

    const itemId = String(rawItem.itemId ?? rawItem.id ?? '').trim();
    const itemName = String(rawItem.itemName ?? rawItem.name ?? '').trim();
    const normalizedItemId = itemId || itemName.toLowerCase().replace(/\s+/g, '_');
    if (!normalizedItemId) continue;

    const normalizedItemName = itemName || normalizedItemId;
    const quantity = Math.max(1, Math.floor(Number(rawItem.quantity ?? rawItem.count ?? 1)));
    const rarity = String(rawItem.rarity ?? rawItem.grade ?? 'common').trim().toLowerCase() || 'common';

    const current = mergedByItemId.get(normalizedItemId);
    if (!current) {
      mergedByItemId.set(normalizedItemId, {
        itemId: normalizedItemId,
        itemName: normalizedItemName,
        quantity,
        rarity
      });
      continue;
    }

    current.quantity += quantity;
    if (!current.itemName && normalizedItemName) current.itemName = normalizedItemName;
    if (!current.rarity && rarity) current.rarity = rarity;
  }

  return Array.from(mergedByItemId.values());
}

function normalizePetInventoryCapacity(rawCapacity, minimumCapacity = MIN_PET_INVENTORY_CAPACITY) {
  const safeMinimum = Math.max(MIN_PET_INVENTORY_CAPACITY, Math.floor(Number(minimumCapacity || MIN_PET_INVENTORY_CAPACITY)));
  return clampInteger(rawCapacity, safeMinimum, MAX_PET_INVENTORY_CAPACITY);
}

function createDefaultPlayerPetState(preferredPetId) {
  const petId = resolvePlayerPetId(preferredPetId);
  const stats = getPetStatsForLevel(1);
  const petNickname = sanitizePetNickname(undefined, petId);

  return {
    petId,
    petNickname,
    level: 1,
    experience: 0,
    maxLevel: MAX_PET_LEVEL,
    currentHealth: stats.maxHealth,
    maxHealth: stats.maxHealth,
    currentShield: stats.maxShield,
    maxShield: stats.maxShield,
    isActive: true,
    moduleSlot: undefined,
    inventory: [],
    inventoryCapacity: 8
  };
}

function normalizePlayerPetState(rawState, options = {}) {
  if (!rawState || typeof rawState !== 'object') {
    return createDefaultPlayerPetState(options.preferredPetId);
  }

  const petId = resolvePlayerPetId(
    rawState.petId || rawState.pet_id || options.preferredPetId
  );
  const petNickname = sanitizePetNickname(
    rawState.petNickname ?? rawState.pet_nickname,
    petId
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
  const moduleSlot = normalizePetModuleSlot(
    rawState.moduleSlot
    ?? rawState.module
    ?? rawState.module_slot
    ?? rawState.petModuleSlot
    ?? rawState.pet_module_slot
  );
  const inventory = normalizePetInventory(
    rawState.inventory
    ?? rawState.petInventory
    ?? rawState.pet_inventory
    ?? rawState.cargo
  );
  const inventoryCapacity = normalizePetInventoryCapacity(
    rawState.inventoryCapacity
    ?? rawState.inventory_capacity
    ?? rawState.petInventoryCapacity
    ?? rawState.pet_inventory_capacity,
    Math.max(inventory.length, 8)
  );

  return {
    petId,
    petNickname,
    level,
    experience,
    maxLevel: MAX_PET_LEVEL,
    currentHealth,
    maxHealth: stats.maxHealth,
    currentShield,
    maxShield: stats.maxShield,
    isActive: rawState.isActive === undefined ? true : Boolean(rawState.isActive),
    moduleSlot,
    inventory,
    inventoryCapacity
  };
}

function buildPetStateSignature(petState) {
  const normalizedState = normalizePlayerPetState(petState);
  return JSON.stringify([
    normalizedState.petId,
    normalizedState.petNickname,
    normalizedState.level,
    normalizedState.experience,
    normalizedState.maxLevel,
    normalizedState.currentHealth,
    normalizedState.maxHealth,
    normalizedState.currentShield,
    normalizedState.maxShield,
    normalizedState.isActive,
    JSON.stringify(normalizedState.moduleSlot || null),
    JSON.stringify(normalizedState.inventory || []),
    Math.max(0, Math.floor(Number(normalizedState.inventoryCapacity || 0)))
  ]);
}

module.exports = {
  DEFAULT_PLAYER_PET_ID,
  MAX_PET_LEVEL,
  MAX_PET_NICKNAME_LENGTH,
  PET_XP_SHARE_FROM_PLAYER,
  getPetExperienceRequirement,
  getPetExperienceCap,
  resolvePetLevelFromExperience,
  getPetStatsForLevel,
  resolvePlayerPetId,
  sanitizePetNickname,
  createDefaultPlayerPetState,
  normalizePlayerPetState,
  buildPetStateSignature
};
