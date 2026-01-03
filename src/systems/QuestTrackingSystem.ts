import { World } from '../infrastructure/engine/World';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { QuestManager } from './QuestManager';
import { LogSystem } from './rendering/LogSystem';
import { LogType } from '../entities/ui/LogMessage';
import {
  type QuestEvent,
  QuestEventType,
  QuestRegistry,
  ObjectiveType,
  RewardType,
  type QuestEventHandler
} from '../config/QuestConfig';

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

  constructor(
    private world: World,
    private questManager: QuestManager
  ) {}

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
  handleEvent(event: QuestEvent, activeQuests: any[]): void {
    console.log(`📡 Quest Event: ${event.type} - ${event.targetId} (${event.targetType}) x${event.amount || 1}`);
    console.log(`📋 Active quests: ${activeQuests.length}`, activeQuests.map(q => q.id));

    // Trova tutte le quest attive che potrebbero essere interessate da questo evento
    activeQuests.forEach(quest => {
      console.log(`🔍 Checking quest: ${quest.id}`);
      const questConfig = QuestRegistry.get(quest.id);
      if (!questConfig) {
        console.warn(`⚠️ Quest config not found for ${quest.id}`);
        return;
      }

      console.log(`✅ Found config for ${quest.id}, checking objectives...`);

      // Controlla ogni obiettivo della quest
      quest.objectives.forEach(objective => {
        console.log(`🎯 Checking objective: ${objective.id} (${objective.type}) - current: ${objective.current}/${objective.target}`);
        if (this.shouldUpdateObjective(objective, event)) {
          console.log(`✅ Objective matches event, updating progress...`);
          const questCompleted = this.questManager.updateQuestProgress(quest.id, objective.id, { quests: activeQuests });

          if (questCompleted) {
            console.log(`🎉 Quest ${quest.id} completed!`);
            this.handleQuestCompletion(quest);
          } else {
            console.log(`📈 Quest ${quest.id} progress updated but not completed`);
          }
        } else {
          console.log(`❌ Objective ${objective.id} does not match event`);
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

    console.log(`🔍 Checking objective match:`, {
      objectiveType: objective.type,
      objectiveTargetType: objective.targetType,
      eventType: event.type,
      eventTargetType: event.targetType,
      amount: amount
    });

    switch (objective.type) {
      case ObjectiveType.KILL:
        const killMatch = event.type === QuestEventType.NPC_KILLED &&
               event.targetType?.toLowerCase() === objective.targetType?.toLowerCase() &&
               amount > 0;
        console.log(`💀 KILL check: ${killMatch} (event: ${event.targetType?.toLowerCase()} vs objective: ${objective.targetType?.toLowerCase()})`);
        return killMatch;

      case ObjectiveType.COLLECT:
        const collectMatch = event.type === QuestEventType.ITEM_COLLECTED &&
               event.targetId === objective.targetName &&
               amount > 0;
        console.log(`📦 COLLECT check: ${collectMatch}`);
        return collectMatch;

      case ObjectiveType.EXPLORE:
        const exploreMatch = event.type === QuestEventType.LOCATION_VISITED &&
               event.targetId === objective.targetName;
        console.log(`🗺️ EXPLORE check: ${exploreMatch}`);
        return exploreMatch;

      case ObjectiveType.INTERACT:
        const interactMatch = event.type === QuestEventType.INTERACTION_COMPLETED &&
               event.targetId === objective.targetName;
        console.log(`🤝 INTERACT check: ${interactMatch}`);
        return interactMatch;

      default:
        console.warn(`⚠️ Unknown objective type: ${objective.type}`);
        return false;
    }
  }

  /**
   * Gestisce il completamento di una quest
   */
  private handleQuestCompletion(quest: any): void {
    console.log(`🎯 Quest completed: ${quest.title}`);

    // Mostra messaggio di completamento quest nel log
    if (this.logSystem) {
      this.logSystem.addLogMessage(`🎉 Quest "${quest.title}" completata!`, LogType.REWARD, 5000);
    }

    // Completa la quest e ottieni le ricompense
    const rewards = this.questManager.completeQuest(quest.id, { quests: [quest] });
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
          console.log(`🎒 Item reward: ${reward.itemId} (not implemented yet)`);
          break;

        default:
          console.warn(`⚠️ Unknown reward type: ${reward.type}`);
      }
    });

    // Mostra le ricompense nel log del sistema
    if (this.logSystem && (totalCredits > 0 || totalCosmos > 0 || totalExperience > 0 || totalHonor > 0)) {
      console.log(`🎁 Creating reward message: ${totalCredits}c, ${totalCosmos}cos, ${totalExperience}xp, ${totalHonor}h`);
      this.logSystem.logReward(totalCredits, totalCosmos, totalExperience, totalHonor, 4000);
    }
  }

  /**
   * Innesca un evento di quest manualmente (per test o eventi speciali)
   * Metodo pubblico per triggerare eventi programmaticamente
   */
  triggerEvent(event: QuestEvent): void {
    if (!this.playerEntity) {
      console.warn('⚠️ Player entity not set in QuestTrackingSystem');
      return;
    }

    const activeQuest = this.world.getECS().getComponent(this.playerEntity, ActiveQuest);
    if (activeQuest) {
      this.handleEvent(event, activeQuest.quests);
    }
  }

  /**
   * Metodo legacy per retrocompatibilità - sarà rimosso in futuro
   * @deprecated Usa triggerEvent() con QuestEvent invece
   */
  onNpcKilled(npcType: string, activeQuestComponent: ActiveQuest): void {
    console.warn('⚠️ onNpcKilled is deprecated. Use triggerEvent with QuestEvent instead.');

    // Converte la chiamata legacy in un evento moderno
    const event: QuestEvent = {
      type: QuestEventType.NPC_KILLED,
      targetId: npcType,
      targetType: npcType.toLowerCase(),
      amount: 1
    };

    this.handleEvent(event, activeQuestComponent.quests);
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
