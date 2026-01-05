import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce i danni ricevuti dalle entità (NPC o giocatori)
 */
export class EntityDamagedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.ENTITY_DAMAGED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`💔 [CLIENT] Entity damaged: ${message.entityType} ${message.entityId} (-${message.damage} HP)`);

    if (message.entityType === 'npc') {
      // Danno a NPC
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        remoteNpcSystem.updateRemoteNpc(message.entityId, undefined, {
          current: message.newHealth,
          max: message.newHealth // TODO: gestire max health correttamente
        });
      }
    } else if (message.entityType === 'player') {
      // Danno a giocatore remoto
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      if (remotePlayerSystem) {
        remotePlayerSystem.updateRemotePlayerHealth(message.entityId, message.newHealth, message.newShield);
      }
    }

    // TODO: Aggiungere effetti visivi di danno (particle effects, screen shake, etc.)
  }
}
