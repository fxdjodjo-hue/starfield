import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { RewardSystem } from '../../../systems/rewards/RewardSystem';
import { DeathPopupManager } from '../../../presentation/ui/managers/death/DeathPopupManager';
import { Npc } from '../../../entities/ai/Npc';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';

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

        // Player locale morto - mostra popup respawn
        if (this.deathPopupManager) {
          this.deathPopupManager.showDeathPopup();
        } else {
          console.error('[EntityDestroyedHandler] deathPopupManager is null/undefined!');
        }
      } else {
        // Giocatore remoto morto
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        if (remotePlayerSystem) {
          remotePlayerSystem.removeRemotePlayer(entityIdStr);
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
}
