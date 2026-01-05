import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio npc_joined quando un nuovo NPC viene creato nel mondo
 */
export class NpcJoinedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.NPC_JOINED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`🆕 [CLIENT] New NPC joined: ${message.npcId} (${message.npcType})`);

    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC joined');
      return;
    }

    // Crea il nuovo NPC remoto
    const entityId = remoteNpcSystem.addRemoteNpc(
      message.npcId,
      message.npcType,
      message.position.x,
      message.position.y,
      message.health,
      message.shield,
      message.behavior
    );

    if (entityId !== -1) {
      console.log(`✅ [CLIENT] Successfully created NPC ${message.npcId} (entity: ${entityId})`);
    } else {
      console.error(`❌ [CLIENT] Failed to create NPC ${message.npcId}`);
    }
  }
}
