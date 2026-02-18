const sharedCraftingConfig = require('../../shared/crafting-config.json');

const RECIPE_EFFECT_TYPES = Object.freeze({
  UNLOCK_PET: 'unlock_pet',
  ADD_PET_MODULE: 'add_pet_module',
  ADD_AMMO: 'add_ammo'
});
const AMMO_TIERS = Object.freeze(['x1', 'x2', 'x3']);

function normalizeCost(rawCost) {
  const normalizedCost = {};
  if (!rawCost || typeof rawCost !== 'object') return normalizedCost;

  for (const [rawType, rawQuantity] of Object.entries(rawCost)) {
    const resourceType = String(rawType || '').trim().toLowerCase();
    if (!resourceType) continue;

    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity)) continue;
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (safeQuantity <= 0) continue;
    normalizedCost[resourceType] = safeQuantity;
  }

  return normalizedCost;
}

function normalizeModule(rawModule) {
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

function normalizePositiveInteger(rawValue, fallback = 1) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function normalizeAmmoTier(rawAmmoTier, fallback = 'x1') {
  const normalizedTier = String(rawAmmoTier || '').trim().toLowerCase();
  if (AMMO_TIERS.includes(normalizedTier)) {
    return normalizedTier;
  }
  return AMMO_TIERS.includes(fallback) ? fallback : 'x1';
}

const CRAFTING_RECIPES = Array.isArray(sharedCraftingConfig.recipes)
  ? sharedCraftingConfig.recipes
    .map((recipe) => {
      const id = String(recipe?.id || '').trim();
      if (!id) return null;

      const effectType = String(recipe?.effect?.type || '').trim().toLowerCase();
      if (!Object.values(RECIPE_EFFECT_TYPES).includes(effectType)) return null;

      const cost = normalizeCost(recipe?.cost);
      if (Object.keys(cost).length === 0) return null;

      const module = effectType === RECIPE_EFFECT_TYPES.ADD_PET_MODULE
        ? normalizeModule(recipe?.effect?.module)
        : null;
      if (effectType === RECIPE_EFFECT_TYPES.ADD_PET_MODULE && !module) return null;
      const quantity = effectType === RECIPE_EFFECT_TYPES.ADD_AMMO
        ? normalizePositiveInteger(recipe?.effect?.quantity, 1)
        : undefined;
      const ammoTier = effectType === RECIPE_EFFECT_TYPES.ADD_AMMO
        ? normalizeAmmoTier(recipe?.effect?.ammoTier, 'x1')
        : undefined;

      const itemId = String(recipe?.itemId || id).trim() || id;
      const displayName = String(recipe?.displayName || itemId).trim() || itemId;
      const description = String(recipe?.description || '').trim();
      const category = String(recipe?.category || 'misc').trim().toLowerCase() || 'misc';

      return {
        id,
        itemId,
        displayName,
        description,
        category,
        cost,
        effect: {
          type: effectType,
          module: module || undefined,
          quantity,
          ammoTier
        }
      };
    })
    .filter((recipe) => !!recipe)
  : [];

const CRAFTING_RECIPE_INDEX = new Map(
  CRAFTING_RECIPES.map((recipe) => [recipe.id, recipe])
);

function listCraftingRecipes() {
  return CRAFTING_RECIPES;
}

function getCraftingRecipeById(recipeId) {
  const normalizedRecipeId = String(recipeId || '').trim();
  if (!normalizedRecipeId) return null;
  return CRAFTING_RECIPE_INDEX.get(normalizedRecipeId) || null;
}

module.exports = {
  RECIPE_EFFECT_TYPES,
  listCraftingRecipes,
  getCraftingRecipeById
};
