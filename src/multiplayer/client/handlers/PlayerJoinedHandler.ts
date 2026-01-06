import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles player_joined messages from the server
 * Logs when a new player connects and optionally sets up remote player info
 */
export class PlayerJoinedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_JOINED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, nickname, playerId } = message;

    // Set up remote player info if RemotePlayerSystem is available
    if (networkSystem.remotePlayerManager && nickname) {
      // For now, use a default rank. In the future, this could come from the server
      const defaultRank = 'Recruit';
      networkSystem.remotePlayerManager.setPlayerInfo(clientId, nickname, defaultRank);
    }
  }
}
