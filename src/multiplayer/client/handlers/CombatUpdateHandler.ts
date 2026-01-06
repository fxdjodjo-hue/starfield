import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio combat_update per aggiornamenti di stato combattimento
 */
export class CombatUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.COMBAT_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`⚔️ [CLIENT] Combat update: player ${message.playerId} attacking=${message.isAttacking}`);

    // Per ora, il client non ha bisogno di fare molto con questi aggiornamenti
    // Il combattimento è gestito dal server e i proiettili vengono creati tramite ProjectileFiredHandler

    // In futuro potremmo usare questo per aggiornare UI o stati locali
  }
}
