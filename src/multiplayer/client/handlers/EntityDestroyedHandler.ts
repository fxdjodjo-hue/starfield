import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce la distruzione delle entità (NPC o giocatori morti)
 */
export class EntityDestroyedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.ENTITY_DESTROYED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (message.entityType === 'npc') {
      // NPC distrutto
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        remoteNpcSystem.removeRemoteNpc(message.entityId);
      }
    } else if (message.entityType === 'player') {
      // Giocatore remoto morto
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      if (remotePlayerSystem) {
        remotePlayerSystem.removeRemotePlayer(message.entityId);
      }
    }

    // Gestisci ricompense se presenti
    if (message.rewards) {
      // Rewards are handled by the reward system
    }

    // TODO: Aggiungere effetti visivi di distruzione (esplosioni, particle effects, etc.)
    // Per ora, le esplosioni vengono gestite dal server attraverso messaggi separati
  }
}
