import { MessageHandler } from '../types/NetworkTypes';
import { ClientNetworkSystem } from '../ClientNetworkSystem';

/**
 * Routes network messages to appropriate handlers
 * Implements the Strategy pattern for message handling
 */
export class MessageRouter {
  private handlers: MessageHandler[] = [];

  /**
   * Registers a new message handler
   * @param handler The handler to register
   */
  registerHandler(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Registers multiple handlers at once
   * @param handlers Array of handlers to register
   */
  registerHandlers(handlers: MessageHandler[]): void {
    this.handlers.push(...handlers);
  }

  /**
   * Routes a message to the appropriate handler
   * @param message The parsed message object
   * @param networkSystem The network system instance
   */
  route(message: any, networkSystem: ClientNetworkSystem): void {
    const handler = this.findHandler(message.type);

    if (handler) {
      try {
        if (import.meta.env.DEV && message.type === 'chat_message') {
        }
        handler.handle(message, networkSystem);
      } catch (error) {
        console.error(`[MessageRouter] Error handling message type '${message.type}':`, error);
      }
    } else {
      // Log unknown messages only in development
      if (import.meta.env.DEV) {
        console.warn(`[MessageRouter] No handler found for message type: ${message.type}`, {
          availableHandlers: this.handlers.map(h => h.constructor.name),
          messageType: message.type
        });
      }
    }
  }

  /**
   * Finds the handler that can handle the given message type
   * @param messageType The message type to find a handler for
   * @returns The handler that can handle the message type, or undefined
   */
  private findHandler(messageType: string): MessageHandler | undefined {
    return this.handlers.find(handler => handler.canHandle(messageType));
  }

  /**
   * Gets a handler by message type (public method for inter-handler communication)
   * @param messageType The message type to find a handler for
   * @returns The handler that can handle the message type, or undefined
   */
  getHandler(messageType: string): MessageHandler | undefined {
    return this.findHandler(messageType);
  }

  /**
   * Gets the number of registered handlers
   * @returns The number of registered handlers
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }

  /**
   * Gets all registered message types
   * @returns Array of message types that have handlers
   */
  getRegisteredTypes(): string[] {
    return this.handlers.map(handler => {
      // Find the message type by testing common types
      // This is a bit hacky but works for debugging
      const testTypes = ['welcome', 'remote_player_update', 'player_joined', 'player_left', 'heartbeat_ack', 'position_ack', 'error'];
      return testTypes.find(type => handler.canHandle(type)) || 'unknown';
    });
  }

  /**
   * Clears all registered handlers
   * Useful for testing or reinitialization
   */
  clearHandlers(): void {
    this.handlers = [];
  }
}
