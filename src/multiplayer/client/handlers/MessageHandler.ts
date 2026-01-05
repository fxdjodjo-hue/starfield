import { MessageHandler } from '../types/NetworkTypes';

/**
 * Concrete base class for message handlers
 * Provides common functionality and reduces boilerplate
 */
export abstract class BaseMessageHandler extends MessageHandler {
  protected readonly messageType: string;

  constructor(messageType: string) {
    super();
    this.messageType = messageType;
  }

  canHandle(type: string): boolean {
    return type === this.messageType;
  }
}
