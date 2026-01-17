import { NetworkConnectionManager } from './NetworkConnectionManager';
import { RateLimiter, RATE_LIMITS } from './RateLimiter';
import { NetworkEventSystem } from './NetworkEventSystem';

/**
 * NetworkChatManager - Gestione messaggi chat con rate limiting
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkChatManager {
  private readonly connectionManager: NetworkConnectionManager;
  private readonly rateLimiter: RateLimiter;
  private readonly eventSystem: NetworkEventSystem;
  private readonly clientId: string;

  constructor(
    connectionManager: NetworkConnectionManager,
    rateLimiter: RateLimiter,
    eventSystem: NetworkEventSystem,
    clientId: string
  ) {
    this.connectionManager = connectionManager;
    this.rateLimiter = rateLimiter;
    this.eventSystem = eventSystem;
    this.clientId = clientId;
  }

  /**
   * Sends a chat message to the server
   */
  sendChatMessage(content: string): void {
    if (!this.connectionManager.isConnectionActive() || !this.clientId) {
      console.warn('💬 [CHAT] Cannot send message: not connected');
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      console.warn('💬 [CHAT] Cannot send empty message');
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare messaggi chat
    if (!this.rateLimiter.canSend('chat_message', RATE_LIMITS.CHAT_MESSAGE.maxRequests, RATE_LIMITS.CHAT_MESSAGE.windowMs)) {
      this.eventSystem.showRateLimitNotification('chat_message');
      return;
    }

    const message = {
      type: 'chat_message',
      clientId: this.clientId,
      content: content.trim(),
      timestamp: Date.now()
    };

    if (import.meta.env.DEV) {
      console.log('[CHAT] Sending message:', { clientId: this.clientId, content: content.trim().substring(0, 50) });
    }

    this.connectionManager.send(JSON.stringify(message));
  }
}
