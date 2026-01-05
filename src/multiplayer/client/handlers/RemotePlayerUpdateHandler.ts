import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles remote player update messages from the server
 * Delegates to RemotePlayerManager for actual player management
 */
export class RemotePlayerUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.REMOTE_PLAYER_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, position, rotation, nickname, rank } = message;

    // Delegate to RemotePlayerManager for handling the update
    if (networkSystem.remotePlayerManager) {
      networkSystem.remotePlayerManager.handleUpdate(clientId, position, rotation, nickname, rank);
    } else {
      console.warn('[RemotePlayerUpdateHandler] No RemotePlayerManager available');
    }
  }
}
