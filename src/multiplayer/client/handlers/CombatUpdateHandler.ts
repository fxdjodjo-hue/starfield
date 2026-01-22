import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { RemotePlayer } from '../../../entities/player/RemotePlayer';

/**
 * Gestisce messaggi combat_update e combat_error
 */
export class CombatUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.COMBAT_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (message.type === 'combat_error') {
      // Gestisci errori di combattimento
      this.handleCombatError(message, networkSystem);
    } else if (message.type === 'combat_update') {
      // Gestisci aggiornamenti di combattimento: se è un player remoto, aggiorna il suo target
      const { clientId, npcId, isAttacking } = message;

      // Se il clientId nel messaggio è diverso dal nostro, è un player remoto
      if (clientId && clientId !== networkSystem.clientId) {
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        const ecs = networkSystem.getECS();

        if (remotePlayerSystem && ecs) {
          const remotePlayerEntities = ecs.getEntitiesWithComponents(RemotePlayer);
          for (const entity of remotePlayerEntities) {
            const remotePlayer = ecs.getComponent(entity, RemotePlayer);
            if (remotePlayer && remotePlayer.clientId === clientId) {
              remotePlayer.targetId = isAttacking ? npcId : null;
              if (import.meta.env.DEV) {
                console.log(`[COMBAT_UPDATE] Remote player ${clientId} is now ${isAttacking ? 'attacking ' + npcId : 'idle'}`);
              }
              break;
            }
          }
        }
      }
    }
  }

  private handleCombatError(message: any, networkSystem: ClientNetworkSystem): void {
    console.warn(`[COMBAT_ERROR] ${message.code}: ${message.message}`);

    // Gestisci diversi tipi di errori
    switch (message.code) {
      case 'MULTIPLE_COMBAT_SESSIONS':
        // Il player ha provato ad iniziare un combattimento mentre ne aveva già uno attivo
        console.warn(`[COMBAT_ERROR] Multiple combat sessions blocked. Active session: ${message.activeSessionId || 'unknown'}`);
        break;

      default:
        console.warn(`[COMBAT_ERROR] Unknown error code: ${message.code}`);
    }
  }
}
