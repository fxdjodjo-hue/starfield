import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles player_left messages from the server
 * Removes disconnected players from the game
 */
export class PlayerLeftHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_LEFT);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId } = message;

    console.log(`👋 [CLIENT] Player left: ${clientId}`);

    // Remove the disconnected player
    if (networkSystem.remotePlayerManager) {
      networkSystem.remotePlayerManager.removePlayer(clientId);
    }
  }
}
