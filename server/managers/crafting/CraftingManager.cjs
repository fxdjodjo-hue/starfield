const { getCraftingRecipeById, RECIPE_EFFECT_TYPES } = require('../../config/CraftingCatalog.cjs');
const { normalizePlayerPetState } = require('../../config/PetCatalog.cjs');
const {
  normalizeAmmoInventory,
  addAmmo,
  normalizeAmmoTier,
  getLegacyAmmoValue
} = require('../../core/combat/AmmoInventory.cjs');

function normalizeResourceInventory(resourceInventory) {
  const normalizedInventory = {};
  if (!resourceInventory || typeof resourceInventory !== 'object') {
    return normalizedInventory;
  }

  for (const [rawType, rawQuantity] of Object.entries(resourceInventory)) {
    const resourceType = String(rawType || '').trim().toLowerCase();
    if (!resourceType) continue;

    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity)) continue;
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (safeQuantity <= 0) continue;
    normalizedInventory[resourceType] = safeQuantity;
  }

  return normalizedInventory;
}

function hasVisiblePet(petState) {
  const petId = String(petState?.petId || '').trim();
  return petId.length > 0 && petState?.isActive !== false;
}

function normalizePetModuleEntry(rawModule) {
  if (!rawModule || typeof rawModule !== 'object') return null;

  const itemId = String(rawModule.itemId || '').trim();
  const itemName = String(rawModule.itemName || '').trim();
  const normalizedItemId = itemId || itemName.toLowerCase().replace(/\s+/g, '_');
  if (!normalizedItemId) return null;

  return {
    itemId: normalizedItemId,
    itemName: itemName || normalizedItemId,
    rarity: String(rawModule.rarity || 'common').trim().toLowerCase() || 'common',
    level: Math.max(1, Math.floor(Number(rawModule.level || 1)))
  };
}

function buildAmmoSignature(ammoInventory) {
  const normalized = normalizeAmmoInventory(ammoInventory);
  return JSON.stringify({
    selectedTier: normalized.selectedTier,
    tiers: normalized.tiers
  });
}

class CraftingManager {
  craft(playerData, recipeId) {
    if (!playerData || typeof playerData !== 'object') {
      return {
        ok: false,
        code: 'CRAFT_PLAYER_INVALID',
        message: 'Player data not available.'
      };
    }

    const recipe = getCraftingRecipeById(recipeId);
    if (!recipe) {
      return {
        ok: false,
        code: 'CRAFT_RECIPE_UNKNOWN',
        message: 'Unknown crafting recipe.'
      };
    }

    const currentResourceInventory = normalizeResourceInventory(playerData.resourceInventory);
    const missingResources = [];
    for (const [resourceType, requiredQuantity] of Object.entries(recipe.cost || {})) {
      const ownedQuantity = Math.max(0, Math.floor(Number(currentResourceInventory[resourceType] || 0)));
      if (ownedQuantity < requiredQuantity) {
        missingResources.push({
          resourceType,
          required: requiredQuantity,
          owned: ownedQuantity
        });
      }
    }

    if (missingResources.length > 0) {
      return {
        ok: false,
        code: 'CRAFT_RESOURCES_MISSING',
        message: 'Not enough resources for crafting.',
        recipe,
        missingResources
      };
    }

    if (!playerData.inventory || typeof playerData.inventory !== 'object') {
      playerData.inventory = {};
    }

    const previousPetState = normalizePlayerPetState(playerData.petState);
    const previousPetVisibility = hasVisiblePet(previousPetState);
    let nextPetState = previousPetState;
    const previousAmmoInventory = normalizeAmmoInventory(playerData.inventory?.ammo, playerData.ammo);
    let nextAmmoInventory = previousAmmoInventory;

    if (recipe.effect.type === RECIPE_EFFECT_TYPES.UNLOCK_PET) {
      if (previousPetVisibility) {
        return {
          ok: false,
          code: 'CRAFT_PET_ALREADY_UNLOCKED',
          message: 'Pet is already unlocked.',
          recipe
        };
      }

      nextPetState = normalizePlayerPetState({
        ...previousPetState,
        isActive: true
      });
    } else if (recipe.effect.type === RECIPE_EFFECT_TYPES.ADD_PET_MODULE) {
      if (!previousPetVisibility) {
        return {
          ok: false,
          code: 'CRAFT_PET_LOCKED',
          message: 'Unlock the pet before crafting modules.',
          recipe
        };
      }

      const moduleEntry = normalizePetModuleEntry(recipe.effect.module);
      if (!moduleEntry) {
        return {
          ok: false,
          code: 'CRAFT_MODULE_INVALID',
          message: 'Invalid module recipe configuration.',
          recipe
        };
      }

      const currentInventory = Array.isArray(previousPetState.inventory)
        ? previousPetState.inventory
          .map((item) => ({
            itemId: String(item?.itemId || '').trim(),
            itemName: String(item?.itemName || '').trim(),
            quantity: Math.max(1, Math.floor(Number(item?.quantity || 1))),
            rarity: String(item?.rarity || 'common').trim().toLowerCase() || 'common'
          }))
          .filter((item) => item.itemId.length > 0 || item.itemName.length > 0)
        : [];

      const existingIndex = currentInventory.findIndex((item) => {
        const itemId = String(item.itemId || '').trim();
        return itemId.length > 0 && itemId === moduleEntry.itemId;
      });

      if (existingIndex >= 0) {
        currentInventory[existingIndex].quantity += 1;
      } else {
        currentInventory.push({
          itemId: moduleEntry.itemId,
          itemName: moduleEntry.itemName,
          quantity: 1,
          rarity: moduleEntry.rarity
        });
      }

      nextPetState = normalizePlayerPetState({
        ...previousPetState,
        moduleSlot: previousPetState.moduleSlot,
        inventory: currentInventory,
        inventoryCapacity: Math.max(
          currentInventory.length,
          Math.floor(Number(previousPetState.inventoryCapacity || 8))
        )
      });
    } else if (recipe.effect.type === RECIPE_EFFECT_TYPES.ADD_AMMO) {
      const ammoQuantity = Math.max(0, Math.floor(Number(recipe?.effect?.quantity || 0)));
      if (ammoQuantity <= 0) {
        return {
          ok: false,
          code: 'CRAFT_AMMO_INVALID',
          message: 'Invalid ammo recipe configuration.',
          recipe
        };
      }

      const ammoTier = normalizeAmmoTier(recipe?.effect?.ammoTier, 'x1');
      nextAmmoInventory = addAmmo(nextAmmoInventory, ammoTier, ammoQuantity);
    }

    const nextResourceInventory = { ...currentResourceInventory };
    for (const [resourceType, requiredQuantity] of Object.entries(recipe.cost || {})) {
      const ownedQuantity = Math.max(0, Math.floor(Number(nextResourceInventory[resourceType] || 0)));
      const remainingQuantity = Math.max(0, ownedQuantity - Math.max(0, Math.floor(Number(requiredQuantity || 0))));
      if (remainingQuantity > 0) {
        nextResourceInventory[resourceType] = remainingQuantity;
      } else {
        delete nextResourceInventory[resourceType];
      }
    }

    playerData.resourceInventory = nextResourceInventory;
    playerData.petState = nextPetState;
    playerData.inventory.ammo = normalizeAmmoInventory(nextAmmoInventory);
    // Legacy mirror kept for compatibility with older code paths.
    playerData.ammo = getLegacyAmmoValue(playerData.inventory.ammo);

    const nextAmmoSignature = buildAmmoSignature(playerData.inventory.ammo);
    const previousAmmoSignature = buildAmmoSignature(previousAmmoInventory);

    return {
      ok: true,
      code: 'CRAFT_SUCCESS',
      recipe,
      resourceInventory: nextResourceInventory,
      petState: nextPetState,
      petVisibilityChanged: hasVisiblePet(nextPetState) !== previousPetVisibility,
      ammoInventory: playerData.inventory.ammo,
      ammoChanged: nextAmmoSignature !== previousAmmoSignature
    };
  }
}

module.exports = CraftingManager;
