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
        console.log('💬 [CHAT] Ignored own message:', message.content);
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log('💬 [CHAT] Received message from', message.senderName + ':', message.content);
    }

    // Inoltra il messaggio al ChatManager per la visualizzazione
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

