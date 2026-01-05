import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio npc_bulk_update per aggiornamenti multipli NPC
 * Ottimizzato per performance con aggiornamenti batch
 */
export class NpcBulkUpdateHandler extends BaseMessageHandler {
  private lastNpcLog = 0;
  private lastNpcCount = 0;

  constructor() {
    super(MESSAGE_TYPES.NPC_BULK_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC bulk update');
      return;
    }

    // Log aggiornamenti significativi (ogni 30 secondi per evitare spam)
    if (Math.floor(Date.now() / 30000) === Math.floor(Date.now() / 30000) && message.npcs.length > 0) {
      // Log solo se è cambiato il numero di NPC o se è passato abbastanza tempo
      const now = Date.now();
      if (!this.lastNpcLog || now - this.lastNpcLog > 30000 || this.lastNpcCount !== message.npcs.length) {
        console.log(`🔄 [CLIENT] Received bulk update for ${message.npcs.length} NPCs`);
        this.lastNpcLog = now;
        this.lastNpcCount = message.npcs.length;
      }
    }

    // Applica aggiornamenti bulk
    remoteNpcSystem.bulkUpdateNpcs(message.npcs);
  }
}
