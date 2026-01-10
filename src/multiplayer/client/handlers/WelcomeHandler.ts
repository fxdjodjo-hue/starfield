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
    console.log('🎉 [WELCOME] Welcome message received!', {
      clientId: message.clientId,
      playerId: message.playerId,
      playerDbId: message.playerDbId
    });

    // Set the local client ID (WebSocket connection ID)
    networkSystem.gameContext.localClientId = message.clientId || networkSystem.clientId;

    // Nota: playerId UUID non viene salvato in localPlayer (che è di tipo PlayerState)
    // Il playerId numerico è salvato in gameContext.playerId

      // Salva il player_id numerico del giocatore REGISTRATO (per display/HUD)
    if (message.playerDbId && message.playerDbId > 0) {
      // Salva il player_id numerico valido
      networkSystem.gameContext.playerId = message.playerDbId;

      // 🔧 FIX RACE CONDITION: Invece di chiamare direttamente il callback,
      // segnaliamo che abbiamo ricevuto il player ID e lasciamo che il sistema
      // principale gestisca l'inizializzazione sequenziale
      console.log('🎯 [WELCOME] Player ID received, marking system as ready for initialization:', message.playerDbId);

      // Il callback verrà chiamato dal sistema principale dopo l'inizializzazione completa
      // per evitare race conditions
      networkSystem.markAsInitialized();

    } else {
      // IMPOSSIBILE: server non dovrebbe mai inviare playerDbId = 0 per utenti registrati
      console.error('🚨 [WELCOME] CRITICAL: Received invalid playerDbId:', message.playerDbId);
    }

    // SERVER AUTHORITATIVE: Ricevi lo stato iniziale dal server
    if (message.initialState) {
      const { position } = message.initialState;

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
          console.log('📍 [WELCOME] Applicando posizione iniziale server authoritative:', position);
          transform.x = position.x;
          transform.y = position.y;
          transform.rotation = position.rotation || 0;
          console.log('✅ [WELCOME] Posizione iniziale sincronizzata con server');
        }
      }
    }
  }
}
