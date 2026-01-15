import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles remote player update messages from the server
 * Delegates to RemotePlayerManager for actual player management
 */
export class RemotePlayerUpdateHandler extends BaseMessageHandler {
  private updateCount = 0;
  private lastUpdateTime = 0;

  constructor() {
    super(MESSAGE_TYPES.REMOTE_PLAYER_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, position, rotation, nickname, rank } = message;
    const now = Date.now();

    // Debug: monitora frequenza aggiornamenti ogni 5 secondi
    this.updateCount++;
    if (now - this.lastUpdateTime > 5000) {
      const updatesPerSecond = this.updateCount / ((now - this.lastUpdateTime) / 1000);
      this.updateCount = 0;
      this.lastUpdateTime = now;
    }

    // Delegate to RemotePlayerManager for handling the update
    if (networkSystem.remotePlayerManager) {
      networkSystem.remotePlayerManager.handleUpdate(clientId, position, rotation, nickname, rank);
    } else {
      console.warn('[RemotePlayerUpdateHandler] No RemotePlayerManager available');
    }
  }
}
