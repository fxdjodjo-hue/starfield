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

export interface PlayerShipSkinDefinition {
  id: string;
  displayName: string;
  basePath: string;
  inGameScale: number;
  rotationFrameCount?: number;
  preview: ShipSkinPreviewConfig;
}

export const DEFAULT_PLAYER_SHIP_SKIN_ID = 'ship106';

const SHIP_SKIN_STORAGE_KEY = 'starfield_selected_ship_skin';

const PLAYER_SHIP_SKINS: PlayerShipSkinDefinition[] = [
  {
    id: 'ship106',
    displayName: 'Interceptor Mk I',
    basePath: 'assets/ships/ship106/ship106',
    inGameScale: 0.8,
    rotationFrameCount: 72,
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
    inGameScale: 0.8,
    rotationFrameCount: 32,
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
    inGameScale: 0.8,
    rotationFrameCount: 32,
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

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function listPlayerShipSkins(): PlayerShipSkinDefinition[] {
  return PLAYER_SHIP_SKINS;
}

export function getPlayerShipSkinById(skinId?: string | null): PlayerShipSkinDefinition {
  if (skinId) {
    const matched = SHIP_SKIN_INDEX.get(skinId);
    if (matched) return matched;
  }

  return SHIP_SKIN_INDEX.get(DEFAULT_PLAYER_SHIP_SKIN_ID)!;
}

export function getStoredPlayerShipSkinId(): string | null {
  const storage = getSafeLocalStorage();
  if (!storage) return null;

  try {
    const storedSkinId = storage.getItem(SHIP_SKIN_STORAGE_KEY);
    if (!storedSkinId) return null;
    return SHIP_SKIN_INDEX.has(storedSkinId) ? storedSkinId : null;
  } catch {
    return null;
  }
}

export function getSelectedPlayerShipSkinId(preferredSkinId?: string | null): string {
  if (preferredSkinId && SHIP_SKIN_INDEX.has(preferredSkinId)) {
    return preferredSkinId;
  }

  const storedSkinId = getStoredPlayerShipSkinId();
  if (storedSkinId) return storedSkinId;

  return DEFAULT_PLAYER_SHIP_SKIN_ID;
}

export function persistPlayerShipSkinSelection(skinId: string): string {
  const resolvedSkin = getPlayerShipSkinById(skinId);
  const storage = getSafeLocalStorage();

  if (storage) {
    try {
      storage.setItem(SHIP_SKIN_STORAGE_KEY, resolvedSkin.id);
    } catch {
      // Ignore storage failures (private mode or restricted environment).
    }
  }

  return resolvedSkin.id;
}
