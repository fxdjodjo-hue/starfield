import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { ChatMessage } from '../types/MessageTypes';
import { ChatManager } from '../../../systems/ui/ChatManager';

/**
 * Handles chat messages from the server
 * Routes chat messages to the ChatManager for display
 */
export class ChatMessageHandler extends BaseMessageHandler {
  private chatManager: ChatManager;

  constructor(chatManager: ChatManager) {
    super('chat_message');
    this.chatManager = chatManager;
  }

  handle(message: ChatMessage, networkSystem: ClientNetworkSystem): void {
    // Non mostrare messaggi propri (già mostrati localmente)
    if (message.clientId === networkSystem.clientId) {
      if (import.meta.env.DEV) {
        console.log('[ChatMessageHandler] Ignoring own message:', message.clientId);
      }
      return;
    }

    // Inoltra il messaggio al ChatManager per la visualizzazione
    if (import.meta.env.DEV) {
      console.log('[ChatMessageHandler] Received chat from:', message.senderName, message.clientId);
    }
    
    this.chatManager.receiveNetworkMessage({
      id: `chat_${message.timestamp}_${message.clientId}`,
      senderId: message.clientId,
      senderName: message.senderName,
      content: message.content,
      timestamp: new Date(message.timestamp),
      type: 'user'
    });
  }
}

