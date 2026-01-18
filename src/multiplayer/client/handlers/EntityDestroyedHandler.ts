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

      // PRIMA gestisci la deselezione se l'NPC era selezionato dal player
      this.handleNpcDestruction(message.entityId, networkSystem);

      // POI rimuovi l'NPC dal sistema remoto
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        const removed = remoteNpcSystem.removeRemoteNpc(message.entityId);
      }
    } else if (message.entityType === 'player') {
      // Verifica se è il player locale
      const localClientId = networkSystem.getLocalClientId();

  if (message.entityId === localClientId) {

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
          remotePlayerSystem.removeRemotePlayer(message.entityId);
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
    console.log(`[EntityDestroyedHandler] Processing NPC destruction: ${npcId}`);
    const ecs = networkSystem.getECS();
    if (!ecs) {
      console.log(`[EntityDestroyedHandler] No ECS found`);
      return;
    }

    // Trova l'entità NPC che sta per essere distrutta
    const npcEntities = ecs.getEntitiesWithComponents(Npc);
    console.log(`[EntityDestroyedHandler] Found ${npcEntities.length} NPC entities`);
    const npcEntity = npcEntities.find(entity => entity.id === npcId);

    if (npcEntity) {
      console.log(`[EntityDestroyedHandler] Found NPC entity ${npcId} to destroy`);
      // Verifica se questo NPC era selezionato
      const selectedNpcs = ecs.getEntitiesWithComponents(SelectedNpc);
      console.log(`[EntityDestroyedHandler] Found ${selectedNpcs.length} selected NPCs`);
      const wasSelected = selectedNpcs.some(entity => entity.id === npcId);

      console.log(`[EntityDestroyedHandler] NPC ${npcId} was selected: ${wasSelected}`);

      if (wasSelected) {
        // L'NPC era selezionato - deselezionalo e resetta la rotazione
        console.log(`[EntityDestroyedHandler] NPC ${npcId} was selected, calling deselectNpcAndReset`);
        const playerControlSystem = ecs.getSystems().find((system: any) =>
          typeof system.deselectNpcAndReset === 'function'
        ) as any;
        if (playerControlSystem) {
          console.log(`[EntityDestroyedHandler] Found PlayerControlSystem, calling deselectNpcAndReset`);
          playerControlSystem.deselectNpcAndReset(npcEntity, false); // Definitivo
          playerControlSystem.deactivateAttack();
          console.log(`[EntityDestroyedHandler] Called deselectNpcAndReset and deactivateAttack`);
        } else {
          console.log(`[EntityDestroyedHandler] PlayerControlSystem not found!`);
        }
      } else {
        console.log(`[EntityDestroyedHandler] NPC ${npcId} was not selected, no action needed`);
      }
    } else {
      console.log(`[EntityDestroyedHandler] NPC entity ${npcId} not found in ECS`);

      // Anche se l'entità non è trovata, potrebbe essere selezionata - controlla comunque
      const selectedNpcs = ecs.getEntitiesWithComponents(SelectedNpc);
      console.log(`[EntityDestroyedHandler] Checking if ${npcId} was selected among ${selectedNpcs.length} selected NPCs`);
      const wasSelected = selectedNpcs.some(entity => entity.id === npcId);

      if (wasSelected) {
        console.log(`[EntityDestroyedHandler] NPC ${npcId} was selected but entity not found - force reset`);
        // Crea un'entità fittizia per deselezionare
        const dummyNpcEntity = { id: npcId } as any;
        const playerControlSystem = ecs.getSystems().find((system: any) =>
          typeof system.deselectNpcAndReset === 'function'
        ) as any;
        if (playerControlSystem) {
          playerControlSystem.deselectNpcAndReset(dummyNpcEntity, false);
          playerControlSystem.deactivateAttack();
          console.log(`[EntityDestroyedHandler] Force reset combat state for missing NPC ${npcId}`);
        }
      }
    }
  }

  /**
   * Estrae il tipo NPC dall'entityId del server (es. "npc_6" -> "Scouter")
   * Per ora usa una logica semplice basata sull'ID, ma potrebbe essere migliorata
   */
  private extractNpcTypeFromId(entityId: string): string {
    // Il server potrebbe includere il tipo nel messaggio in futuro
    // Per ora assumiamo che gli NPC con ID < 25 siano Scouter, gli altri Kronos
    const npcNumber = parseInt(entityId.replace('npc_', ''));
    return npcNumber < 25 ? 'Scouter' : 'Kronos';
  }
}
