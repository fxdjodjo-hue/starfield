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
    console.log(`💀 [CLIENT] Entity destroyed: ${message.entityType} ${message.entityId} by ${message.destroyerId}`);

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
        console.log(`💀 [CLIENT] Player ${message.entityId} has been defeated!`);
      }
    }

    // Gestisci ricompense se presenti
    if (message.rewards) {
      console.log(`🎁 [CLIENT] Rewards gained: ${message.rewards.credits} credits, ${message.rewards.experience} XP, ${message.rewards.honor} honor`);
    }

    // TODO: Aggiungere effetti visivi di distruzione (esplosioni, particle effects, etc.)
  }
}
