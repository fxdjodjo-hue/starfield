import type { MissileTier, MissileInventoryPayload } from '../../../config/NetworkConfig';

export const MISSILE_TIERS: MissileTier[] = ['m1', 'm2', 'm3'];
export const DEFAULT_MISSILE_TIER: MissileTier = 'm1';

export const MISSILE_DAMAGE_MULTIPLIERS: Record<MissileTier, number> = {
    m1: 1,
    m2: 2,
    m3: 3
};

export function normalizeMissileTier(rawTier: any, fallbackTier: MissileTier = DEFAULT_MISSILE_TIER): MissileTier {
    const normalizedTier = String(rawTier || '').trim().toLowerCase();
    if (MISSILE_TIERS.includes(normalizedTier as MissileTier)) {
        return normalizedTier as MissileTier;
    }
    return MISSILE_TIERS.includes(fallbackTier) ? fallbackTier : DEFAULT_MISSILE_TIER;
}

export function normalizeMissileQuantity(rawQuantity: any): number {
    const parsedQuantity = Number(rawQuantity);
    if (!Number.isFinite(parsedQuantity)) return 0;
    return Math.max(0, Math.floor(parsedQuantity));
}

export function normalizeMissileInventory(rawMissileInventory: any): MissileInventoryPayload {
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

export function getMissileCountForTier(missileInventory: MissileInventoryPayload | undefined, missileTier: MissileTier): number {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    const normalizedTier = normalizeMissileTier(missileTier, normalizedInventory.selectedTier);
    return normalizeMissileQuantity(normalizedInventory.tiers[normalizedTier]);
}

export function getSelectedMissileCount(missileInventory: MissileInventoryPayload | undefined): number {
    const normalizedInventory = normalizeMissileInventory(missileInventory);
    return getMissileCountForTier(normalizedInventory, normalizedInventory.selectedTier);
}

export function consumeSelectedMissile(missileInventory: MissileInventoryPayload): {
    ok: boolean;
    selectedTier: MissileTier;
    remaining: number;
    missileInventory: MissileInventoryPayload;
} {
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

export function getDamageMultiplierForMissileTier(missileTier: MissileTier): number {
    const normalizedTier = normalizeMissileTier(missileTier);
    return Number(MISSILE_DAMAGE_MULTIPLIERS[normalizedTier] || 1);
}
