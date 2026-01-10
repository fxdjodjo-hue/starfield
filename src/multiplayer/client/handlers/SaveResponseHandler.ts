import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';

/**
 * Handles save response messages from the server
 * Confirms that player data has been saved successfully
 */
export class SaveResponseHandler extends BaseMessageHandler {
  constructor() {
    super('save_response');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (message.success) {
      console.log('💾 [SAVE] Player data saved successfully:', message.message);
    } else {
      console.warn('💾 [SAVE] Save failed:', message.message, message.error);
    }

    // Could emit an event or update UI to show save status
    // For now, just log the response
  }
}