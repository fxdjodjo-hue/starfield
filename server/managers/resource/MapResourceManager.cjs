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
    this.activeCollections = new Map();
    this.activeAutoCollections = new Map();
    this.resourceIdCounter = 0;

    this.SPAWN_PADDING = 420;
    this.STATION_EXCLUSION_RADIUS = 1200;
    this.PORTAL_EXCLUSION_RADIUS = 1350;
    this.MIN_RESOURCE_GAP = 120;
    this.MAX_SPAWN_ATTEMPTS = 80;
    this.COLLECT_CHANNEL_DURATION_MS = 1800;
    this.COLLECT_STATIONARY_DRIFT_PX = 26;
    this.COLLECT_START_GRACE_MS = 350;
    this.COLLECT_START_DRIFT_PX = 70;
    this.COLLECT_ANCHOR_SYNC_TIMEOUT_MS = 250;
    this.RESOURCE_INVENTORY_SAVE_THROTTLE_MS = 1800;
    this.AUTO_COLLECT_ANCHOR_OFFSET_Y = 100;
    this.AUTO_COLLECT_START_DISTANCE_PX = 30;
    this.AUTO_COLLECT_APPROACH_TIMEOUT_MS = 6000;
  }

  initializeResources() {
    this.resources.clear();
    this.activeCollections.clear();
    this.activeAutoCollections.clear();

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
      scale: Number.isFinite(Number(definition.spriteScale))
        ? Math.max(0.1, Number(definition.spriteScale))
        : 1,
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
    const now = Date.now();
    const node = this.resources.get(resourceId);
    if (!node) return { ok: false, code: 'RESOURCE_NOT_FOUND' };

    const playerPosition = this.getPlayerPosition(playerData);
    if (!playerPosition) return { ok: false, code: 'INVALID_PLAYER_POSITION' };

    const collectDistance = this.resolveCollectDistance(node.resourceType);
    if (!this.isPointWithinRange(playerPosition, node, collectDistance)) {
      return { ok: false, code: 'RESOURCE_TOO_FAR' };
    }

    const existingCollection = this.activeCollections.get(resourceId);
    if (existingCollection) {
      if (existingCollection.playerClientId !== playerData.clientId) {
        return { ok: false, code: 'RESOURCE_BUSY' };
      }
      return {
        ok: true,
        code: 'COLLECTION_IN_PROGRESS',
        remainingMs: Math.max(0, existingCollection.completeAt - now),
        resourceId: node.id,
        resourceType: node.resourceType,
        resourceName: this.resolveResourceDisplayName(node)
      };
    }

    const existingAutoCollection = this.activeAutoCollections.get(resourceId);
    if (existingAutoCollection) {
      if (existingAutoCollection.playerClientId !== playerData.clientId) {
        return { ok: false, code: 'RESOURCE_BUSY' };
      }
      const remainingMs = this.parseFiniteNumber(existingAutoCollection.completeAt);
      return {
        ok: true,
        code: 'COLLECTION_IN_PROGRESS',
        remainingMs: remainingMs !== null
          ? Math.max(0, remainingMs - now)
          : this.COLLECT_CHANNEL_DURATION_MS,
        resourceId: node.id,
        resourceType: node.resourceType,
        resourceName: this.resolveResourceDisplayName(node)
      };
    }

    this.activeCollections.set(resourceId, {
      resourceId,
      resourceType: node.resourceType,
      playerClientId: playerData.clientId,
      startedAt: now,
      completeAt: now + this.COLLECT_CHANNEL_DURATION_MS,
      collectDistance,
      anchorX: playerPosition.x,
      anchorY: playerPosition.y,
      anchorSynced: false,
      anchorSyncedAt: null,
      startedMovementAt: this.getPlayerMovementTimestamp(playerData)
    });

    return {
      ok: true,
      code: 'COLLECTION_STARTED',
      remainingMs: this.COLLECT_CHANNEL_DURATION_MS,
      resourceId: node.id,
      resourceType: node.resourceType,
      resourceName: this.resolveResourceDisplayName(node)
    };
  }

  autoCollectNearestResource(playerData, collectorPosition, collectDistance, options = {}) {
    const now = Date.now();
    if (!playerData || typeof playerData !== 'object') {
      return { ok: false, code: 'INVALID_PLAYER' };
    }
    const playerClientId = String(playerData.clientId || '').trim();
    if (!playerClientId) {
      return { ok: false, code: 'INVALID_PLAYER_CLIENT_ID' };
    }

    for (const collection of this.activeAutoCollections.values()) {
      if (String(collection?.playerClientId || '').trim() === playerClientId) {
        return { ok: false, code: 'AUTO_COLLECTION_IN_PROGRESS' };
      }
    }

    const point = collectorPosition && typeof collectorPosition === 'object'
      ? {
        x: Number(collectorPosition.x),
        y: Number(collectorPosition.y)
      }
      : null;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return { ok: false, code: 'INVALID_COLLECTOR_POSITION' };
    }

    const maxDistance = Math.max(
      60,
      Number.isFinite(Number(collectDistance)) ? Number(collectDistance) : this.resolveCollectDistance('')
    );
    const maxDistanceSq = maxDistance * maxDistance;

    let selectedNode = null;
    let selectedDistanceSq = Number.POSITIVE_INFINITY;
    for (const node of this.resources.values()) {
      if (!node) continue;
      if (this.activeCollections.has(node.id)) continue;
      if (this.activeAutoCollections.has(node.id)) continue;

      const distanceSq = this.distanceSq(point.x, point.y, node.x, node.y);
      if (distanceSq > maxDistanceSq) continue;
      if (distanceSq >= selectedDistanceSq) continue;

      selectedNode = node;
      selectedDistanceSq = distanceSq;
    }

    if (!selectedNode) {
      return { ok: false, code: 'NO_RESOURCE_IN_RANGE' };
    }

    const statusReason = String(options?.reason || 'pet_auto_collect').trim() || 'pet_auto_collect';
    const collectorType = String(options?.collectorType || '').trim().toLowerCase() || 'unknown';
    const isPetCollector = collectorType === 'pet';
    const collectAnchor = this.getAutoCollectionAnchor(selectedNode, collectorType);
    this.activeAutoCollections.set(selectedNode.id, {
      resourceId: selectedNode.id,
      resourceType: selectedNode.resourceType,
      playerClientId,
      startedAt: now,
      completeAt: isPetCollector ? undefined : (now + this.COLLECT_CHANNEL_DURATION_MS),
      channelStartedAt: isPetCollector ? undefined : now,
      approachDeadlineAt: isPetCollector ? (now + this.AUTO_COLLECT_APPROACH_TIMEOUT_MS) : undefined,
      reason: statusReason,
      collectorType
    });

    this.sendCollectionStatus(playerData, {
      status: isPetCollector ? 'approaching' : 'started',
      resourceId: selectedNode.id,
      resourceType: selectedNode.resourceType,
      resourceName: this.resolveResourceDisplayName(selectedNode),
      resourceX: Math.round(Number(collectAnchor.x || 0)),
      resourceY: Math.round(Number(collectAnchor.y || 0)),
      reason: statusReason,
      remainingMs: isPetCollector
        ? this.AUTO_COLLECT_APPROACH_TIMEOUT_MS
        : this.COLLECT_CHANNEL_DURATION_MS,
      timestamp: now
    });

    return {
      ok: true,
      code: 'AUTO_COLLECTION_STARTED',
      resourceId: selectedNode.id,
      resourceType: selectedNode.resourceType,
      resourceName: this.resolveResourceDisplayName(selectedNode),
      collectorType: String(options?.collectorType || '').trim() || 'unknown'
    };
  }

  updateCollections(now = Date.now()) {
    this.processManualCollections(now);
    this.processAutoCollections(now);
  }

  processManualCollections(now = Date.now()) {
    if (this.activeCollections.size === 0) return;

    for (const [resourceId, collection] of this.activeCollections.entries()) {
      const node = this.resources.get(resourceId);
      if (!node) {
        this.cancelCollection(resourceId, collection, null, 'resource_unavailable');
        continue;
      }

      const playerData = this.mapServer.players.get(collection.playerClientId);
      if (!playerData) {
        this.cancelCollection(resourceId, collection, null, 'player_unavailable');
        continue;
      }

      const playerPosition = this.getPlayerPosition(playerData);
      if (!playerPosition) {
        this.cancelCollection(resourceId, collection, playerData, 'invalid_player_position');
        continue;
      }

      if (!this.isPointWithinRange(playerPosition, node, collection.collectDistance)) {
        this.cancelCollection(resourceId, collection, playerData, 'out_of_range');
        continue;
      }

      const anchorReady = this.ensureCollectionAnchorSynchronized(
        collection,
        playerData,
        playerPosition,
        now
      );
      if (!anchorReady) {
        continue;
      }

      if (this.hasPlayerMovedFromAnchor(playerPosition, collection, now)) {
        this.cancelCollection(resourceId, collection, playerData, 'player_moved');
        continue;
      }

      if (now < collection.completeAt) continue;

      this.resources.delete(resourceId);
      this.activeCollections.delete(resourceId);

      if (!playerData.resourceInventory || typeof playerData.resourceInventory !== 'object') {
        playerData.resourceInventory = {};
      }
      const currentCount = Number(playerData.resourceInventory[node.resourceType] || 0);
      playerData.resourceInventory[node.resourceType] = Math.max(0, Math.floor(currentCount + 1));
      this.persistCollectedResourceInventory(playerData, now);

      this.sendCollectionStatus(playerData, {
        status: 'completed',
        resourceId: node.id,
        resourceType: node.resourceType,
        resourceName: this.resolveResourceDisplayName(node),
        reason: 'completed',
        timestamp: now
      });

      this.mapServer.broadcastToMap({
        type: 'resource_node_removed',
        resourceId: node.id,
        resourceType: node.resourceType,
        collectedBy: playerData.clientId,
        x: Math.round(Number(node.x || 0)),
        y: Math.round(Number(node.y || 0)),
        timestamp: Date.now()
      });
    }
  }

  processAutoCollections(now = Date.now()) {
    if (this.activeAutoCollections.size === 0) return;

    for (const [resourceId, collection] of this.activeAutoCollections.entries()) {
      const node = this.resources.get(resourceId);
      if (!node) {
        this.cancelAutoCollection(resourceId, collection, null, 'resource_unavailable');
        continue;
      }

      const playerData = this.mapServer.players.get(collection.playerClientId);
      if (!playerData) {
        this.cancelAutoCollection(resourceId, collection, null, 'player_unavailable');
        continue;
      }

      if (playerData.isDead) {
        this.cancelAutoCollection(resourceId, collection, playerData, 'player_dead');
        continue;
      }

      const collectorType = String(collection?.collectorType || '').trim().toLowerCase();
      const channelStartedAt = this.parseFiniteNumber(collection?.channelStartedAt);
      if (collectorType === 'pet' && channelStartedAt === null) {
        const collectorPosition = this.getAutoCollectorPosition(playerData, collection);
        if (!collectorPosition) {
          this.cancelAutoCollection(resourceId, collection, playerData, 'collector_unavailable');
          continue;
        }

        const collectAnchor = this.getAutoCollectionAnchor(node, collectorType);
        if (!this.isPointWithinRange(collectorPosition, collectAnchor, this.AUTO_COLLECT_START_DISTANCE_PX)) {
          const approachDeadlineAt = this.parseFiniteNumber(collection?.approachDeadlineAt);
          if (approachDeadlineAt !== null && now >= approachDeadlineAt) {
            this.cancelAutoCollection(resourceId, collection, playerData, 'collector_timeout');
          }
          continue;
        }

        collection.channelStartedAt = now;
        collection.completeAt = now + this.COLLECT_CHANNEL_DURATION_MS;

        this.sendCollectionStatus(playerData, {
          status: 'started',
          resourceId: node.id,
          resourceType: node.resourceType,
          resourceName: this.resolveResourceDisplayName(node),
          resourceX: Math.round(Number(collectAnchor.x || 0)),
          resourceY: Math.round(Number(collectAnchor.y || 0)),
          reason: String(collection.reason || 'pet_auto_collect').trim() || 'pet_auto_collect',
          remainingMs: this.COLLECT_CHANNEL_DURATION_MS,
          timestamp: now
        });

        continue;
      }

      const completeAt = this.parseFiniteNumber(collection?.completeAt);
      if (completeAt === null || now < completeAt) continue;

      this.resources.delete(resourceId);
      this.activeAutoCollections.delete(resourceId);

      if (!playerData.resourceInventory || typeof playerData.resourceInventory !== 'object') {
        playerData.resourceInventory = {};
      }
      const currentCount = Number(playerData.resourceInventory[node.resourceType] || 0);
      playerData.resourceInventory[node.resourceType] = Math.max(0, Math.floor(currentCount + 1));
      this.persistCollectedResourceInventory(playerData, now);

      this.sendCollectionStatus(playerData, {
        status: 'completed',
        resourceId: node.id,
        resourceType: node.resourceType,
        resourceName: this.resolveResourceDisplayName(node),
        resourceX: Math.round(Number(node.x || 0)),
        resourceY: Math.round(Number(node.y || 0)),
        reason: String(collection.reason || 'pet_auto_collect').trim() || 'pet_auto_collect',
        timestamp: now
      });

      this.mapServer.broadcastToMap({
        type: 'resource_node_removed',
        resourceId: node.id,
        resourceType: node.resourceType,
        collectedBy: playerData.clientId,
        x: Math.round(Number(node.x || 0)),
        y: Math.round(Number(node.y || 0)),
        timestamp: now
      });
    }
  }

  resolveCollectDistance(resourceType) {
    const definition = getResourceDefinition(resourceType);
    return Math.max(
      60,
      Number(definition?.collectDistance || getDefaultCollectDistance())
    );
  }

  isPlayerWithinRange(playerData, node, collectDistance) {
    const position = this.getPlayerPosition(playerData);
    if (!position) return false;

    return this.isPointWithinRange(position, node, collectDistance);
  }

  getPlayerPosition(playerData) {
    const playerX = Number(playerData?.position?.x ?? playerData?.x ?? 0);
    const playerY = Number(playerData?.position?.y ?? playerData?.y ?? 0);
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return null;

    return { x: playerX, y: playerY };
  }

  getAutoCollectorPosition(playerData, collection) {
    const collectorType = String(collection?.collectorType || '').trim().toLowerCase();
    if (collectorType !== 'pet') {
      return this.getPlayerPosition(playerData);
    }

    const petX = Number(playerData?.petPosition?.x);
    const petY = Number(playerData?.petPosition?.y);
    if (Number.isFinite(petX) && Number.isFinite(petY)) {
      return { x: petX, y: petY };
    }

    const playerPosition = this.getPlayerPosition(playerData);
    if (!playerPosition) return null;

    const playerRotation = Number(playerData?.position?.rotation ?? playerData?.rotation);
    const fallbackRotation = Number.isFinite(playerRotation) ? playerRotation : 0;
    const fallbackOffset = 80;
    const fallbackAngle = fallbackRotation + Math.PI;

    return {
      x: playerPosition.x + (Math.cos(fallbackAngle) * fallbackOffset),
      y: playerPosition.y + (Math.sin(fallbackAngle) * fallbackOffset)
    };
  }

  getPetAutoCollectTarget(playerData) {
    const playerClientId = String(playerData?.clientId || '').trim();
    if (!playerClientId) return null;

    for (const collection of this.activeAutoCollections.values()) {
      if (!collection || String(collection.playerClientId || '').trim() !== playerClientId) {
        continue;
      }

      const collectorType = String(collection.collectorType || '').trim().toLowerCase();
      if (collectorType !== 'pet') {
        continue;
      }

      const resourceId = String(collection.resourceId || '').trim();
      if (!resourceId) {
        continue;
      }

      const node = this.resources.get(resourceId);
      if (!node) {
        continue;
      }

      const collectAnchor = this.getAutoCollectionAnchor(node, collectorType);
      const anchorX = Number(collectAnchor?.x);
      const anchorY = Number(collectAnchor?.y);
      if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
        continue;
      }

      return {
        x: anchorX,
        y: anchorY,
        resourceId
      };
    }

    return null;
  }

  getAutoCollectionAnchor(node, collectorType) {
    const resourceX = Number(node?.x);
    const resourceY = Number(node?.y);
    if (!Number.isFinite(resourceX) || !Number.isFinite(resourceY)) {
      return { x: 0, y: 0 };
    }

    const normalizedCollectorType = String(collectorType || '').trim().toLowerCase();
    if (normalizedCollectorType === 'pet') {
      // Small upward offset so the pet ship appears visually ON TOP of the resource sprite.
      return { x: resourceX, y: resourceY - 100 };
    }

    return { x: resourceX, y: resourceY };
  }

  getPlayerMovementTimestamp(playerData) {
    const movementTs = Number(playerData?.lastMovementTime);
    return Number.isFinite(movementTs) ? movementTs : 0;
  }

  isPointWithinRange(point, node, collectDistance) {
    if (!point) return false;
    const distanceSq = this.distanceSq(point.x, point.y, node.x, node.y);
    return distanceSq <= (collectDistance * collectDistance);
  }

  ensureCollectionAnchorSynchronized(collection, playerData, playerPosition, now = Date.now()) {
    if (collection?.anchorSynced === true) return true;

    const startedMovementAt = Number(collection?.startedMovementAt || 0);
    const currentMovementAt = this.getPlayerMovementTimestamp(playerData);
    const hasFreshMovementSample = currentMovementAt > startedMovementAt;

    const startedAt = Number(collection?.startedAt);
    const elapsedMs = Number.isFinite(startedAt)
      ? Math.max(0, now - startedAt)
      : this.COLLECT_ANCHOR_SYNC_TIMEOUT_MS + 1;
    const timedOutWaitingForFreshSample = elapsedMs >= this.COLLECT_ANCHOR_SYNC_TIMEOUT_MS;

    if (!hasFreshMovementSample && !timedOutWaitingForFreshSample) {
      return false;
    }

    collection.anchorX = playerPosition.x;
    collection.anchorY = playerPosition.y;
    collection.anchorSynced = true;
    collection.anchorSyncedAt = now;
    return true;
  }

  hasPlayerMovedFromAnchor(playerPosition, collection, now = Date.now()) {
    const anchorX = Number(collection?.anchorX);
    const anchorY = Number(collection?.anchorY);
    if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return false;

    const anchorSyncedAt = Number(collection?.anchorSyncedAt);
    const startedAt = Number(collection?.startedAt);
    const timeReference = Number.isFinite(anchorSyncedAt) ? anchorSyncedAt : startedAt;
    const elapsedMs = Number.isFinite(timeReference) ? Math.max(0, now - timeReference) : this.COLLECT_START_GRACE_MS + 1;
    const allowedDriftPx = elapsedMs <= this.COLLECT_START_GRACE_MS
      ? this.COLLECT_START_DRIFT_PX
      : this.COLLECT_STATIONARY_DRIFT_PX;

    const movedDistanceSq = this.distanceSq(playerPosition.x, playerPosition.y, anchorX, anchorY);
    return movedDistanceSq > (allowedDriftPx * allowedDriftPx);
  }

  resolveResourceDisplayName(node) {
    if (node && typeof node.displayName === 'string' && node.displayName.trim().length > 0) {
      return node.displayName.trim();
    }
    if (node && typeof node.resourceType === 'string' && node.resourceType.trim().length > 0) {
      return node.resourceType.trim();
    }
    return 'Resource';
  }

  cancelCollection(resourceId, collection, playerData, reason) {
    this.activeCollections.delete(resourceId);
    if (!playerData) return;

    const node = this.resources.get(resourceId);
    this.sendCollectionStatus(playerData, {
      status: 'interrupted',
      resourceId: node?.id || resourceId,
      resourceType: node?.resourceType || collection?.resourceType || null,
      resourceName: this.resolveResourceDisplayName(node || collection || null),
      reason: reason || 'interrupted',
      timestamp: Date.now()
    });
  }

  cancelAutoCollection(resourceId, collection, playerData, reason) {
    this.activeAutoCollections.delete(resourceId);
    if (!playerData) return;

    const node = this.resources.get(resourceId);
    const statusReason = String(collection?.reason || 'pet_auto_collect').trim() || 'pet_auto_collect';
    this.sendCollectionStatus(playerData, {
      status: 'interrupted',
      resourceId: node?.id || resourceId,
      resourceType: node?.resourceType || collection?.resourceType || null,
      resourceName: this.resolveResourceDisplayName(node || collection || null),
      resourceX: Math.round(Number(node?.x || 0)),
      resourceY: Math.round(Number(node?.y || 0)),
      reason: statusReason,
      interruptReason: reason || 'interrupted',
      timestamp: Date.now()
    });
  }

  sendCollectionStatus(playerData, payload) {
    const ws = playerData?.ws;
    if (!ws || ws.readyState !== 1) return;

    const normalizedResourceInventory = {};
    if (playerData?.resourceInventory && typeof playerData.resourceInventory === 'object') {
      for (const [rawType, rawQuantity] of Object.entries(playerData.resourceInventory)) {
        const resourceType = String(rawType || '').trim();
        if (!resourceType) continue;

        const parsedQuantity = Number(rawQuantity);
        normalizedResourceInventory[resourceType] = Number.isFinite(parsedQuantity)
          ? Math.max(0, Math.floor(parsedQuantity))
          : 0;
      }
    }

    try {
      ws.send(JSON.stringify({
        type: 'resource_collect_status',
        ...payload,
        resourceInventory: normalizedResourceInventory
      }));
    } catch (error) {
      ServerLoggerWrapper.warn('RESOURCE', `Failed to send resource collection status: ${error.message}`);
    }
  }

  persistCollectedResourceInventory(playerData, now = Date.now()) {
    const websocketManager = this.mapServer?.websocketManager;
    if (!websocketManager || typeof websocketManager.savePlayerData !== 'function') return;

    const lastSaveAt = Number(playerData?.lastResourceInventorySaveAt || 0);
    const elapsedSinceLastSave = Number.isFinite(lastSaveAt) ? now - lastSaveAt : Number.POSITIVE_INFINITY;
    if (elapsedSinceLastSave < this.RESOURCE_INVENTORY_SAVE_THROTTLE_MS) return;

    playerData.lastResourceInventorySaveAt = now;
    websocketManager.savePlayerData(playerData).catch((error) => {
      ServerLoggerWrapper.warn('RESOURCE', `Failed to persist collected resource inventory for ${playerData?.userId || 'unknown'}: ${error.message}`);
    });
  }

  parseFiniteNumber(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return null;
    }

    return parsedValue;
  }

  distanceSq(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }
}

module.exports = MapResourceManager;
