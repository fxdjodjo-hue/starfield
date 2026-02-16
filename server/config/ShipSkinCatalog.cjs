const sharedShipSkinConfig = require('../../shared/ship-skins.json');

const DEFAULT_PLAYER_SHIP_SKIN_ID =
  typeof sharedShipSkinConfig.defaultSkinId === 'string' &&
    sharedShipSkinConfig.defaultSkinId.length > 0
    ? sharedShipSkinConfig.defaultSkinId
    : 'ship106';

const RAW_SHIP_SKINS = Array.isArray(sharedShipSkinConfig.skins)
  ? sharedShipSkinConfig.skins
  : [];

const SHIP_SKIN_DEFINITIONS = RAW_SHIP_SKINS
  .filter((skin) => skin && typeof skin.id === 'string' && skin.id.length > 0)
  .map((skin) => ({
    id: skin.id,
    priceCredits: Math.max(0, Math.floor(Number(skin.priceCredits ?? 0) || 0)),
    priceCosmos: Math.max(0, Math.floor(Number(skin.priceCosmos ?? 0) || 0))
  }));

const SHIP_SKIN_INDEX = new Map(
  SHIP_SKIN_DEFINITIONS.map((skin) => [skin.id, skin])
);

function isValidShipSkinId(skinId) {
  return typeof skinId === 'string' && SHIP_SKIN_INDEX.has(skinId);
}

function getShipSkinById(skinId) {
  if (isValidShipSkinId(skinId)) {
    return SHIP_SKIN_INDEX.get(skinId);
  }
  return SHIP_SKIN_INDEX.get(DEFAULT_PLAYER_SHIP_SKIN_ID) || null;
}

function listShipSkinIds() {
  return Array.from(SHIP_SKIN_INDEX.keys());
}

function getDefaultShipSkinId() {
  if (SHIP_SKIN_INDEX.has(DEFAULT_PLAYER_SHIP_SKIN_ID)) {
    return DEFAULT_PLAYER_SHIP_SKIN_ID;
  }
  const first = listShipSkinIds()[0];
  return first || 'ship106';
}

function normalizeUnlockedShipSkinIds(unlockedSkinIds, selectedSkinId) {
  const normalized = new Set();
  const defaultSkinId = getDefaultShipSkinId();
  normalized.add(defaultSkinId);

  if (typeof selectedSkinId === 'string' && SHIP_SKIN_INDEX.has(selectedSkinId)) {
    normalized.add(selectedSkinId);
  }

  if (Array.isArray(unlockedSkinIds)) {
    for (const skinId of unlockedSkinIds) {
      if (typeof skinId === 'string' && SHIP_SKIN_INDEX.has(skinId)) {
        normalized.add(skinId);
      }
    }
  }

  return Array.from(normalized);
}

function resolveSelectedShipSkinId(preferredSkinId) {
  if (typeof preferredSkinId === 'string' && SHIP_SKIN_INDEX.has(preferredSkinId)) {
    return preferredSkinId;
  }
  return getDefaultShipSkinId();
}

function resolveShipSkinPurchaseCost(skinId) {
  const skin = getShipSkinById(skinId);
  if (!skin) return null;

  const cosmosPrice = Math.max(0, Math.floor(Number(skin.priceCosmos || 0) || 0));
  if (cosmosPrice > 0) {
    return { currency: 'cosmos', amount: cosmosPrice };
  }

  const creditsPrice = Math.max(0, Math.floor(Number(skin.priceCredits || 0) || 0));
  return { currency: 'credits', amount: creditsPrice };
}

module.exports = {
  DEFAULT_PLAYER_SHIP_SKIN_ID: getDefaultShipSkinId(),
  getDefaultShipSkinId,
  isValidShipSkinId,
  getShipSkinById,
  listShipSkinIds,
  normalizeUnlockedShipSkinIds,
  resolveSelectedShipSkinId,
  resolveShipSkinPurchaseCost
};
