import CRAFTING_CONFIG from '../../shared/crafting-config.json';

export interface CraftingRecipeCost {
  [resourceType: string]: number;
}

export interface CraftingModuleDefinition {
  itemId: string;
  itemName: string;
  rarity: string;
  level: number;
}

export type CraftingEffectType = 'unlock_pet' | 'add_pet_module';

export interface CraftingRecipe {
  id: string;
  itemId: string;
  displayName: string;
  description: string;
  category: string;
  cost: CraftingRecipeCost;
  effect: {
    type: CraftingEffectType;
    module?: CraftingModuleDefinition;
  };
}

interface SharedCraftingRecipe {
  id?: string;
  itemId?: string;
  displayName?: string;
  description?: string;
  category?: string;
  cost?: Record<string, unknown>;
  effect?: {
    type?: unknown;
    module?: {
      itemId?: unknown;
      itemName?: unknown;
      rarity?: unknown;
      level?: unknown;
    };
  };
}

interface SharedCraftingConfig {
  recipes?: SharedCraftingRecipe[];
}

type SharedCraftingModule = NonNullable<NonNullable<SharedCraftingRecipe['effect']>['module']>;

const SHARED_CRAFTING_CONFIG = CRAFTING_CONFIG as SharedCraftingConfig;

function normalizeResourceCost(rawCost: Record<string, unknown> | null | undefined): CraftingRecipeCost {
  const normalizedCost: CraftingRecipeCost = {};
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

function normalizeModuleDefinition(rawModule: SharedCraftingModule | null | undefined): CraftingModuleDefinition | undefined {
  if (!rawModule || typeof rawModule !== 'object') return undefined;

  const itemId = String(rawModule.itemId ?? '').trim();
  const itemName = String(rawModule.itemName ?? '').trim();
  const normalizedItemId = itemId || itemName.toLowerCase().replace(/\s+/g, '_');
  if (!normalizedItemId) return undefined;

  const normalizedItemName = itemName || normalizedItemId;
  const rarity = String(rawModule.rarity ?? 'common').trim().toLowerCase() || 'common';
  const level = Math.max(1, Math.floor(Number(rawModule.level ?? 1)));

  return {
    itemId: normalizedItemId,
    itemName: normalizedItemName,
    rarity,
    level
  };
}

const CRAFTING_RECIPES: CraftingRecipe[] = Array.isArray(SHARED_CRAFTING_CONFIG.recipes)
  ? SHARED_CRAFTING_CONFIG.recipes
    .map((recipe) => {
      const id = String(recipe?.id || '').trim();
      if (!id) return null;

      const effectType = String(recipe?.effect?.type || '').trim().toLowerCase();
      if (effectType !== 'unlock_pet' && effectType !== 'add_pet_module') return null;

      const module = effectType === 'add_pet_module'
        ? normalizeModuleDefinition(recipe?.effect?.module)
        : undefined;
      if (effectType === 'add_pet_module' && !module) return null;

      const itemId = String(recipe?.itemId || id).trim() || id;
      const displayName = String(recipe?.displayName || itemId).trim() || itemId;
      const description = String(recipe?.description || '').trim();
      const category = String(recipe?.category || 'misc').trim().toLowerCase() || 'misc';
      const cost = normalizeResourceCost(recipe?.cost || null);
      if (Object.keys(cost).length === 0) return null;

      return {
        id,
        itemId,
        displayName,
        description,
        category,
        cost,
        effect: {
          type: effectType,
          module
        }
      } as CraftingRecipe;
    })
    .filter((recipe): recipe is CraftingRecipe => !!recipe)
  : [];

const CRAFTING_RECIPE_INDEX = new Map<string, CraftingRecipe>(
  CRAFTING_RECIPES.map((recipe) => [recipe.id, recipe])
);

export function listCraftingRecipes(): CraftingRecipe[] {
  return CRAFTING_RECIPES;
}

export function getCraftingRecipeById(recipeId: string): CraftingRecipe | null {
  const normalizedRecipeId = String(recipeId || '').trim();
  if (!normalizedRecipeId) return null;
  return CRAFTING_RECIPE_INDEX.get(normalizedRecipeId) || null;
}
