import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type WelcomeMessage, type ClientId } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Transform } from '../../../entities/spatial/Transform';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { PlayerRole } from '../../../entities/player/PlayerRole';
import { PLAYTEST_CONFIG } from '../../../config/GameConstants';

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

    // 🔄 CRITICAL: Se il server ci ha inviato un clientId persistente (player_{playerId}),
    // estrai il playerId numerico e usalo come clientId
    let clientIdToUse = serverClientId;
    if (serverClientId.startsWith('player_')) {
      const extractedId = serverClientId.replace('player_', '');
      if (!isNaN(Number(extractedId))) {
        clientIdToUse = extractedId as ClientId; // Usa solo il numero con cast branded
      }
    }

    networkSystem.updateClientId(clientIdToUse);
    networkSystem.gameContext.localClientId = clientIdToUse;

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
          const localPlayerId = playerId ? `${playerId}` : serverClientId;
          chatManager.setLocalPlayerId(localPlayerId);
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
      const {
        position, health, maxHealth, shield, maxShield,
        inventoryLazy, upgradesLazy, questsLazy, isAdministrator
      } = message.initialState;

      // IMPORTANTE: Segna che abbiamo ricevuto il welcome
      // Il welcome è già gestito da updateClientId() che imposta isReady()

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

      // Applica hp e shield iniziali dal server (valori attuali salvati nel database)
      if (playerEntity && health !== undefined && maxHealth !== undefined) {
        const ecs = networkSystem.getECS();
        const healthComponent = ecs?.getComponent(playerEntity, Health);
        if (healthComponent) {
          healthComponent.current = health;
          healthComponent.max = maxHealth;
          if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied health: ${health}/${maxHealth}`);
        }
      }

      if (playerEntity && shield !== undefined && maxShield !== undefined) {
        const ecs = networkSystem.getECS();
        const shieldComponent = ecs?.getComponent(playerEntity, Shield);
        if (shieldComponent) {
          shieldComponent.current = shield;
          shieldComponent.max = maxShield;
          if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied shield: ${shield}/${maxShield}`);
        }
      }

      // Applica lo status di Administrator (Server Authoritative)
      if (playerEntity && isAdministrator !== undefined) {
        const ecs = networkSystem.getECS();
        const playerRole = ecs?.getComponent(playerEntity, PlayerRole);
        if (playerRole) {
          playerRole.setAdministrator(isAdministrator);
          if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied admin status: ${isAdministrator}`);
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
