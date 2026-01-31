import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { RewardSystem } from '../../../systems/rewards/RewardSystem';
import { DeathPopupManager } from '../../../presentation/ui/managers/death/DeathPopupManager';
import { Npc } from '../../../entities/ai/Npc';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';
import { Sprite } from '../../../entities/Sprite';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { RepairEffect } from '../../../entities/combat/RepairEffect';

/**
 * Gestisce la distruzione delle entità (NPC o giocatori morti)
 */
export class EntityDestroyedHandler extends BaseMessageHandler {
  private rewardSystem: RewardSystem | null = null;
  private deathPopupManager: DeathPopupManager | null = null;

  constructor() {
    super(MESSAGE_TYPES.ENTITY_DESTROYED);
  }

  /**
   * Imposta il riferimento al RewardSystem per assegnare ricompense
   */
  setRewardSystem(rewardSystem: RewardSystem): void {
    this.rewardSystem = rewardSystem;
  }

  /**
   * Imposta il riferimento al DeathPopupManager per gestire la morte del player locale
   */
  setDeathPopupManager(deathPopupManager: DeathPopupManager): void {
    this.deathPopupManager = deathPopupManager;
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const ecs = networkSystem.getECS();

    if (message.entityType === 'npc') {
      // NPC distrutto - NON assegnare ricompense qui (fatto in PlayerStateUpdateHandler)
      // Le ricompense vengono assegnate tramite player_state_update per evitare duplicazioni
      const npcId = message.entityId.toString();

      // PRIMA gestisci la deselezione se l'NPC era selezionato dal player
      this.handleNpcDestruction(npcId, networkSystem);

      // POI rimuovi l'NPC dal sistema remoto
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        remoteNpcSystem.removeRemoteNpc(npcId);
      }

      // TRIGGER QUEST EVENT
      const questTrackingSystem = networkSystem.getQuestTrackingSystem();
      if (questTrackingSystem) {
        // Use the handler's helper to get type, or fallback
        // message.npcType is usually set by server broadcast
        const npcType = message.npcType || 'Scouter';

        // Manually construct event to avoid importing Enums which might cause circular deps or specific import issues
        // The structure matches QuestTrackingSystem expectation
        const event = {
          type: 'NPC_KILLED', // QuestEventType.NPC_KILLED
          targetId: npcType,
          targetType: npcType.toLowerCase(),
          amount: 1
        };

        questTrackingSystem.triggerEvent(event);
      }

      // 🚀 PULIZIA EFFETTI RIPARAZIONE: se l'NPC muore, ferma gli effetti visivi
      if (ecs) {
        this.cleanupRepairEffects(ecs, message.entityId);
      }
    } else if (message.entityType === 'player') {
      // Verifica se è il player locale
      const localClientId = networkSystem.getLocalClientId();
      const entityIdStr = message.entityId.toString();

      if (entityIdStr === localClientId) {

        // FERMA SUBITO IL COMBATTIMENTO quando il player muore
        const ecs = networkSystem.getECS();
        if (ecs) {
          const combatSystem = ecs.getSystems().find((system: any) =>
            typeof system.stopCombatImmediately === 'function'
          ) as any;
          if (combatSystem) {
            combatSystem.stopCombatImmediately();
          }
        }

        // DISABILITA SUBITO L'INPUT per evitare "navi zombie" durante l'esplosione
        networkSystem.setPlayerInputEnabled(false);
        networkSystem.forceStopPlayerMovement();

        // NASCONDI LA NAVE durante l'esplosione
        if (ecs) {
          const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
          if (playerEntity) {
            const sprite = ecs.getComponent(playerEntity, Sprite) as any;
            if (sprite) sprite.visible = false;

            const animatedSprite = ecs.getComponent(playerEntity, AnimatedSprite) as any;
            if (animatedSprite) animatedSprite.visible = false;

            // 🚀 PULIZIA EFFETTI RIPARAZIONE: se moriamo, fermiamo gli effetti visivi
            if (ecs) {
              this.cleanupRepairEffects(ecs, playerEntity.id);
            }
          }
        }

        // Player locale morto - mostra popup respawn con ritardo per far vedere l'esplosione
        if (this.deathPopupManager) {
          // Determina il nome di chi ci ha ucciso
          let killerName = 'Unknown Enemy';
          const destroyerId = message.destroyerId;

          // Ensure ECS is available for killer identification
          const ecsForKiller = networkSystem.getECS();
          if (destroyerId && ecsForKiller) {
            // 1. Cerca tra i player remoti
            const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
            const remoteInfo = remotePlayerSystem?.getRemotePlayerInfo(destroyerId.toString());

            if (remoteInfo) {
              killerName = remoteInfo.nickname;
            } else {
              // 2. Cerca tra gli NPC
              const npcEntities = ecsForKiller.getEntitiesWithComponents(Npc);
              const npcEntity = npcEntities.find(e => {
                const n = ecsForKiller.getComponent(e, Npc);
                return n && n.serverId === destroyerId.toString();
              });

              if (npcEntity) {
                const npc = ecsForKiller.getComponent(npcEntity, Npc);
                killerName = npc?.npcType || 'Enemy Pilot';
              }
            }
          }

          setTimeout(() => {
            // Verifica che il manager esista ancora (safety check)
            if (this.deathPopupManager) {
              this.deathPopupManager.showDeathPopup(killerName);
            }
          }, 2000); // 2 secondi di ritardo
        } else {
          console.error('[EntityDestroyedHandler] deathPopupManager is null/undefined!');
        }
      } else {
        // Giocatore remoto morto
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        if (remotePlayerSystem) {
          remotePlayerSystem.removeRemotePlayer(entityIdStr);
        }

        // 🚀 PULIZIA EFFETTI RIPARAZIONE: se il player remoto muore, ferma gli effetti visivi
        if (ecs) {
          this.cleanupRepairEffects(ecs, message.entityId);
        }
      }
    }

    // TODO: Aggiungere effetti visivi di distruzione (esplosioni, particle effects, etc.)
    // Per ora, le esplosioni vengono gestite dal server attraverso messaggi separati
  }

  /**
   * Gestisce la distruzione di un NPC, incluso il reset della selezione se necessario
   */
  private handleNpcDestruction(npcId: string, networkSystem: ClientNetworkSystem): void {
    const ecs = networkSystem.getECS();
    if (!ecs) {
      return;
    }

    // Trova l'entità NPC usando il RemoteNpcSystem se possibile, o cercando il componente
    let npcEntity = null;
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();

    if (remoteNpcSystem) {
      const entityId = remoteNpcSystem.getRemoteNpcEntity(npcId);
      if (entityId !== undefined) {
        npcEntity = ecs.getEntity(entityId);
      }
    }

    // Fallback search se RemoteNpcSystem non ha trovato (non dovrebbe succedere se sincronizzato)
    if (!npcEntity) {
      const npcEntities = ecs.getEntitiesWithComponents(Npc);
      npcEntity = npcEntities.find(entity => {
        const npc = ecs.getComponent(entity, Npc);
        return npc && npc.serverId === npcId;
      });
    }

    if (npcEntity) {
      // Verifica se questo NPC era selezionato
      const selectedNpcs = ecs.getEntitiesWithComponents(SelectedNpc);
      const wasSelected = selectedNpcs.some(entity => entity.id === npcEntity!.id);

      if (wasSelected) {
        // L'NPC era selezionato - deselezionalo e resetta la rotazione
        const playerControlSystem = ecs.getSystems().find((system: any) =>
          typeof system.deselectNpcAndReset === 'function'
        ) as any;
        if (playerControlSystem) {
          playerControlSystem.deselectNpcAndReset(npcEntity, false); // Definitivo
          playerControlSystem.deactivateAttack();
        }
      }
    }
  }

  /**
   * Estrae il tipo NPC dal messaggio del server
   * Ora il server include direttamente npcType nel messaggio
   */
  private extractNpcTypeFromMessage(message: any): string {
    // Il server ora include npcType direttamente nel messaggio
    return message.npcType || 'Scouter'; // Fallback a Scouter se non presente
  }

  /**
   * Rimuove tutti gli effetti di riparazione attivi per un'entità specifica
   */
  private cleanupRepairEffects(ecs: any, targetId: any): void {
    if (!ecs || !targetId) return;

    // Id target può essere string o number a seconda del messaggio
    const idToMatch = targetId.toString();

    const repairEffectEntities = ecs.getEntitiesWithComponents(RepairEffect);
    for (const entity of repairEffectEntities) {
      const repairEffect = ecs.getComponent(entity, RepairEffect);
      if (repairEffect) {
        // Verifica corrispondenza ID
        // Alcune entità hanno serverId (string), altre id (number)
        const effectTargetId = repairEffect.targetEntityId;

        // Se l'Id dell'entità target in ECS corrisponde all'ID distruttore
        const targetEntityInEcs = ecs.getEntity(effectTargetId);
        if (targetEntityInEcs) {
          // Controlla se l'entità target in ECS è quella che stiamo distruggendo
          // Dobbiamo verificare se il suo serverId (se NPC/Remote) o il suo Id (se local) matchano
          if (targetEntityInEcs.id.toString() === idToMatch) {
            ecs.removeEntity(entity);
            continue;
          }

          // Fallback check per Npc/RemotePlayer components
          const npc = ecs.getComponent(targetEntityInEcs, Npc);
          if (npc && npc.serverId === idToMatch) {
            ecs.removeEntity(entity);
            continue;
          }

          // Import per RemotePlayer se necessario, ma di solito targetEntityId è l'id ECS
          // Se targetEntityId === idToMatch (number strings) should be enough
          if (effectTargetId.toString() === idToMatch) {
            ecs.removeEntity(entity);
          }
        } else if (effectTargetId.toString() === idToMatch) {
          // Se l'entità non c'è più ma l'ID matchava comunque
          ecs.removeEntity(entity);
        }
      }
    }
  }
}
