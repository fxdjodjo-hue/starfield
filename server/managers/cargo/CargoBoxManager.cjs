// CargoBoxManager - Server-authoritative cargo box loot system
// Spawns cargo boxes when NPCs die, handles collection with channeled mechanic
// Boxes are exclusive to the killer for a configurable period, then open to all

const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const CARGO_CONFIG = require('../../../shared/cargo-config.json');

class CargoBoxManager {
    constructor(mapServer) {
        this.mapServer = mapServer;
        this.cargoBoxes = new Map();
        this.activeCollections = new Map();
        this.boxIdCounter = 0;
    }

    /**
     * Spawn a cargo box at the given position when an NPC dies
     * @param {{ x: number, y: number }} position - Death position
     * @param {string} npcType - NPC type from npc-config
     * @param {string|null} killerId - The clientId of the player who killed the NPC
     * @returns {object|null} The spawned cargo box, or null if drop chance failed
     */
    spawnCargoBox(position, npcType, killerId = null) {
        const npcReward = CARGO_CONFIG.npcRewards?.[npcType];
        if (!npcReward) {
            return null;
        }

        // Roll drop chance
        if (Math.random() > npcReward.dropChance) {
            return null;
        }

        // Pick a random resource from the pool
        const resources = npcReward.resources;
        if (!resources || resources.length === 0) return null;
        const resourceType = resources[Math.floor(Math.random() * resources.length)];

        // Calculate random quantity
        const quantityMin = npcReward.quantityMin || 1;
        const quantityMax = npcReward.quantityMax || 1;
        const quantity = quantityMin + Math.floor(Math.random() * (quantityMax - quantityMin + 1));

        const now = Date.now();
        const box = {
            id: `${this.mapServer.mapId}_cargo_${this.boxIdCounter++}`,
            x: position.x,
            y: position.y,
            resourceType,
            quantity,
            npcType,
            killerId: killerId || null,
            spawnedAt: now,
            expiresAt: now + (CARGO_CONFIG.lifetimeMs || 30000),
            exclusiveUntil: killerId ? now + (CARGO_CONFIG.exclusivityDurationMs || 10000) : 0
        };

        this.cargoBoxes.set(box.id, box);

        // Broadcast spawn to all players
        this.mapServer.broadcastToMap({
            type: 'cargo_box_spawned',
            id: box.id,
            x: Math.round(box.x),
            y: Math.round(box.y),
            resourceType: box.resourceType,
            quantity: box.quantity,
            npcType: box.npcType,
            killerId: box.killerId,
            exclusiveUntil: box.exclusiveUntil,
            expiresAt: box.expiresAt,
            timestamp: now
        });

        ServerLoggerWrapper.info('CARGO', `Cargo box ${box.id} spawned at (${Math.round(box.x)}, ${Math.round(box.y)}) for ${npcType}: ${quantity}x ${resourceType} (killer: ${killerId || 'none'})`);
        return box;
    }

    /**
     * Start collection of a cargo box (channeled, like resources)
     * @param {object} playerData
     * @param {string} boxId
     * @returns {{ ok: boolean, code: string, [key: string]: any }}
     */
    collectCargoBox(playerData, boxId) {
        const now = Date.now();
        const box = this.cargoBoxes.get(boxId);
        if (!box) return { ok: false, code: 'BOX_NOT_FOUND' };

        // Check expiry
        if (now >= box.expiresAt) {
            this.removeCargoBox(boxId, 'expired');
            return { ok: false, code: 'BOX_EXPIRED' };
        }

        // Check exclusivity
        if (box.killerId && box.exclusiveUntil > now && playerData.clientId !== box.killerId) {
            return { ok: false, code: 'BOX_EXCLUSIVE' };
        }

        // Check distance
        const playerPosition = this.getPlayerPosition(playerData);
        if (!playerPosition) return { ok: false, code: 'INVALID_PLAYER_POSITION' };

        const collectDistance = CARGO_CONFIG.collectDistance || 520;
        const dx = playerPosition.x - box.x;
        const dy = playerPosition.y - box.y;
        if ((dx * dx + dy * dy) > (collectDistance * collectDistance)) {
            return { ok: false, code: 'BOX_TOO_FAR' };
        }

        // Check if already being collected
        const existingCollection = this.activeCollections.get(boxId);
        if (existingCollection) {
            if (existingCollection.playerClientId !== playerData.clientId) {
                return { ok: false, code: 'BOX_BUSY' };
            }
            return {
                ok: true,
                code: 'COLLECTION_IN_PROGRESS',
                remainingMs: Math.max(0, existingCollection.completeAt - now),
                cargoBoxId: box.id,
                resourceType: box.resourceType,
                quantity: box.quantity
            };
        }

        // Start channeled collection
        const channelDuration = CARGO_CONFIG.channelDurationMs || 1800;
        this.activeCollections.set(boxId, {
            boxId,
            playerClientId: playerData.clientId,
            startedAt: now,
            completeAt: now + channelDuration,
            collectDistance,
            anchorX: playerPosition.x,
            anchorY: playerPosition.y,
            anchorSynced: false
        });

        return {
            ok: true,
            code: 'COLLECTION_STARTED',
            remainingMs: channelDuration,
            cargoBoxId: box.id,
            resourceType: box.resourceType,
            quantity: box.quantity
        };
    }

    /**
     * Tick: process active collections and expire old boxes
     * @param {number} now
     */
    update(now = Date.now()) {
        this.processCollections(now);
        this.processExpirations(now);
    }

    /**
     * Process active cargo box collections (channeled collection)
     */
    processCollections(now = Date.now()) {
        if (this.activeCollections.size === 0) return;

        for (const [boxId, collection] of this.activeCollections.entries()) {
            const box = this.cargoBoxes.get(boxId);
            if (!box) {
                this.cancelCollection(boxId, collection, null, 'box_unavailable');
                continue;
            }

            const playerData = this.mapServer.players.get(collection.playerClientId);
            if (!playerData) {
                this.cancelCollection(boxId, collection, null, 'player_unavailable');
                continue;
            }

            // Check player is still in range
            const playerPosition = this.getPlayerPosition(playerData);
            if (!playerPosition) {
                this.cancelCollection(boxId, collection, playerData, 'invalid_player_position');
                continue;
            }

            const dx = playerPosition.x - box.x;
            const dy = playerPosition.y - box.y;
            if ((dx * dx + dy * dy) > (collection.collectDistance * collection.collectDistance)) {
                this.cancelCollection(boxId, collection, playerData, 'out_of_range');
                continue;
            }

            // Check player hasn't moved too much (stationary check like resources)
            if (collection.anchorSynced) {
                const adx = playerPosition.x - collection.anchorX;
                const ady = playerPosition.y - collection.anchorY;
                const DRIFT_PX = 26;
                if ((adx * adx + ady * ady) > (DRIFT_PX * DRIFT_PX)) {
                    this.cancelCollection(boxId, collection, playerData, 'player_moved');
                    continue;
                }
            } else {
                // Sync anchor after first positional update
                collection.anchorX = playerPosition.x;
                collection.anchorY = playerPosition.y;
                collection.anchorSynced = true;
            }

            // Not yet complete
            if (now < collection.completeAt) continue;

            // COLLECTION COMPLETE — award resources
            this.activeCollections.delete(boxId);
            this.cargoBoxes.delete(boxId);

            if (!playerData.resourceInventory || typeof playerData.resourceInventory !== 'object') {
                playerData.resourceInventory = {};
            }
            const currentCount = Number(playerData.resourceInventory[box.resourceType] || 0);
            playerData.resourceInventory[box.resourceType] = Math.max(0, Math.floor(currentCount + box.quantity));

            // Persist immediately
            const websocketManager = this.mapServer?.websocketManager;
            if (websocketManager && typeof websocketManager.savePlayerData === 'function') {
                websocketManager.savePlayerData(playerData).catch(err => {
                    ServerLoggerWrapper.warn('CARGO', `Failed to persist cargo collect for ${playerData?.userId || 'unknown'}: ${err.message}`);
                });
            }

            // Notify collector
            this.sendCollectionStatus(playerData, {
                status: 'completed',
                cargoBoxId: box.id,
                resourceType: box.resourceType,
                quantity: box.quantity,
                timestamp: now
            });

            // Broadcast removal to all players
            this.mapServer.broadcastToMap({
                type: 'cargo_box_removed',
                boxId: box.id,
                collectedBy: playerData.clientId,
                x: Math.round(box.x),
                y: Math.round(box.y),
                timestamp: now
            });

            ServerLoggerWrapper.info('CARGO', `Player ${playerData.clientId} collected cargo ${box.id}: ${box.quantity}x ${box.resourceType}`);
        }
    }

    /**
     * Remove expired cargo boxes
     */
    processExpirations(now = Date.now()) {
        for (const [boxId, box] of this.cargoBoxes.entries()) {
            if (now >= box.expiresAt) {
                this.removeCargoBox(boxId, 'expired');
            }
        }
    }

    /**
     * Remove a cargo box and broadcast its removal
     */
    removeCargoBox(boxId, reason = 'removed') {
        const box = this.cargoBoxes.get(boxId);
        if (!box) return;

        // Cancel any active collection for this box
        if (this.activeCollections.has(boxId)) {
            const collection = this.activeCollections.get(boxId);
            const playerData = this.mapServer.players.get(collection.playerClientId);
            this.cancelCollection(boxId, collection, playerData, 'box_removed');
        }

        this.cargoBoxes.delete(boxId);

        this.mapServer.broadcastToMap({
            type: 'cargo_box_removed',
            boxId: box.id,
            reason,
            x: Math.round(box.x),
            y: Math.round(box.y),
            timestamp: Date.now()
        });

        ServerLoggerWrapper.info('CARGO', `Cargo box ${boxId} removed: ${reason}`);
    }

    /**
     * Cancel an active collection and notify the player
     */
    cancelCollection(boxId, collection, playerData, reason) {
        this.activeCollections.delete(boxId);
        if (!playerData) return;

        this.sendCollectionStatus(playerData, {
            status: 'interrupted',
            cargoBoxId: boxId,
            reason: reason || 'interrupted',
            timestamp: Date.now()
        });
    }

    /**
     * Send cargo box collect status to a player
     */
    sendCollectionStatus(playerData, payload) {
        const ws = playerData?.ws;
        if (!ws || ws.readyState !== 1) return;

        // Include current resource inventory
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
                type: 'cargo_box_collect_status',
                ...payload,
                resourceInventory: normalizedResourceInventory
            }));
        } catch (error) {
            ServerLoggerWrapper.warn('CARGO', `Failed to send cargo collection status: ${error.message}`);
        }
    }

    /**
     * Returns all active cargo boxes for initial state on map join
     */
    getSerializedCargoBoxes() {
        return Array.from(this.cargoBoxes.values()).map(box => ({
            id: box.id,
            x: Math.round(box.x),
            y: Math.round(box.y),
            resourceType: box.resourceType,
            quantity: box.quantity,
            npcType: box.npcType,
            killerId: box.killerId,
            exclusiveUntil: box.exclusiveUntil,
            expiresAt: box.expiresAt
        }));
    }

    /**
     * Get player position
     */
    getPlayerPosition(playerData) {
        const playerX = Number(playerData?.position?.x ?? playerData?.x ?? 0);
        const playerY = Number(playerData?.position?.y ?? playerData?.y ?? 0);
        if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return null;
        return { x: playerX, y: playerY };
    }
}

module.exports = CargoBoxManager;
