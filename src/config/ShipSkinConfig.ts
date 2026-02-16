import SHIP_SKIN_PRICING_CONFIG from '../../shared/ship-skins.json';

export interface ShipSkinPreviewConfig {
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  totalFrames: number;
  columns: number;
  spacingX: number;
  spacingY: number;
  offsetX: number;
  offsetY: number;
  displayScale: number;
}

export interface ShipSkinEngineFlameConfig {
  backwardOffset: number;
  horizontalOffsetBonus: number;
  flameScale: number;
  lateralOffset?: number;
}

export interface PlayerShipSkinDefinition {
  id: string;
  displayName: string;
  basePath: string;
  // Default currency for current skins. Set to 0 when using cosmos-only pricing.
  priceCredits: number;
  // Optional cosmos pricing for premium-only skins.
  priceCosmos?: number;
  inGameScale: number;
  rotationFrameCount?: number;
  preview: ShipSkinPreviewConfig;
  engineFlame?: ShipSkinEngineFlameConfig;
}

interface SharedShipSkinPriceDefinition {
  id: string;
  priceCredits?: number;
  priceCosmos?: number;
}

interface SharedShipSkinCatalog {
  defaultSkinId?: string;
  skins?: SharedShipSkinPriceDefinition[];
}

const SHARED_SHIP_SKIN_CONFIG = SHIP_SKIN_PRICING_CONFIG as SharedShipSkinCatalog;

const SHARED_SHIP_SKIN_PRICING = new Map<string, SharedShipSkinPriceDefinition>(
  (SHARED_SHIP_SKIN_CONFIG.skins || [])
    .filter((skin): skin is SharedShipSkinPriceDefinition => !!skin && typeof skin.id === 'string')
    .map((skin) => [skin.id, skin])
);

export const DEFAULT_PLAYER_SHIP_SKIN_ID = typeof SHARED_SHIP_SKIN_CONFIG.defaultSkinId === 'string' &&
  SHARED_SHIP_SKIN_CONFIG.defaultSkinId.length > 0
  ? SHARED_SHIP_SKIN_CONFIG.defaultSkinId
  : 'ship106';

function resolveSharedShipSkinPrice(skinId: string, fallbackCredits: number): {
  priceCredits: number;
  priceCosmos?: number;
} {
  const shared = SHARED_SHIP_SKIN_PRICING.get(skinId);
  if (!shared) {
    return {
      priceCredits: Math.max(0, Math.floor(fallbackCredits || 0))
    };
  }

  const resolvedCredits = Math.max(0, Math.floor(shared.priceCredits ?? fallbackCredits));
  const resolvedCosmos = Number.isFinite(shared.priceCosmos)
    ? Math.max(0, Math.floor(shared.priceCosmos as number))
    : undefined;

  return {
    priceCredits: resolvedCredits,
    ...(resolvedCosmos && resolvedCosmos > 0 ? { priceCosmos: resolvedCosmos } : {})
  };
}

const PLAYER_SHIP_SKINS: PlayerShipSkinDefinition[] = [
  {
    id: 'ship50',
    displayName: 'Ship 50',
    basePath: 'assets/ships/ship50/ship50',
    ...resolveSharedShipSkinPrice('ship50', 0),
    inGameScale: 1.2,
    rotationFrameCount: 72,
    engineFlame: {
      backwardOffset: 56,
      horizontalOffsetBonus: 0,
      flameScale: 0.92,
      lateralOffset: 0
    },
    preview: {
      frameWidth: 220,
      frameHeight: 220,
      sheetWidth: 2048,
      sheetHeight: 2048,
      totalFrames: 72,
      columns: 9,
      spacingX: 222,
      spacingY: 222,
      offsetX: 2,
      offsetY: 4,
      displayScale: 0.84
    }
  },
  {
    id: 'ship106',
    displayName: 'Interceptor Mk I',
    basePath: 'assets/ships/ship106/ship106',
    ...resolveSharedShipSkinPrice('ship106', 1),
    inGameScale: 0.8,
    rotationFrameCount: 72,
    engineFlame: {
      backwardOffset: 96,
      horizontalOffsetBonus: 0,
      flameScale: 0.95,
      lateralOffset: 0
    },
    preview: {
      frameWidth: 189,
      frameHeight: 189,
      sheetWidth: 1914,
      sheetHeight: 1532,
      totalFrames: 72,
      columns: 10,
      spacingX: 191,
      spacingY: 191,
      offsetX: 2,
      offsetY: 2,
      displayScale: 0.95
    }
  },
  {
    id: 'ship70',
    displayName: 'Aegis Prototype',
    basePath: 'assets/ships/ship70/ship70',
    ...resolveSharedShipSkinPrice('ship70', 1),
    inGameScale: 0.8,
    rotationFrameCount: 32,
    engineFlame: {
      backwardOffset: 88,
      horizontalOffsetBonus: 0,
      flameScale: 0.86,
      lateralOffset: 0
    },
    preview: {
      frameWidth: 250,
      frameHeight: 200,
      sheetWidth: 4000,
      sheetHeight: 400,
      totalFrames: 32,
      columns: 16,
      spacingX: 250,
      spacingY: 200,
      offsetX: 0,
      offsetY: 0,
      displayScale: 0.7
    }
  },
  {
    id: 'ship102',
    displayName: 'Goliath',
    basePath: 'assets/ships/ship102/ship102',
    ...resolveSharedShipSkinPrice('ship102', 1),
    inGameScale: 0.9,
    rotationFrameCount: 32,
    engineFlame: {
      backwardOffset: 98,
      horizontalOffsetBonus: 0,
      flameScale: 0.92,
      lateralOffset: 0
    },
    preview: {
      frameWidth: 214,
      frameHeight: 166,
      sheetWidth: 2048,
      sheetHeight: 1024,
      totalFrames: 32,
      columns: 9,
      spacingX: 216,
      spacingY: 168,
      offsetX: 2,
      offsetY: 4,
      displayScale: 0.82
    }
  }
];

const SHIP_SKIN_INDEX = new Map<string, PlayerShipSkinDefinition>(
  PLAYER_SHIP_SKINS.map((skin) => [skin.id, skin])
);

function normalizeShipSkinIds(ids: readonly string[]): string[] {
  const uniqueValidIds = new Set<string>();
  for (const id of ids) {
    if (SHIP_SKIN_INDEX.has(id)) uniqueValidIds.add(id);
  }
  return Array.from(uniqueValidIds);
}

export function listPlayerShipSkins(): PlayerShipSkinDefinition[] {
  return PLAYER_SHIP_SKINS;
}

export function getPlayerShipSkinById(skinId?: string | null): PlayerShipSkinDefinition {
  if (skinId) {
    const matched = SHIP_SKIN_INDEX.get(skinId);
    if (matched) return matched;
  }

  return SHIP_SKIN_INDEX.get(DEFAULT_PLAYER_SHIP_SKIN_ID) || PLAYER_SHIP_SKINS[0];
}

export function getSelectedPlayerShipSkinId(preferredSkinId?: string | null): string {
  if (preferredSkinId && SHIP_SKIN_INDEX.has(preferredSkinId)) {
    return preferredSkinId;
  }

  return DEFAULT_PLAYER_SHIP_SKIN_ID;
}

export function getUnlockedPlayerShipSkinIds(
  unlockedSkinIds?: readonly string[] | null,
  selectedSkinId?: string | null
): string[] {
  const alwaysUnlocked = [DEFAULT_PLAYER_SHIP_SKIN_ID];
  const resolvedSelectedId = getSelectedPlayerShipSkinId(selectedSkinId || null);
  if (resolvedSelectedId) alwaysUnlocked.push(resolvedSelectedId);

  if (!Array.isArray(unlockedSkinIds)) return normalizeShipSkinIds(alwaysUnlocked);
  const incomingIds = unlockedSkinIds.filter((id): id is string => typeof id === 'string');
  return normalizeShipSkinIds(alwaysUnlocked.concat(incomingIds));
}

export function isPlayerShipSkinUnlocked(
  skinId?: string | null,
  unlockedSkinIds?: readonly string[] | null,
  selectedSkinId?: string | null
): boolean {
  const resolvedSkin = getPlayerShipSkinById(skinId);
  return getUnlockedPlayerShipSkinIds(unlockedSkinIds, selectedSkinId).includes(resolvedSkin.id);
}
