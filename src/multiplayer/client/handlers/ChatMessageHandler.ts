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
    // Usa playerId se disponibile, altrimenti clientId come fallback
    const senderPlayerId = message.playerId;
    const localPlayerId = networkSystem.gameContext?.playerId;
    const isOwnMessage = message.clientId === networkSystem.clientId || 
                         (senderPlayerId && localPlayerId && senderPlayerId === localPlayerId);
    
    if (isOwnMessage) {
      return;
    }

    // Inoltra il messaggio al ChatManager per la visualizzazione
    
    // Usa playerId come senderId se disponibile, altrimenti clientId come fallback
    // L'ID del messaggio usa playerId se disponibile per identificare univocamente il player
    const senderId = senderPlayerId ? `${senderPlayerId}` : message.clientId;
    const messageId = message.id || `chat_${message.timestamp}_${senderId}_${message.content.substring(0, 20)}`;
    
    this.chatManager.receiveNetworkMessage({
      id: messageId,
      senderId: senderId,
      senderName: message.senderName,
      content: message.content,
      timestamp: new Date(message.timestamp),
      type: 'user',
      isAdministrator: message.isAdministrator || false
    });
  }
}

