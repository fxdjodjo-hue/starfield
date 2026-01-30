import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, secureLogger } from '../../../config/NetworkConfig';
import { Transform } from '../../../entities/spatial/Transform';
import { ParallaxLayer } from '../../../entities/spatial/ParallaxLayer';
import { Portal } from '../../../entities/spatial/Portal';
import { SpaceStation } from '../../../entities/spatial/SpaceStation';
import { Asteroid } from '../../../entities/spatial/Asteroid';
import { EntityFactory } from '../../../systems/game/EntityFactory';

/**
 * Handles MAP_CHANGE messages from the server
 * Responsible for cleaning up the world and preparing for the new map state
 */
export class MapChangeHandler extends BaseMessageHandler {
    constructor() {
        super(MESSAGE_TYPES.MAP_CHANGE);
    }

    handle(message: any, networkSystem: ClientNetworkSystem): void {
        secureLogger.log('Handling MAP_CHANGE:', message);

        const { mapId, mapName, position, worldWidth, worldHeight } = message;
        const ecs = networkSystem.getECS();
        if (!ecs) return;

        // 1. Flush remote entities (NPCs, Projectiles, Remote Players)
        // This prevents "ghost" entities from the previous map
        this.cleanupWorld(networkSystem);

        // 2. Reset interpolation and network state
        networkSystem.invalidatePositionCache();
        // Clear pending snapshots/buffers if the system supports it
        // networkSystem.getRemotePlayerSystem().clearAllInterpolationBuffers();

        // 3. Update local player position
        const playerSystem = networkSystem.getPlayerSystem();
        const playerEntity = playerSystem?.getPlayerEntity();
        if (playerEntity) {
            const transform = ecs.getComponent(playerEntity, Transform);
            if (transform) {
                transform.x = position.x;
                transform.y = position.y;
                secureLogger.log(`Local player repositioned to: ${position.x}, ${position.y}`);
            }
        }

        // 4. Update GameContext and reload background/entities
        const context = networkSystem.gameContext;
        if (context) {
            context.currentMapId = mapId;
            // Reload background (static method)
            EntityFactory.createMapBackground(ecs, context);

            // Recreate map-specific entities (Portals, Stations)
            const assets = networkSystem.getAssets();
            if (assets) {
                EntityFactory.createMapEntities(ecs, assets, mapId);
            }

            // Update Minimap system if available
            const minimapSystem = networkSystem.getMinimapSystem();
            if (minimapSystem && typeof minimapSystem.updateMapData === 'function') {
                // Use provided dimensions or fallback to current ones if not present
                const w = worldWidth || 21000;
                const h = worldHeight || 13100;
                minimapSystem.updateMapData(mapId, w, h, mapName);
            }

            secureLogger.log(`Background and entities reload triggered for: ${mapId}`);
        }

        secureLogger.log(`Successfully transitioned to map: ${mapId}`);
    }

    /**
     * Cleans up all remote entities from the ECS
     */
    private cleanupWorld(networkSystem: ClientNetworkSystem): void {
        const ecs = networkSystem.getECS();
        if (!ecs) return;

        // Remove all remote players
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        if (remotePlayerSystem) {
            remotePlayerSystem.removeAllRemotePlayers();
        }

        // Remove all remote NPCs
        const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
        if (remoteNpcSystem) {
            remoteNpcSystem.removeAllRemoteNpcs();
        }

        // Remove all remote projectiles
        const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
        if (remoteProjectileSystem) {
            remoteProjectileSystem.removeAllRemoteProjectiles();
        }

        // Remove static map entities (Background, Portals, Stations, Asteroids)
        EntityFactory.cleanupMapEntities(ecs);

        secureLogger.log(`Cleared remote and static map entities.`);
    }
}
