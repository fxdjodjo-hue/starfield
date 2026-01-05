import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio npc_left quando un NPC viene rimosso dal mondo
 */
export class NpcLeftHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.NPC_LEFT);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`💥 [CLIENT] NPC left: ${message.npcId} (reason: ${message.reason})`);

    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC left');
      return;
    }

    // Rimuovi l'NPC remoto
    const removed = remoteNpcSystem.removeRemoteNpc(message.npcId);

    if (removed) {
      console.log(`✅ [CLIENT] Successfully removed NPC ${message.npcId}`);
    } else {
      console.warn(`⚠️ [CLIENT] NPC ${message.npcId} was not found or already removed`);
    }
  }
}
