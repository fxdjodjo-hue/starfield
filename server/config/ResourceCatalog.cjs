const resourceConfig = require('../../shared/resource-config.json');

const DEFAULT_COLLECT_DISTANCE = Math.max(
  60,
  Math.floor(Number(resourceConfig.defaultCollectDistance || 520))
);

const RESOURCE_DEFINITIONS = Array.isArray(resourceConfig.resources)
  ? resourceConfig.resources
    .filter((resource) => resource && typeof resource.id === 'string' && resource.id.length > 0)
    .map((resource) => ({
      id: resource.id,
      displayName: typeof resource.displayName === 'string' && resource.displayName.length > 0
        ? resource.displayName
        : resource.id,
      assetBasePath: typeof resource.assetBasePath === 'string' && resource.assetBasePath.length > 0
        ? resource.assetBasePath
        : '',
      spriteScale: Number.isFinite(Number(resource.spriteScale))
        ? Number(resource.spriteScale)
        : 1,
      clickRadius: Math.max(10, Number(resource.clickRadius || 95)),
      collectDistance: Math.max(60, Number(resource.collectDistance || DEFAULT_COLLECT_DISTANCE))
    }))
  : [];

const RESOURCE_INDEX = new Map(
  RESOURCE_DEFINITIONS.map((resource) => [resource.id, resource])
);

function getResourceDefinition(resourceType) {
  if (typeof resourceType !== 'string') return null;
  return RESOURCE_INDEX.get(resourceType) || null;
}

function isValidResourceType(resourceType) {
  return !!getResourceDefinition(resourceType);
}

function listMapResourceSpawns(mapId) {
  if (typeof mapId !== 'string') return [];

  const mapSpawns = resourceConfig.mapSpawns || {};
  const rawEntries = Array.isArray(mapSpawns[mapId]) ? mapSpawns[mapId] : [];

  return rawEntries
    .filter((entry) => entry && typeof entry.resourceType === 'string')
    .map((entry) => ({
      resourceType: entry.resourceType,
      count: Math.max(0, Math.floor(Number(entry.count || 0)))
    }))
    .filter((entry) => entry.count > 0 && isValidResourceType(entry.resourceType));
}

function getDefaultCollectDistance() {
  return DEFAULT_COLLECT_DISTANCE;
}

module.exports = {
  getResourceDefinition,
  isValidResourceType,
  listMapResourceSpawns,
  getDefaultCollectDistance
};
