import { World } from '../../infrastructure/engine/World';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';
import { QuestManager } from '../../core/domain/quest/QuestManager';
import { LogSystem } from '../rendering/LogSystem';
import { LogType } from '../../presentation/ui/LogMessage';
import {
  type QuestEvent,
  QuestEventType,
  QuestRegistry,
  ObjectiveType,
  RewardType,
  type QuestEventHandler
} from '../../config/QuestConfig';

/**
 * QuestTrackingSystem - Sistema modulare per tracciare eventi di gioco e aggiornare quest
 *
 * Caratteristiche principali:
 * - Event-driven architecture per massima scalabilità
 * - Supporto per molteplici tipi di eventi (kill, collect, explore, interact)
 * - Configurazione esterna tramite QuestRegistry
 * - Facile estensione per nuovi tipi di quest
 * - Single source of truth per la logica di tracking
 */
export class QuestTrackingSystem implements QuestEventHandler {
  private economySystem: any = null;
  private logSystem: LogSystem | null = null;
  private playerEntity: any = null;
  private playState: any = null; // Reference to PlayState for saving

  private world: World;
  private questManager: QuestManager;

  constructor(world: World, questManager: QuestManager, playState?: any) {
    this.world = world;
    this.questManager = questManager;
    this.playState = playState;
  }

  /**
   * Imposta il riferimento all'EconomySystem per assegnare ricompense
   */
  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
  }

  /**
   * Imposta il riferimento al LogSystem per mostrare messaggi
   */
  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
  }

  /**
   * Imposta il riferimento all'entità player
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  /**
   * Gestisce un evento di quest in modo modulare
   * Questo è il metodo principale per il tracking scalabile
   */
  handleEvent(event: QuestEvent, activeQuestComponent: ActiveQuest): void {

    // Trova tutte le quest attive che potrebbero essere interessate da questo evento
    activeQuestComponent.quests.forEach(quest => {
      const questConfig = QuestRegistry.get(quest.id);
      if (!questConfig) {
        return;
      }

      // Controlla ogni obiettivo della quest
      quest.objectives.forEach(objective => {
        if (this.shouldUpdateObjective(objective, event)) {
          const questCompleted = this.questManager.updateQuestProgress(quest.id, objective.id, activeQuestComponent);
          if (questCompleted) {
            this.handleQuestCompletion(quest, activeQuestComponent);
          }
        }
      });
    });
  }

  /**
   * Determina se un obiettivo dovrebbe essere aggiornato per un dato evento
   * Questa logica è completamente configurabile tramite QuestRegistry
   */
  private shouldUpdateObjective(objective: any, event: QuestEvent): boolean {
    const amount = event.amount || 1;

    switch (objective.type) {
      case ObjectiveType.KILL:
        return event.type === QuestEventType.NPC_KILLED &&
          event.targetType?.toLowerCase() === objective.targetType?.toLowerCase() &&
          amount > 0;

      case ObjectiveType.COLLECT:
        return event.type === QuestEventType.ITEM_COLLECTED &&
          event.targetId === objective.targetName &&
          amount > 0;

      case ObjectiveType.EXPLORE:
        return event.type === QuestEventType.LOCATION_VISITED &&
          event.targetId === objective.targetName;

      case ObjectiveType.INTERACT:
        return event.type === QuestEventType.INTERACTION_COMPLETED &&
          event.targetId === objective.targetName;

      default:
        return false;
    }
  }

  /**
   * Gestisce il completamento di una quest
   */
  private handleQuestCompletion(quest: any, activeQuestComponent: ActiveQuest): void {
    // Mostra messaggio di completamento quest nel log
    if (this.logSystem) {
      this.logSystem.addLogMessage(`Quest "${quest.title}" completed!`, LogType.REWARD, 5000);
    }

    // Completa la quest e ottieni le ricompense
    const rewards = this.questManager.completeQuest(quest.id, activeQuestComponent);
    if (rewards) {
      this.applyQuestRewards(rewards);
    }
  }

  /**
   * Applica le ricompense della quest completata
   */
  private applyQuestRewards(rewards: any[]): void {
    if (!this.economySystem) {
      console.warn('EconomySystem not set in QuestTrackingSystem');
      return;
    }

    let totalCredits = 0;
    let totalCosmos = 0;
    let totalExperience = 0;
    let totalHonor = 0;

    rewards.forEach(reward => {
      switch (reward.type) {
        case RewardType.CREDITS:
          totalCredits += reward.amount;
          this.economySystem.addCredits(reward.amount, 'quest reward');
          break;

        case RewardType.COSMOS:
          totalCosmos += reward.amount;
          this.economySystem.addCosmos(reward.amount, 'quest reward');
          break;

        case RewardType.EXPERIENCE:
          totalExperience += reward.amount;
          // TODO: Integrare con il sistema esperienza quando disponibile
          break;

        case RewardType.HONOR:
          totalHonor += reward.amount;
          // TODO: Integrare con il sistema onore quando disponibile
          break;

        case RewardType.ITEM:
          // TODO: Implementare sistema inventario per ricompense item
          break;

        default:
          break;
      }
    });

    // Mostra le ricompense nel log del sistema
    if (this.logSystem && (totalCredits > 0 || totalCosmos > 0 || totalExperience > 0 || totalHonor > 0)) {
      this.logSystem.logReward(totalCredits, totalCosmos, totalExperience, totalHonor, 4000);
    }

    // Segnala cambiamento per salvataggio event-driven
    if (this.playState && this.playState.markAsChanged) {
      this.playState.markAsChanged();
    }
  }

  /**
   * Innesca un evento di quest manualmente (per test o eventi speciali)
   * Metodo pubblico per triggerare eventi programmaticamente
   */
  triggerEvent(event: QuestEvent): void {
    if (!this.playerEntity) {
      return;
    }

    const activeQuest = this.world.getECS().getComponent(this.playerEntity, ActiveQuest);
    if (activeQuest) {
      this.handleEvent(event, activeQuest);
    }
  }

  /**
   * Metodo legacy per retrocompatibilità - sarà rimosso in futuro
   * @deprecated Usa triggerEvent() con QuestEvent invece
   */
  onNpcKilled(npcType: string, activeQuestComponent: ActiveQuest): void {
    // Converte la chiamata legacy in un evento moderno
    const event: QuestEvent = {
      type: QuestEventType.NPC_KILLED,
      targetId: npcType,
      targetType: npcType.toLowerCase(),
      amount: 1
    };

    this.handleEvent(event, activeQuestComponent);
  }

  /**
   * Valida che una quest sia ancora valida (non scaduta, prerequisiti soddisfatti, ecc.)
   */
  validateQuest(questId: string, playerLevel: number, completedQuestIds: string[]): boolean {
    const config = QuestRegistry.get(questId);
    if (!config) return false;

    // Controllo livello
    if (config.levelRequirement && playerLevel < config.levelRequirement) {
      return false;
    }

    // Controllo prerequisiti
    if (!QuestRegistry.hasPrerequisites(config, completedQuestIds)) {
      return false;
    }

    // Altri controlli futuri (tempo, stato del mondo, ecc.)
    return true;
  }

  /**
   * Ottiene suggerimenti per quest disponibili per il giocatore
   */
  getQuestSuggestions(playerLevel: number, completedQuestIds: string[]): string[] {
    const availableQuests = QuestRegistry.getAvailableForLevel(playerLevel)
      .filter(config => QuestRegistry.hasPrerequisites(config, completedQuestIds))
      .filter(config => !completedQuestIds.includes(config.id))
      .map(config => config.id);

    return availableQuests.slice(0, 3); // Limita a 3 suggerimenti
  }
}
