import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { StopCombatMessage } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio stop_combat inviato dal server quando ferma automaticamente il combattimento
 */
export class StopCombatHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.STOP_COMBAT);
  }

  handle(message: StopCombatMessage, networkSystem: ClientNetworkSystem): void {

    // Usa il metodo del ClientNetworkSystem per fermare il combattimento
    networkSystem.stopCombat();

    // In futuro potremmo mostrare un messaggio al player
    // es. "Combattimento interrotto: fuori dal range dell'NPC"
  }
}
