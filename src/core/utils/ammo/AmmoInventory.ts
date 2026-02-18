import type { AmmoInventoryPayload, AmmoTier } from '../../../config/NetworkConfig';

export const AMMO_TIERS: AmmoTier[] = ['x1', 'x2', 'x3'];
export const DEFAULT_AMMO_TIER: AmmoTier = 'x1';

function normalizeAmmoCount(rawValue: unknown): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) return 0;
  return Math.max(0, Math.floor(parsedValue));
}

export function normalizeAmmoTier(rawTier: unknown, fallbackTier: AmmoTier = DEFAULT_AMMO_TIER): AmmoTier {
  const normalizedTier = String(rawTier ?? '').trim().toLowerCase();
  if (normalizedTier === 'x1' || normalizedTier === 'x2' || normalizedTier === 'x3') {
    return normalizedTier;
  }
  return fallbackTier;
}

export function normalizeAmmoInventory(rawAmmoInventory: unknown, legacyAmmo?: unknown): AmmoInventoryPayload {
  const source = rawAmmoInventory && typeof rawAmmoInventory === 'object'
    ? rawAmmoInventory as Record<string, unknown>
    : {};
  const sourceTiers = source.tiers && typeof source.tiers === 'object'
    ? source.tiers as Record<string, unknown>
    : source;
  const fallbackX1 = normalizeAmmoCount(legacyAmmo);

  const hasExplicitX1 = Number.isFinite(Number(sourceTiers.x1));
  const x1Count = hasExplicitX1 ? normalizeAmmoCount(sourceTiers.x1) : fallbackX1;

  return {
    selectedTier: normalizeAmmoTier(source.selectedTier, DEFAULT_AMMO_TIER),
    tiers: {
      x1: x1Count,
      x2: normalizeAmmoCount(sourceTiers.x2),
      x3: normalizeAmmoCount(sourceTiers.x3)
    }
  };
}

export function getAmmoCountForTier(ammoInventory: AmmoInventoryPayload | null | undefined, tier: AmmoTier): number {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  return normalizeAmmoCount(normalizedInventory.tiers[tier]);
}

export function getSelectedAmmoCount(ammoInventory: AmmoInventoryPayload | null | undefined): number {
  const normalizedInventory = normalizeAmmoInventory(ammoInventory);
  return getAmmoCountForTier(normalizedInventory, normalizedInventory.selectedTier);
}

