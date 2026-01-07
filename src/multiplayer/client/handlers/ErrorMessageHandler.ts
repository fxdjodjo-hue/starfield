import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { ErrorMessage } from '../types/MessageTypes';
import { ChatManager } from '../../../systems/ui/ChatManager';

/**
 * Handles error messages from the server (rate limiting, validation errors, etc.)
 */
export class ErrorMessageHandler extends BaseMessageHandler {
  constructor(private chatManager: ChatManager) {
    super('error');
  }

  handle(message: ErrorMessage, networkSystem: ClientNetworkSystem): void {
    if (import.meta.env.DEV) {
      console.log('🚫 [ERROR] Received error from server:', message.message);
    }

    // Inoltra l'errore al ChatManager per la visualizzazione
    this.chatManager.receiveError(message.message);
  }
}
