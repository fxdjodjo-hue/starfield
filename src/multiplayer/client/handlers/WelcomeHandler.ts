import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type WelcomeMessage, type ClientId } from '../../../config/NetworkConfig';
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
    const serverClientId: ClientId = message.clientId || (networkSystem.clientId as ClientId);
    networkSystem.gameContext.localClientId = serverClientId;
    // Note: clientId in ClientNetworkSystem is readonly, server-assigned ID is stored in gameContext.localClientId

    // Aggiorna ChatManager con il playerId corretto (se disponibile)
    // Usa playerId se disponibile, altrimenti clientId come fallback
    const uiSystem = networkSystem.getUiSystem();
    if (uiSystem) {
      try {
        const chatManager = uiSystem.getChatManager();
        if (chatManager) {
          // Usa playerId se disponibile (più stabile, identifica il player nel database)
          // Altrimenti usa clientId come fallback (identifica la connessione WebSocket)
          const playerId = message.playerDbId;
          const localPlayerId = playerId ? `player_${playerId}` : serverClientId;
          chatManager.setLocalPlayerId(localPlayerId);
          if (import.meta.env.DEV) {
            console.log('[WelcomeHandler] Updated ChatManager localPlayerId to:', localPlayerId, {
              playerId: playerId,
              clientId: serverClientId
            });
          }
        }
      } catch (error) {
        // ChatManager potrebbe non essere ancora inizializzato, non è critico
        if (import.meta.env.DEV) {
          console.warn('[WelcomeHandler] Could not update ChatManager:', error);
        }
      }
    }

    // Salva l'auth ID dell'utente (UUID Supabase) - ora con branded type
    networkSystem.gameContext.authId = message.playerId; // playerId è ora PlayerUuid

    // Salva il player_id numerico del giocatore REGISTRATO (per display/HUD)
    if (message.playerDbId && message.playerDbId > 0) {
      // Salva il player_id numerico valido - ora con branded type
      networkSystem.gameContext.playerDbId = message.playerDbId; // playerDbId è ora PlayerDbId

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
        const playerUuid = message.playerId || networkSystem.gameContext.authId;
        networkSystem.requestPlayerData(playerUuid);
      }
    }
  }
}
