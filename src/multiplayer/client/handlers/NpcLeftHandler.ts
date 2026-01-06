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
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC left');
      return;
    }

    // Rimuovi l'NPC remoto
    remoteNpcSystem.removeRemoteNpc(message.npcId);
  }
}
