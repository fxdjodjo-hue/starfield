import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles welcome messages from the server
 * Sets the local client ID when the server welcomes the player
 */
export class WelcomeHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.WELCOME);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    // Set the local client ID from the server
    networkSystem.gameContext.localClientId = message.clientId || networkSystem.clientId;

    if (import.meta.env.DEV) {
    }
  }
}
