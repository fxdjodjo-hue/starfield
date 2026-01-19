import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce messaggi combat_update e combat_error
 */
export class CombatUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.COMBAT_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (message.type === 'combat_error') {
      // Gestisci errori di combattimento
      this.handleCombatError(message, networkSystem);
    } else {
      // Gestisci aggiornamenti di combattimento normali
      // Combat update received and processed
    }
  }

  private handleCombatError(message: any, networkSystem: ClientNetworkSystem): void {
    console.warn(`[COMBAT_ERROR] ${message.code}: ${message.message}`);

    // Gestisci diversi tipi di errori
    switch (message.code) {
      case 'MULTIPLE_COMBAT_SESSIONS':
        // Il player ha provato ad iniziare un combattimento mentre ne aveva già uno attivo
        console.warn(`[COMBAT_ERROR] Multiple combat sessions blocked. Active session: ${message.activeSessionId || 'unknown'}`);
        break;

      default:
        console.warn(`[COMBAT_ERROR] Unknown error code: ${message.code}`);
    }
  }
}
