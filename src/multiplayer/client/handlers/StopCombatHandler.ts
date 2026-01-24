import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { StopCombatMessage } from '../../../config/NetworkConfig';
import { RemotePlayer } from '../../../entities/player/RemotePlayer';

/**
 * Gestisce il messaggio stop_combat inviato dal server quando ferma automaticamente il combattimento
 */
export class StopCombatHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.STOP_COMBAT);
  }

  handle(message: StopCombatMessage, networkSystem: ClientNetworkSystem): void {

    // Usa il metodo del ClientNetworkSystem per fermare il combattimento
    const { playerId } = message;

    // Controlla se il messaggio è per il giocatore locale o per un remoto
    const isLocalPlayer = String(playerId) === String(networkSystem.gameContext.authId) ||
      String(playerId) === String(networkSystem.getLocalClientId());

    if (isLocalPlayer) {
      // Usa il metodo del ClientNetworkSystem per fermare il combattimento locale
      networkSystem.stopCombat();
    } else {
      // Per i giocatori remoti, dobbiamo resettare il loro targetId
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      if (remotePlayerSystem) {
        // Cerca il player remoto usando l'ID (potrebbe essere authId o clientId)
        // La logica di ricerca deve essere robusta
        const remotePlayerEntities = networkSystem.getECS()?.getEntitiesWithComponents(RemotePlayer);

        if (remotePlayerEntities) {
          for (const entity of remotePlayerEntities) {
            const remotePlayer = networkSystem.getECS()?.getComponent(entity, RemotePlayer);
            // Controllo flessibile: clientId o authId (se disponibile e mappato) o targetId corrente
            // Nota: RemotePlayer ha solitamente clientId. Il messaggio potrebbe avere authId.
            // Per sicurezza controlliamo se il clientId corrisponde
            if (remotePlayer && (remotePlayer.clientId === playerId)) {
              remotePlayer.targetId = null;
              // if (import.meta.env.DEV) console.log(`[STOP_COMBAT] Remote player ${playerId} stopped attacking`);
              break;
            }
          }
        }
      }
    }

    // In futuro potremmo mostrare un messaggio al player
    // es. "Combattimento interrotto: fuori dal range dell'NPC"
  }
}
