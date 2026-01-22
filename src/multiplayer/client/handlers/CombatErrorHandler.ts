import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { CombatErrorMessage } from '../../../config/NetworkConfig';

/**
 * Handles combat error messages from the server
 * (missile misses, combat failures, etc.)
 */
export class CombatErrorHandler extends BaseMessageHandler {
  constructor() {
    super('combat_error');
  }

  handle(message: CombatErrorMessage, networkSystem: ClientNetworkSystem): void {
    // Log combat errors silently - these are normal (missiles missing targets, etc.)
    // console.log(`[COMBAT_ERROR] ${message.error}`, message.details || '');
  }
}