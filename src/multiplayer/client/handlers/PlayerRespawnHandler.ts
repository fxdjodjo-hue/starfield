import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { DeathPopupManager } from '../../../presentation/ui/managers/death/DeathPopupManager';
import { Transform } from '../../../entities/spatial/Transform';

/**
 * Handles player_respawn messages from the server
 * Updates respawned players with new position and stats
 */
export class PlayerRespawnHandler extends BaseMessageHandler {
  private deathPopupManager: DeathPopupManager | null = null;

  constructor() {
    super(MESSAGE_TYPES.PLAYER_RESPAWN);
  }

  /**
   * Imposta il riferimento al DeathPopupManager
   */
  setDeathPopupManager(deathPopupManager: DeathPopupManager): void {
    this.deathPopupManager = deathPopupManager;
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, position, health, maxHealth, shield, maxShield } = message;

    // Verifica se è il player locale
    const isLocalPlayer = clientId === networkSystem.getLocalClientId();

    if (isLocalPlayer) {
      // Player locale respawnato - aggiorna la posizione dell'entità locale
      console.log('[PlayerRespawnHandler] Local player respawned at:', position);

      // Aggiorna la posizione del player locale nell'ECS
      const playerSystem = networkSystem.getPlayerSystem();
      const ecs = networkSystem.getECS();

      if (playerSystem && ecs) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          // Aggiorna la posizione dell'entità
          const transform = ecs.getComponent(playerEntity, Transform);
          if (transform) {
            transform.x = position.x;
            transform.y = position.y;
            console.log('[PlayerRespawnHandler] Updated local player position to:', position);
          } else {
            console.error('[PlayerRespawnHandler] Transform component not found on player entity');
          }

          // Aggiorna anche la camera se necessario - cerca il CameraSystem nell'ECS
          const cameraSystem = ecs.getSystems().find(system => system.constructor.name === 'CameraSystem') as any;
          if (cameraSystem && cameraSystem.setTargetPosition) {
            cameraSystem.setTargetPosition(position.x, position.y);
            console.log('[PlayerRespawnHandler] Updated camera target position');
          }
        } else {
          console.error('[PlayerRespawnHandler] Player entity not available');
        }
      } else {
        console.error('[PlayerRespawnHandler] PlayerSystem or ECS not available');
      }

      // Riabilita l'input del player
      networkSystem.setPlayerInputEnabled(true);

      // Nasconde il popup di morte
      if (this.deathPopupManager) {
        this.deathPopupManager.hideDeathPopup();
      }

    } else {
      // Update the respawned player's position and stats
      if (networkSystem.remotePlayerManager) {
        // For remote players, use handleUpdate to update position
        // This will create the player if doesn't exist, or update if exists
        networkSystem.remotePlayerManager.handleUpdate(clientId, position, 0);

        // Note: health/shield updates for remote players would need to be handled
        // through the RemotePlayerSystem if needed for UI display
      }
    }
  }
}
