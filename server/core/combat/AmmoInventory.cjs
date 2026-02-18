const AMMO_TIERS = Object.freeze(['x1', 'x2', 'x3']);
const DEFAULT_AMMO_TIER = 'x1';

const AMMO_DAMAGE_MULTIPLIERS = Object.freeze({
  x1: 1,
  x2: 2,
  x3: 3
});

function normalizeAmmoTier(rawTier, fallbackTier = DEFAULT_AMMO_TIER) {
  const normalizedTier = String(rawTier || '').trim().toLowerCase();
  if (AMMO_TIERS.includes(normalizedTier)) {
    return normalizedTier;
  }
  return AMMO_TIERS.includes(fallbackTier) ? fallbackTier : DEFAULT_AMMO_TIER;
}

function normalizeAmmoQuantity(rawQuantity) {
  const parsedQuantity = Number(rawQuantity);
  if (!Number.isFinite(parsedQuantity)) return 0;
  return Math.max(0, Math.floor(parsedQuantity));
}

function normalizeAmmoInventory(rawAmmoInventory, legacyAmmoValue) {
  const sourceInventory = rawAmmoInventory && typeof rawAmmoInventory === 'object'
    ? rawAmmoInventory
    : {};
  const sourceTiers = sourceInventory.tiers && typeof sourceInventory.tiers === 'object'
    ? sourceInventory.tiers
    : sourceInventory;
  const fallbackX1 = normalizeAmmoQuantity(legacyAmmoValue);

  const normalizedTiers = {
    x1: 0,
    x2: 0,
    x3: 0
  };

  for (const tier of AMMO_TIERS) {
    const hasExplicitValue = Number.isFinite(Number(sourceTiers[tier]));
    if (tier === 'x1' && !hasExplicitValue && fallbackX1 > 0) {
      normalizedTiers[tier] = fallbackX1;
      continue;
    }
    normalizedTiers[tier] = normalizeAmmoQuantity(sourceTiers[tier]);
  }

  return {
    selectedTier: normalizeAmmoTier(sourceInventory.selectedTier, DEFAULT_AMMO_TIER),
    tiers: normalizedTiers
  };
}

function getAmmoCountForTier(ammoInventory, ammoTier) {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  const normalizedTier = normalizeAmmoTier(ammoTier, normalizedInventory.selectedTier);
  return normalizeAmmoQuantity(normalizedInventory.tiers[normalizedTier]);
}

function getSelectedAmmoCount(ammoInventory) {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  return getAmmoCountForTier(normalizedInventory, normalizedInventory.selectedTier);
}

function getLegacyAmmoValue(ammoInventory) {
  return getAmmoCountForTier(ammoInventory, 'x1');
}

function setSelectedAmmoTier(ammoInventory, ammoTier) {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  return {
    selectedTier: normalizeAmmoTier(ammoTier, normalizedInventory.selectedTier),
    tiers: {
      ...normalizedInventory.tiers
    }
  };
}

function addAmmo(ammoInventory, ammoTier, quantity) {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  const normalizedTier = normalizeAmmoTier(ammoTier, normalizedInventory.selectedTier);
  const normalizedQuantity = normalizeAmmoQuantity(quantity);

  if (normalizedQuantity <= 0) {
    return normalizedInventory;
  }

  return {
    selectedTier: normalizedInventory.selectedTier,
    tiers: {
      ...normalizedInventory.tiers,
      [normalizedTier]: normalizedInventory.tiers[normalizedTier] + normalizedQuantity
    }
  };
}

function consumeSelectedAmmo(ammoInventory) {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  const selectedTier = normalizeAmmoTier(normalizedInventory.selectedTier);
  const selectedTierQuantity = normalizeAmmoQuantity(normalizedInventory.tiers[selectedTier]);

  if (selectedTierQuantity <= 0) {
    return {
      ok: false,
      selectedTier,
      remaining: 0,
      ammoInventory: normalizedInventory
    };
  }

  return {
    ok: true,
    selectedTier,
    remaining: selectedTierQuantity - 1,
    ammoInventory: {
      selectedTier,
      tiers: {
        ...normalizedInventory.tiers,
        [selectedTier]: selectedTierQuantity - 1
      }
    }
  };
}

function getDamageMultiplierForTier(ammoTier) {
  const normalizedTier = normalizeAmmoTier(ammoTier);
  return Number(AMMO_DAMAGE_MULTIPLIERS[normalizedTier] || AMMO_DAMAGE_MULTIPLIERS[DEFAULT_AMMO_TIER] || 1);
}

module.exports = {
  AMMO_TIERS,
  DEFAULT_AMMO_TIER,
  AMMO_DAMAGE_MULTIPLIERS,
  normalizeAmmoTier,
  normalizeAmmoQuantity,
  normalizeAmmoInventory,
  getAmmoCountForTier,
  getSelectedAmmoCount,
  getLegacyAmmoValue,
  setSelectedAmmoTier,
  addAmmo,
  consumeSelectedAmmo,
  getDamageMultiplierForTier
};
