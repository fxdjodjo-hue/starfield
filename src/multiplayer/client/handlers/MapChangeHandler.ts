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

        // 0. Start transition effect (VIDEO WORMHOLE)
        const uiSystem = networkSystem.getUiSystem();
        if (uiSystem) {
            // Se esiste il metodo wormhole, usalo, altrimenti fallback al fadeToBlack
            if (typeof uiSystem.playWormholeTransition === 'function') {
                uiSystem.playWormholeTransition(0); // Instant blackout
            } else if (typeof uiSystem.fadeToBlack === 'function') {
                uiSystem.fadeToBlack(0);
            }
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

                // Restaurata la visibilità locale (nel caso fosse stato nascosto dal PortalSystem)
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
            }
        }

        // 3.5 PAUSE POSITION UPDATES: Stay "invisible" to others during the transition
        // until the black screen/wormhole finishes (approx 2.5s)
        networkSystem.pausePositionUpdates(2500);

        // 4. Update GameContext and reload background/entities
        const context = networkSystem.gameContext;
        if (context) {
            context.currentMapId = mapId;
            // Reload background (static method)
            EntityFactory.createMapBackground(ecs, context);

            // Recreate map-specific entities (Portals, Stations)
            // Recreate map-specific entities (Portals, Stations)
            const assets = networkSystem.getAssets();
            if (assets) {
                EntityFactory.createMapEntities(ecs, assets, mapId);
            } else {
                console.error('[MapChangeHandler] Cannot create map entities - assets unavailable!');
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

        // Show map name on screen for transition effect
        // Show map name on screen for transition effect and fade in
        // Show map name on screen for transition effect and fade in/video out
        if (uiSystem) {
            if (typeof uiSystem.showMapTransitionName === 'function') {
                // Mostra il nome mappa (apparirà sopra il video se z-index > video)
                // Ritardiamo la scritta per farla apparire quando il wormhole finisce
                setTimeout(() => {
                    uiSystem.showMapTransitionName(mapId, 3000);

                    // 🌍 SCREEN SHAKE ON ARRIVAL: Impact effect
                    // Trigger a moderate shake when the player effectively "lands"
                    // Delayed slightly (500ms) to sync with full visibility
                    setTimeout(() => {
                        const cameraSystem = ecs.getSystems().find((s: any) => s.constructor.name === 'CameraSystem') as any;
                        if (cameraSystem && typeof cameraSystem.shake === 'function') {
                            cameraSystem.shake(15, 1000); // Intensity 15, Duration 1000ms (slightly longer)
                        }
                    }, 500);

                    // 🎵 CHANGE MUSIC: Play only when effectively entering (transition ends)
                    const audioSystem = networkSystem.getAudioSystem();
                    if (audioSystem && typeof audioSystem.playMusic === 'function') {
                        audioSystem.playMusic(mapId); // Uses default global volume (same as Palantir)
                        secureLogger.log(`Switching music to: ${mapId}`);
                    }
                }, 2500);
            }

            // Gestione fine transizione (Video o Blackout)
            if (typeof uiSystem.stopWormholeTransition === 'function') {
                // Tieni il wormhole per 2 secondi totali, poi fade out
                setTimeout(() => {
                    uiSystem.stopWormholeTransition(800);
                }, 2000);
            } else if (typeof uiSystem.fadeFromBlack === 'function') {
                uiSystem.fadeFromBlack(1000, 500);
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
