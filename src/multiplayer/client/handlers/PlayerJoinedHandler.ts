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
    const {
      clientId,
      nickname,
      playerId,
      rank,
      leaderboardPodiumRank,
      position,
      health,
      maxHealth,
      shield,
      maxShield,
      t
    } = message;

    // Set up remote player info if RemotePlayerSystem is available
    if (networkSystem.remotePlayerManager && nickname) {
      // Use rank from message or default to 'Basic Space Pilot'
      const playerRank = rank || 'Basic Space Pilot';
      if (position && typeof position.x === 'number' && typeof position.y === 'number') {
        networkSystem.remotePlayerManager.handleUpdate(
          clientId,
          {
            x: position.x,
            y: position.y,
            velocityX: position.velocityX,
            velocityY: position.velocityY
          },
          position.rotation || 0,
          health,
          maxHealth,
          shield,
          maxShield,
          nickname,
          playerRank,
          Number(leaderboardPodiumRank || 0),
          t || Date.now()
        );
      } else {
        networkSystem.remotePlayerManager.setPlayerInfo(
          clientId,
          nickname,
          playerRank,
          Number(leaderboardPodiumRank || 0)
        );
      }
    }
  }
}
