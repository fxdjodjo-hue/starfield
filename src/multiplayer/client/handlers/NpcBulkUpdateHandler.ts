import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio npc_bulk_update per aggiornamenti multipli NPC
 * Ottimizzato per performance con aggiornamenti batch
 */
export class NpcBulkUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.NPC_BULK_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC bulk update');
      return;
    }

    // Log aggiornamenti significativi (ogni 10 secondi per evitare spam)
    if (Math.floor(Date.now() / 10000) % 2 === 0 && message.npcs.length > 0) {
      console.log(`🔄 [CLIENT] Received bulk update for ${message.npcs.length} NPCs`);
    }

    // Applica aggiornamenti bulk
    remoteNpcSystem.bulkUpdateNpcs(message.npcs);
  }
}
