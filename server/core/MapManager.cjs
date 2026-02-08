/**
 * MapManager - Centralized registry and orchestration for multi-map server.
 * Responsibilities: Map lifecycle, player migration between maps, global updates.
 */

const MapServer = require('./map-server.cjs');
const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');
const { MAP_CONFIGS } = require('../config/MapConfigs.cjs');

class MapManager {
    constructor() {
        this.maps = new Map(); // mapId -> MapServer instance
    }

    /**
     * Initialize all maps defined in configuration
     */
    initializeMaps() {
        ServerLoggerWrapper.system('Initializing MapManager and all map instances...');

        for (const [mapId, config] of Object.entries(MAP_CONFIGS)) {
            const mapInstance = new MapServer(mapId, config);
            mapInstance.initialize();
            this.maps.set(mapId, mapInstance);
            ServerLoggerWrapper.info('MAP', `Map instance '${mapId}' initialized.`);
        }
    }

    /**
     * Get a map instance by ID
     */
    getMap(mapId) {
        return this.maps.get(mapId);
    }

    /**
     * Update all active map instances (Tick)
     */
    tick() {
        for (const mapInstance of this.maps.values()) {
            mapInstance.tick();
        }
    }

    /**
     * Migrates a player from one map to another
     * @param {string} clientId - The WebSocket client ID
     * @param {string} currentMapId - Current map ID
     * @param {string} targetMapId - Destination map ID
     * @param {Object} targetPosition - {x, y} position in result map
     */
    migratePlayer(clientId, currentMapId, targetMapId, targetPosition) {
        const currentMap = this.maps.get(currentMapId);
        const targetMap = this.maps.get(targetMapId);

        if (!currentMap || !targetMap) {
            ServerLoggerWrapper.error('MAP', `Migration failed: Map not found. Source: ${currentMapId}, Target: ${targetMapId}`);
            return false;
        }

        const playerData = currentMap.players.get(clientId);
        if (!playerData) {
            ServerLoggerWrapper.warn('MAP', `Migration failed: Player ${clientId} not found in map ${currentMapId}`);
            return false;
        }

        ServerLoggerWrapper.info('MAP', `Migrating player ${clientId} from ${currentMapId} to ${targetMapId}`);

        // 1. Broadcast player_left to remaining players on the source map BEFORE removing
        const playerLeftMessage = {
            type: 'player_left',
            clientId: clientId,
            reason: 'map_change'
        };
        currentMap.broadcastToMap(playerLeftMessage, clientId);

        // 2. Remove from current map
        currentMap.removePlayer(clientId);

        // 2. Update position and MAP ID for the new map
        playerData.position.x = targetPosition.x;
        playerData.position.y = targetPosition.y;

        // 🔴 FIX: Aggiorna l'ID della mappa nel playerData per la persistenza
        // Senza questo, il DB salva solo le nuove coordinate ma con il vecchio ID mappa
        playerData.currentMapId = targetMapId;

        // 3. Add to target map
        targetMap.addPlayer(clientId, playerData);

        // 3a. BROADCAST ARRIVAL TO OTHERS
        // Notify other players on the target map immediately so they spawn this player
        const playerJoinedMsg = {
            type: 'player_joined',
            clientId: clientId,
            nickname: playerData.nickname,
            playerId: playerData.playerId,
            rank: playerData.rank || 'Basic Space Pilot',
            position: {
                x: targetPosition.x,
                y: targetPosition.y,
                rotation: (playerData.position && playerData.position.rotation) || playerData.rotation || 0,
                velocityX: 0,
                velocityY: 0
            },
            health: playerData.health,
            maxHealth: playerData.maxHealth,
            shield: playerData.shield,
            maxShield: playerData.maxShield,
            t: Date.now()
        };
        targetMap.broadcastToMap(playerJoinedMsg, clientId);

        // 4. Notify the client (Network message handling will be needed in websocket manager/server.cjs)
        const migrationMessage = {
            type: 'map_change',
            mapId: targetMapId,
            mapName: targetMap.mapName,
            position: targetPosition,
            worldWidth: targetMap.WORLD_WIDTH,
            worldHeight: targetMap.WORLD_HEIGHT,
            timestamp: Date.now()
        };

        if (playerData.ws && playerData.ws.readyState === 1) { // WebSocket.OPEN
            // Send map change first so the client cleans up the old world
            playerData.ws.send(JSON.stringify(migrationMessage));

            // Immediately send existing players in the target map to the migrating client
            for (const [existingClientId, existingPlayerData] of targetMap.players.entries()) {
                if (existingClientId === clientId) continue;
                if (!existingPlayerData.position) continue;

                const existingPlayerBroadcast = {
                    type: 'remote_player_update',
                    clientId: existingClientId,
                    position: existingPlayerData.position,
                    rotation: existingPlayerData.position.rotation || 0,
                    tick: 0,
                    nickname: existingPlayerData.nickname,
                    playerId: existingPlayerData.playerId,
                    rank: existingPlayerData.rank,
                    health: existingPlayerData.health,
                    maxHealth: existingPlayerData.maxHealth,
                    shield: existingPlayerData.shield,
                    maxShield: existingPlayerData.maxShield,
                    t: Date.now()
                };

                playerData.ws.send(JSON.stringify(existingPlayerBroadcast));
            }
        }

        return true;
    }

    /**
     * Find which map a player belongs to
     */
    findPlayerMap(clientId) {
        for (const [mapId, mapInstance] of this.maps.entries()) {
            if (mapInstance.players.has(clientId)) {
                return { mapId, mapInstance };
            }
        }
        return null;
    }
}

module.exports = new MapManager();
