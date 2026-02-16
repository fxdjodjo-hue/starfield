import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type WelcomeMessage, type ClientId } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Transform } from '../../../entities/spatial/Transform';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { PlayerRole } from '../../../entities/player/PlayerRole';
import { PLAYTEST_CONFIG } from '../../../config/GameConstants';
import { EntityFactory } from '../../../systems/game/EntityFactory';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { createPlayerShipAnimatedSprite } from '../../../core/services/PlayerShipSpriteFactory';
import { getSelectedPlayerShipSkinId, getUnlockedPlayerShipSkinIds } from '../../../config/ShipSkinConfig';

/**
 * Handles welcome messages from the server
 * Sets the local client ID and initial state when the server welcomes the player
 * (Server Authoritative - riceve lo stato iniziale dal server)
 */
export class WelcomeHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.WELCOME);
  }

  async handle(message: WelcomeMessage, networkSystem: ClientNetworkSystem): Promise<void> {
    // Set the local client ID (WebSocket connection ID)
    const serverClientId: ClientId = message.clientId || (networkSystem.clientId as ClientId);

    networkSystem.updateClientId(serverClientId);
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
        inventoryLazy, upgradesLazy, questsLazy, isAdministrator, rank, shipSkins
      } = message.initialState;

      // IMPORTANTE: Segna che abbiamo ricevuto il welcome
      // Il welcome è già gestito da updateClientId() che imposta isReady()

      // Applica posizione iniziale se necessario
      const playerSystem = networkSystem.getPlayerSystem();
      const playerEntity = playerSystem?.getPlayerEntity();
      const resolvedSelectedSkinId = getSelectedPlayerShipSkinId(shipSkins?.selectedSkinId || null);
      const resolvedUnlockedSkinIds = getUnlockedPlayerShipSkinIds(
        shipSkins?.unlockedSkinIds || [],
        resolvedSelectedSkinId
      );

      networkSystem.gameContext.playerShipSkinId = resolvedSelectedSkinId;
      networkSystem.gameContext.unlockedPlayerShipSkinIds = resolvedUnlockedSkinIds;

      networkSystem.invalidatePositionCache();

      if (playerEntity) {
        const ecs = networkSystem.getECS();
        const assetManager = networkSystem.gameContext.assetManager;
        if (ecs && assetManager) {
          try {
            const playerAnimatedSprite = await createPlayerShipAnimatedSprite(assetManager, resolvedSelectedSkinId);
            ecs.addComponent(playerEntity, AnimatedSprite, playerAnimatedSprite);

            const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
            if (remotePlayerSystem && typeof remotePlayerSystem.updateSharedAnimatedSprite === 'function') {
              remotePlayerSystem.updateSharedAnimatedSprite(playerAnimatedSprite);
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn(`[WelcomeHandler] Failed to apply ship skin "${resolvedSelectedSkinId}"`, error);
            }
          }
        }
      }

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
          // Apply max + current atomically to avoid clamping current to stale max on login.
          healthComponent.setHealth(health, maxHealth);
          if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied health: ${health}/${maxHealth}`);
        }
      }

      if (playerEntity && shield !== undefined && maxShield !== undefined) {
        const ecs = networkSystem.getECS();
        const shieldComponent = ecs?.getComponent(playerEntity, Shield);
        if (shieldComponent) {
          // Apply max + current atomically to avoid clamping current to stale max on login.
          shieldComponent.setShield(shield, maxShield);
          if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied shield: ${shield}/${maxShield}`);
        }
      }

      // Applica lo status di Administrator (Server Authoritative)
      // 🔧 FIX: Store in GameContext if player entity doesn't exist yet
      if (isAdministrator !== undefined) {
        // Always store in GameContext for later application
        networkSystem.gameContext.pendingAdministrator = isAdministrator;

        if (playerEntity) {
          const ecs = networkSystem.getECS();
          const playerRole = ecs?.getComponent(playerEntity, PlayerRole);
          if (playerRole) {
            playerRole.setAdministrator(isAdministrator);
            if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied admin status: ${isAdministrator}`);
          }
        } else {
          if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Stored pending admin status: ${isAdministrator} (player entity not ready)`);
        }
      }

      // Applica il Rank (Server Authoritative)
      if (rank !== undefined) {
        if (playerEntity) {
          const ecs = networkSystem.getECS();
          const playerRole = ecs?.getComponent(playerEntity, PlayerRole);
          if (playerRole) {
            playerRole.setRank(rank);
            if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[WELCOME] Applied rank: ${rank}`);
          }
        }
      }

      // 🔄 RICHIEDI DATI COMPLETI: Se il server ha indicato lazy loading, richiedi i dati completi
      if (inventoryLazy || upgradesLazy || questsLazy) {
        const playerUuid = message.playerId || networkSystem.gameContext.authId;
        networkSystem.requestPlayerData(playerUuid);
      }

      // 🌍 MAP INITIALIZATION: Inizializza background ed entità della mappa
      const mapId = message.mapId || 'palantir';
      const ecs = networkSystem.getECS();
      if (ecs) {
        // console.log(`[WELCOME] Initializing map entities for: ${mapId}`);
        networkSystem.gameContext.currentMapId = mapId;

        // 🗺️ UPDATE MINIMAP: Sincronizza il nome della mappa nella minimappa
        const minimapSystem = networkSystem.getMinimapSystem();
        if (minimapSystem && typeof minimapSystem.updateMapData === 'function') {
          // Dimensioni fallback standard 21000x13100 se non specificate
          minimapSystem.updateMapData(mapId, 21000, 13100);
        }

        // 🖥️ UPDATE UI INDICATOR: Aggiorna l'indicatore testuale della mappa
        if (uiSystem && typeof uiSystem.updateMapIndicator === 'function') {
          uiSystem.updateMapIndicator(mapId);
        }

        // 🧼 CLEANUP: Rimuovi le entità caricate di default per evitare duplicati
        EntityFactory.cleanupMapEntities(ecs);

        // Carica background della mappa
        EntityFactory.createMapBackground(ecs, networkSystem.gameContext);

        // Crea entità specifiche della mappa (Portali, Stazioni, ecc.)
        let assets = networkSystem.getAssets();

        // 🔄 FALLBACK: Se gli assets non sono ancora registrati nel networkSystem,
        // creali on-demand usando l'assetManager
        if (!assets) {
          // console.log('[WELCOME] Assets not in networkSystem, loading on-demand...');
          const assetManager = networkSystem.gameContext.assetManager;
          if (assetManager) {
            try {
              const teleportAnimatedSprite = await assetManager.createAnimatedSprite('assets/teleport/teleport', 1.0);
              const spaceStationSprite = await assetManager.createSprite('assets/spacestation/spacestation.png');
              const asteroidSprite = await assetManager.createSprite('assets/asteroid/asteroid.png');

              assets = {
                teleportAnimatedSprite,
                spaceStationSprite,
                asteroidSprite
              };

              // Registra gli assets nel networkSystem per uso futuro
              networkSystem.setAssets(assets);
              // console.log('[WELCOME] On-demand assets loaded and registered.');
            } catch (e) {
              console.error('[WELCOME] Failed to load on-demand assets:', e);
            }
          }
        }

        if (assets) {
          EntityFactory.createMapEntities(ecs, assets, mapId);
        } else {
          console.error('[WELCOME] Cannot create map entities - assets unavailable!');
        }
      }
    }
  }
}
