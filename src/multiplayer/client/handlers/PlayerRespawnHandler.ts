import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles player_respawn messages from the server
 * Updates respawned players with new position and stats
 */
export class PlayerRespawnHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_RESPAWN);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, position, health, maxHealth, shield, maxShield } = message;

    console.log(`🔄 [CLIENT] Player ${clientId} respawned at (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`);

    // Update the respawned player's position and stats
    if (networkSystem.remotePlayerManager) {
      // For remote players, update their interpolation target
      const remotePlayerEntity = networkSystem.remotePlayerManager.getRemotePlayerEntity(clientId);
      if (remotePlayerEntity) {
        // Update position through interpolation system
        networkSystem.remotePlayerManager.updatePlayerPosition(clientId, position.x, position.y, 0);

        // Update health/shield if the UI needs it
        networkSystem.remotePlayerManager.updatePlayerStats(clientId, health, maxHealth, shield, maxShield);
      }
    }

    // If this is our own player respawning, we might need special handling
    if (clientId === networkSystem.getLocalClientId()) {
      console.log(`🔄 [CLIENT] Local player respawned!`);
      // The server will send position updates, so our client should automatically sync
    }
  }
}
