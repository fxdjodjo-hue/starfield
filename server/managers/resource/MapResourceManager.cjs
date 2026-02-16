const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const {
  getResourceDefinition,
  listMapResourceSpawns,
  getDefaultCollectDistance
} = require('../../config/ResourceCatalog.cjs');
const { MAP_CONFIGS } = require('../../config/MapConfigs.cjs');

class MapResourceManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.resources = new Map();
    this.resourceIdCounter = 0;

    this.SPAWN_PADDING = 420;
    this.STATION_EXCLUSION_RADIUS = 1200;
    this.PORTAL_EXCLUSION_RADIUS = 1350;
    this.MIN_RESOURCE_GAP = 120;
    this.MAX_SPAWN_ATTEMPTS = 80;
  }

  initializeResources() {
    this.resources.clear();

    const spawnPlans = listMapResourceSpawns(this.mapServer.mapId);
    let spawnedCount = 0;

    for (const plan of spawnPlans) {
      for (let i = 0; i < plan.count; i++) {
        const resource = this.spawnResourceNode(plan.resourceType);
        if (resource) spawnedCount++;
      }
    }

    ServerLoggerWrapper.info(
      'RESOURCE',
      `Initialized ${spawnedCount} resource nodes in map ${this.mapServer.mapId}`
    );
  }

  spawnResourceNode(resourceType) {
    const definition = getResourceDefinition(resourceType);
    if (!definition) return null;

    const position = this.generateSpawnPosition();
    if (!position) return null;

    const node = {
      id: `${this.mapServer.mapId}_resource_${this.resourceIdCounter++}`,
      resourceType: definition.id,
      displayName: definition.displayName,
      x: position.x,
      y: position.y,
      rotation: Math.random() * Math.PI * 2,
      scale: 1,
      spawnedAt: Date.now()
    };

    this.resources.set(node.id, node);
    return node;
  }

  generateSpawnPosition() {
    const halfWidth = this.mapServer.WORLD_WIDTH / 2;
    const halfHeight = this.mapServer.WORLD_HEIGHT / 2;

    const minX = -halfWidth + this.SPAWN_PADDING;
    const maxX = halfWidth - this.SPAWN_PADDING;
    const minY = -halfHeight + this.SPAWN_PADDING;
    const maxY = halfHeight - this.SPAWN_PADDING;

    for (let attempt = 0; attempt < this.MAX_SPAWN_ATTEMPTS; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (!this.isValidSpawnPosition(x, y)) continue;
      return { x, y };
    }

    return null;
  }

  isValidSpawnPosition(x, y) {
    const mapConfig = MAP_CONFIGS[this.mapServer.mapId] || null;

    if (this.distanceSq(x, y, 0, 0) < (this.STATION_EXCLUSION_RADIUS * this.STATION_EXCLUSION_RADIUS)) {
      return false;
    }

    if (mapConfig && Array.isArray(mapConfig.portals)) {
      for (const portal of mapConfig.portals) {
        if (!Number.isFinite(Number(portal.x)) || !Number.isFinite(Number(portal.y))) continue;
        if (this.distanceSq(x, y, Number(portal.x), Number(portal.y)) < (this.PORTAL_EXCLUSION_RADIUS * this.PORTAL_EXCLUSION_RADIUS)) {
          return false;
        }
      }
    }

    for (const existing of this.resources.values()) {
      if (this.distanceSq(x, y, existing.x, existing.y) < (this.MIN_RESOURCE_GAP * this.MIN_RESOURCE_GAP)) {
        return false;
      }
    }

    return true;
  }

  getSerializedResources() {
    return Array.from(this.resources.values()).map((node) => ({
      id: node.id,
      resourceType: node.resourceType,
      x: Math.round(node.x),
      y: Math.round(node.y),
      rotation: Number(node.rotation || 0),
      scale: Number(node.scale || 1)
    }));
  }

  collectResource(playerData, resourceId) {
    const node = this.resources.get(resourceId);
    if (!node) {
      return { ok: false, code: 'RESOURCE_NOT_FOUND' };
    }

    const playerX = Number(playerData?.position?.x ?? playerData?.x ?? 0);
    const playerY = Number(playerData?.position?.y ?? playerData?.y ?? 0);
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
      return { ok: false, code: 'INVALID_PLAYER_POSITION' };
    }

    const definition = getResourceDefinition(node.resourceType);
    const collectDistance = Math.max(
      60,
      Number(definition?.collectDistance || getDefaultCollectDistance())
    );
    const distanceSq = this.distanceSq(playerX, playerY, node.x, node.y);
    if (distanceSq > collectDistance * collectDistance) {
      return { ok: false, code: 'RESOURCE_TOO_FAR' };
    }

    this.resources.delete(resourceId);

    if (!playerData.resourceInventory || typeof playerData.resourceInventory !== 'object') {
      playerData.resourceInventory = {};
    }
    const currentCount = Number(playerData.resourceInventory[node.resourceType] || 0);
    playerData.resourceInventory[node.resourceType] = Math.max(0, Math.floor(currentCount + 1));

    return {
      ok: true,
      node,
      totalOwned: playerData.resourceInventory[node.resourceType]
    };
  }

  distanceSq(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }
}

module.exports = MapResourceManager;
