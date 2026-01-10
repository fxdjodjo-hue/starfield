import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { WelcomeMessage } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Transform } from '../../../entities/spatial/Transform';

/**
 * Handles welcome messages from the server
 * Sets the local client ID and initial state when the server welcomes the player
 * (Server Authoritative - riceve lo stato iniziale dal server)
 */
export class WelcomeHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.WELCOME);
  }

  handle(message: WelcomeMessage, networkSystem: ClientNetworkSystem): void {
    // Set the local client ID (WebSocket connection ID)
    const serverClientId = message.clientId || networkSystem.clientId;
    networkSystem.gameContext.localClientId = serverClientId;
    // Update the network system's clientId to match the server-assigned ID
    networkSystem.clientId = serverClientId;

    // Salva l'auth ID dell'utente (UUID Supabase)
    networkSystem.gameContext.authId = message.playerId;

    // Nota: playerId UUID ora è salvato in gameContext.authId
    // Il playerId numerico è salvato in gameContext.playerId

      // Salva il player_id numerico del giocatore REGISTRATO (per display/HUD)
    if (message.playerDbId && message.playerDbId > 0) {
      // Salva il player_id numerico valido
      networkSystem.gameContext.playerId = message.playerDbId;

      // 🔧 FIX RACE CONDITION: Invece di chiamare direttamente il callback,
      // segnaliamo che abbiamo ricevuto il player ID e lasciamo che il sistema
      // principale gestisca l'inizializzazione sequenziale

      // Il callback verrà chiamato dal sistema principale dopo l'inizializzazione completa
      // per evitare race conditions
      networkSystem.markAsInitialized();

    } else {
      // IMPOSSIBILE: server non dovrebbe mai inviare playerDbId = 0 per utenti registrati
      console.error('🚨 [WELCOME] CRITICAL: Received invalid playerDbId:', message.playerDbId);
    }

    // SERVER AUTHORITATIVE: Ricevi lo stato iniziale dal server
    if (message.initialState) {
      const { position, inventoryLazy, upgradesLazy, questsLazy } = message.initialState;

      // IMPORTANTE: Segna che abbiamo ricevuto il welcome
      networkSystem.setHasReceivedWelcome(true);

      // Applica posizione iniziale se necessario
      const playerSystem = networkSystem.getPlayerSystem();
      const playerEntity = playerSystem?.getPlayerEntity();

      networkSystem.invalidatePositionCache();

      if (playerEntity && position) {
        const ecs = networkSystem.getECS();
        const transform = ecs?.getComponent(playerEntity, Transform);
        if (transform) {
          transform.x = position.x;
          transform.y = position.y;
          transform.rotation = position.rotation || 0;
        }
      }

      // 🔄 RICHIEDI DATI COMPLETI: Se il server ha indicato lazy loading, richiedi i dati completi
      if (inventoryLazy || upgradesLazy || questsLazy) {
        const playerId = message.playerId || networkSystem.gameContext.localClientId;
        networkSystem.requestPlayerData(playerId);
      }
    }
  }
}
