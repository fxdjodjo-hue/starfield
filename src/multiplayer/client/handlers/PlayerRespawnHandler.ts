import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { DeathPopupManager } from '../../../presentation/ui/managers/death/DeathPopupManager';
import { Transform } from '../../../entities/spatial/Transform';
import { Sprite } from '../../../entities/Sprite';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { RespawnSystem } from '../../../core/domain/RespawnSystem';
import { PlayerPositionTracker } from '../managers/PlayerPositionTracker';

/**
 * Handles player_respawn messages from the server
 * Updates respawned players with new position and stats
 */
export class PlayerRespawnHandler extends BaseMessageHandler {
  private deathPopupManager: DeathPopupManager | null = null;

  constructor() {
    super(MESSAGE_TYPES.PLAYER_RESPAWN);
  }

  /**
   * Imposta il riferimento al DeathPopupManager
   */
  setDeathPopupManager(deathPopupManager: DeathPopupManager): void {
    this.deathPopupManager = deathPopupManager;
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, position, health, maxHealth, shield, maxShield } = message;

    // Verifica se è il player locale
    const isLocalPlayer = clientId === networkSystem.getLocalClientId();

    if (isLocalPlayer) {
      // Aggiorna la posizione del player locale nell'ECS
      const playerSystem = networkSystem.getPlayerSystem();
      const ecs = networkSystem.getECS();

      if (playerSystem && ecs) {
        const playerEntity = playerSystem.getPlayerEntity();

        if (playerEntity) {
          // Usa RespawnSystem per gestire il respawn completo
          RespawnSystem.respawnEntity(playerEntity, {
            position: { x: position.x, y: position.y },
            health: health,        // Valore corrente
            maxHealth: maxHealth,  // Valore massimo
            shield: shield,        // Valore corrente
            maxShield: maxShield   // Valore massimo
          }, ecs); // Passa l'ECS per aggiornare i componenti

          // INVALIDA IL CACHE DELLA POSIZIONE DEL PLAYER NEL POSITION TRACKER
          // Questo è CRITICO per forzare il refresh della posizione dopo il respawn
          try {
            // FERMA SUBITO IL COMBATTIMENTO quando il player respawna per evitare stati inconsistenti
            const combatSystem = ecs.getSystems().find((system: any) =>
              typeof system.stopCombatImmediately === 'function'
            ) as any;
            if (combatSystem) {
              combatSystem.stopCombatImmediately();
            }

            const positionTracker = networkSystem.getPositionTracker();
            if (positionTracker) {
              positionTracker.invalidateCache();
            }
          } catch (error) {
            console.error('[PlayerRespawnHandler] Error invalidating position cache:', error);
          }

          // Aggiorna anche la camera se necessario - cerca il CameraSystem nell'ECS
          const cameraSystem = ecs.getSystems().find(system => system.constructor.name === 'CameraSystem') as any;
          if (cameraSystem && cameraSystem.centerOn) {
            cameraSystem.centerOn(position.x, position.y);
          }

          // AGGIORNA L'UI CON I NUOVI VALORI HP/SHIELD DOPO RESPAWN
          try {
            const uiSystem = networkSystem.getUiSystem();
            if (uiSystem) {
              if (uiSystem.updatePlayerData) {
                // Passa i valori aggiornati all'HUD
                const updatedData = {
                  health: health,
                  maxHealth: maxHealth,
                  shield: shield,
                  maxShield: maxShield
                };
                uiSystem.updatePlayerData(updatedData);
              }

              // RENDI IL PLAYER DI NUOVO VISIBILE dopo il respawn
              const playerEntity = playerSystem.getPlayerEntity();
              if (playerEntity) {
                const sprite = ecs.getComponent(playerEntity, Sprite) as any;
                if (sprite) sprite.visible = true;

                const animatedSprite = ecs.getComponent(playerEntity, AnimatedSprite) as any;
                if (animatedSprite) animatedSprite.visible = true;
              }

              // 🌟 FADE IN (Ritorna la luce dopo il respawn)
              if (typeof uiSystem.fadeFromBlack === 'function') {
                uiSystem.fadeFromBlack(1000, 200);
              }
            }
          } catch (error) {
            console.error('[PlayerRespawnHandler] Error updating UI after respawn:', error);
          }
        } else {
          console.error('[PlayerRespawnHandler] Player entity not available');
        }
      } else {
        console.error('[PlayerRespawnHandler] PlayerSystem or ECS not available');
      }

      // Riabilita l'input del player
      networkSystem.setPlayerInputEnabled(true);

      // Nasconde il popup di morte
      if (this.deathPopupManager) {
        this.deathPopupManager.hideDeathPopup();
      }

    } else {
      // Update the respawned player's position and stats
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      if (remotePlayerSystem) {
        // 🚀 FIX: Usa updatePlayerPosition per aggiornamento immediato
        // Questo forza la posizione immediata senza l'effetto "volo" (interpolazione)
        // dalla posizione di morte allo spawn.
        remotePlayerSystem.updatePlayerPosition(clientId, position.x, position.y, 0);

        // Note: health/shield updates for remote players are handled via regular state sync
      }
    }
  }
}
