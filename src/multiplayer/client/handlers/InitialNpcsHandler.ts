import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio initial_npcs inviato quando un client si connette
 * Riceve tutti gli NPC esistenti nel mondo dal server
 */
export class InitialNpcsHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.INITIAL_NPCS);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {

    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('❌ [INITIAL_NPCS] RemoteNpcSystem not available for initial NPCs');
      return;
    }


    // Rimuovi eventuali NPC esistenti (cleanup da riconnessioni)
    remoteNpcSystem.removeAllRemoteNpcs();

    // Inizializza tutti gli NPC ricevuti dal server
    remoteNpcSystem.initializeNpcsFromServer(message.npcs);

  }
}
