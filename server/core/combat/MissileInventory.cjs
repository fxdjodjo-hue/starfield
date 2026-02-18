const MISSILE_TIERS = Object.freeze(['m1', 'm2', 'm3']);
const DEFAULT_MISSILE_TIER = 'm1';

const MISSILE_DAMAGE_MULTIPLIERS = Object.freeze({
    m1: 1,
    m2: 2,
    m3: 3
});

function normalizeMissileTier(rawTier, fallbackTier = DEFAULT_MISSILE_TIER) {
    const normalizedTier = String(rawTier || '').trim().toLowerCase();
    if (MISSILE_TIERS.includes(normalizedTier)) {
        return normalizedTier;
    }
    return MISSILE_TIERS.includes(fallbackTier) ? fallbackTier : DEFAULT_MISSILE_TIER;
}

function normalizeMissileQuantity(rawQuantity) {
    const parsedQuantity = Number(rawQuantity);
    if (!Number.isFinite(parsedQuantity)) return 0;
    return Math.max(0, Math.floor(parsedQuantity));
}

function normalizeMissileInventory(rawMissileInventory) {
    const sourceInventory = rawMissileInventory && typeof rawMissileInventory === 'object'
        ? rawMissileInventory
        : {};
    const sourceTiers = sourceInventory.tiers && typeof sourceInventory.tiers === 'object'
        ? sourceInventory.tiers
        : sourceInventory;

    const normalizedTiers = {
        m1: 0,
        m2: 0,
        m3: 0
    };

    for (const tier of MISSILE_TIERS) {
        normalizedTiers[tier] = normalizeMissileQuantity(sourceTiers[tier]);
    }

    return {
        selectedTier: normalizeMissileTier(sourceInventory.selectedTier, DEFAULT_MISSILE_TIER),
        tiers: normalizedTiers
    };
}

function getMissileCountForTier(missileInventory, missileTier) {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    const normalizedTier = normalizeMissileTier(missileTier, normalizedInventory.selectedTier);
    return normalizeMissileQuantity(normalizedInventory.tiers[normalizedTier]);
}

function getSelectedMissileCount(missileInventory) {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    return getMissileCountForTier(normalizedInventory, normalizedInventory.selectedTier);
}

function setSelectedMissileTier(missileInventory, missileTier) {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    return {
        selectedTier: normalizeMissileTier(missileTier, normalizedInventory.selectedTier),
        tiers: {
            ...normalizedInventory.tiers
        }
    };
}

function addMissileAmmo(missileInventory, missileTier, quantity) {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    const normalizedTier = normalizeMissileTier(missileTier, normalizedInventory.selectedTier);
    const normalizedQuantity = normalizeMissileQuantity(quantity);

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

function consumeSelectedMissile(missileInventory) {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    const selectedTier = normalizeMissileTier(normalizedInventory.selectedTier);
    const selectedTierQuantity = normalizeMissileQuantity(normalizedInventory.tiers[selectedTier]);

    if (selectedTierQuantity <= 0) {
        return {
            ok: false,
            selectedTier,
            remaining: 0,
            missileInventory: normalizedInventory
        };
    }

    return {
        ok: true,
        selectedTier,
        remaining: selectedTierQuantity - 1,
        missileInventory: {
            selectedTier,
            tiers: {
                ...normalizedInventory.tiers,
                [selectedTier]: selectedTierQuantity - 1
            }
        }
    };
}

function getDamageMultiplierForMissileTier(missileTier) {
    const normalizedTier = normalizeMissileTier(missileTier);
    return Number(MISSILE_DAMAGE_MULTIPLIERS[normalizedTier] || MISSILE_DAMAGE_MULTIPLIERS[DEFAULT_MISSILE_TIER] || 1);
}

module.exports = {
    MISSILE_TIERS,
    DEFAULT_MISSILE_TIER,
    MISSILE_DAMAGE_MULTIPLIERS,
    normalizeMissileTier,
    normalizeMissileQuantity,
    normalizeMissileInventory,
    getMissileCountForTier,
    getSelectedMissileCount,
    setSelectedMissileTier,
    addMissileAmmo,
    consumeSelectedMissile,
    getDamageMultiplierForMissileTier
};
