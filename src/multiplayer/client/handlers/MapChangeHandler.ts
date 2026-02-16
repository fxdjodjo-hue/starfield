import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, secureLogger } from '../../../config/NetworkConfig';
import { Transform } from '../../../entities/spatial/Transform';
import { ParallaxLayer } from '../../../entities/spatial/ParallaxLayer';
import { Portal } from '../../../entities/spatial/Portal';
import { SpaceStation } from '../../../entities/spatial/SpaceStation';
import { Asteroid } from '../../../entities/spatial/Asteroid';
import { EntityFactory } from '../../../systems/game/EntityFactory';
import { PortalSystem } from '../../../systems/game/PortalSystem';
import { Sprite } from '../../../entities/Sprite';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';

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

        // 🎵 STOP CURRENT MUSIC: Silence immediately when transition starts
        const audioSystem = networkSystem.getAudioSystem();
        if (audioSystem && typeof audioSystem.stopMusic === 'function') {
            audioSystem.stopMusic();
        }



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

                // Visualizziamo la nave sopra il video
                const sprite = ecs.getComponent(playerEntity, Sprite);
                if (sprite) sprite.visible = true;

                const animatedSprite = ecs.getComponent(playerEntity, AnimatedSprite);
                if (animatedSprite) animatedSprite.visible = true;

                // Snap camera to new position instantly (avoid slide effect)
                const allSystems = ecs.getSystems();
                const cameraSystem = allSystems.find(s => (s as any).constructor?.Type === 'CameraSystem') as any;
                if (cameraSystem && typeof cameraSystem.snapTo === 'function') {
                    cameraSystem.snapTo(position.x, position.y);
                    secureLogger.log(`Camera snapped to new position`);
                }

                // UNLOCK INPUT (Fix for stuck player)
                const playerControlSystem = allSystems.find(s => (s as any).constructor?.name === 'PlayerControlSystem') as any;
                if (playerControlSystem) {
                    if (typeof playerControlSystem.setInputForcedDisabled === 'function') {
                        playerControlSystem.setInputForcedDisabled(false);
                    }
                    if (typeof playerControlSystem.forceStopMovement === 'function') {
                        playerControlSystem.forceStopMovement(); // Reset movement state to be safe
                    }
                    secureLogger.log(`Player input unlocked`);
                }
            }
        }

        // 3.5 PAUSE POSITION UPDATES: REMOVED for Server Sync Alignment
        // We want to send updates immediately so the server knows exactly where we are
        // networkSystem.pausePositionUpdates(2500);

        // 4. Update GameContext and reload background/entities
        const context = networkSystem.gameContext;
        if (context) {
            context.currentMapId = mapId;

            // RELOAD MAP IMMEDIATELY (Instant Teleport)
            // Reload background (static method)
            EntityFactory.createMapBackground(ecs, context);

            // Recreate map-specific entities (Portals, Stations)
            const assets = networkSystem.getAssets();
            if (assets) {
                EntityFactory.createMapEntities(ecs, assets, mapId);
            } else {
                console.error('[MapChangeHandler] Cannot create map entities - assets unavailable!');
            }

            const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
            if (resourceInteractionSystem) {
                const resourceNodes = Array.isArray(message.resources) ? message.resources : [];
                resourceInteractionSystem.syncResources(resourceNodes);
            }

            // Update Minimap system if available
            const minimapSystem = networkSystem.getMinimapSystem();
            if (minimapSystem && typeof minimapSystem.updateMapData === 'function') {
                const w = worldWidth || 21000;
                const h = worldHeight || 13100;
                minimapSystem.updateMapData(mapId, w, h, mapName);
            }

            // Show arrival UI
            const uiSystem = networkSystem.getUiSystem();
            if (uiSystem && typeof uiSystem.showMapTransitionName === 'function') {
                uiSystem.showMapTransitionName(mapId, 3000);
            }

            // Ensure Warp Video is off (Safety)
            if (uiSystem && typeof uiSystem.stopWarpMode === 'function') {
                uiSystem.stopWarpMode(0);
            }

            // 🌍 SCREEN SHAKE ON ARRIVAL: Impact effect
            const cameraSystem = ecs.getSystems().find((s: any) => s.constructor.name === 'CameraSystem') as any;
            if (cameraSystem && typeof cameraSystem.shake === 'function') {
                cameraSystem.shake(15, 1000);
            }

            // 🎵 CHANGE MUSIC
            const audioSystem = networkSystem.getAudioSystem();
            if (audioSystem && typeof audioSystem.playMusic === 'function') {
                audioSystem.playMusic(mapId);
                secureLogger.log(`Switching music to: ${mapId}`);
            }

            secureLogger.log(`Background and entities reloaded for: ${mapId}`);

            // RESET PORTAL SYSTEM STATE (Allow reuse)
            // Use instanceof for reliability (constructor.name fails if minified)
            const portalSystem = ecs.getSystems().find((s: any) => s instanceof PortalSystem) as PortalSystem | undefined;
            if (portalSystem) {
                secureLogger.log('[MapChangeHandler] Calling portalSystem.resetTransitionState()');
                portalSystem.resetTransitionState();
            } else {
                secureLogger.warn('[MapChangeHandler] Could not find PortalSystem (instanceof check failed)!');
            }
        }

        secureLogger.log(`Successfully transitioned to map: ${mapId}`);
    }

    /**
     * Cleans up all remote entities from the ECS
     */
    private cleanupWorld(networkSystem: ClientNetworkSystem): void {
        const ecs = networkSystem.getECS();
        if (!ecs) return;

        // Stop all portal sounds BEFORE removing entities
        const allSystems = ecs.getSystems();
        const portalSystem = allSystems.find(s => s instanceof PortalSystem) as PortalSystem | undefined;
        if (portalSystem && typeof portalSystem.stopAllPortalSounds === 'function') {
            portalSystem.stopAllPortalSounds();
        }

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
