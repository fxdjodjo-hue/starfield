import { Quest } from '../entities/quest/Quest';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import type { QuestObjective, QuestReward, QuestData } from '../ui/QuestPanel';
import {
  QuestRegistry,
  QuestObjectiveFactory,
  QuestRewardFactory,
  initializeDefaultQuests,
  type QuestConfig
} from '../config/QuestConfig';

/**
 * QuestManager - Sistema di gestione delle quest
 * Gestisce il ciclo di vita delle quest, tracking obiettivi e assegnazione ricompense
 */
export class QuestManager {
  private availableQuests: Quest[] = [];
  private completedQuests: Quest[] = [];

  constructor() {
    this.initializeQuests();
  }

  /**
   * Inizializza le quest disponibili nel gioco
   */
  private initializeQuests(): void {
    // Inizializza le quest di default dal registry
    initializeDefaultQuests();

    // Carica tutte le quest dal registry e creale come istanze
    const allQuestConfigs = QuestRegistry.getAll();

    for (const config of allQuestConfigs) {
      const quest = this.createQuestFromConfig(config);
      this.availableQuests.push(quest);
    }

    console.log(`📋 Initialized ${this.availableQuests.length} quests from registry`);
  }

  /**
   * Crea un'istanza Quest da una configurazione
   */
  private createQuestFromConfig(config: QuestConfig): Quest {
    // Crea obiettivi dalla configurazione
    const objectives = config.objectives.map(objConfig =>
      QuestObjectiveFactory.create(objConfig)
    );

    // Crea ricompense dalla configurazione
    const rewards = config.rewards.map(rewardConfig =>
      QuestRewardFactory.create(rewardConfig)
    );

    // Crea e restituisci la quest
    return new Quest(
      config.id,
      config.title,
      config.description,
      config.type,
      objectives,
      rewards
    );
  }

  /**
   * Accetta una quest e la rende attiva
   */
  acceptQuest(questId: string, activeQuestComponent: ActiveQuest): boolean {
    const quest = this.availableQuests.find(q => q.id === questId);
    if (!quest) return false;

    // Rimuovi dalla lista disponibile e aggiungi alle attive
    this.availableQuests = this.availableQuests.filter(q => q.id !== questId);
    activeQuestComponent.addQuest(quest);

    return true;
  }

  /**
   * Completa una quest e assegna le ricompense
   */
  completeQuest(questId: string, activeQuestComponent: ActiveQuest): QuestReward[] | null {
    const quest = activeQuestComponent.getQuest(questId);
    if (!quest || !quest.isCompleted) return null;

    // Rimuovi dalla lista attiva e aggiungi alle completate
    activeQuestComponent.removeQuest(questId);
    this.completedQuests.push(quest);

    // Restituisci le ricompense
    return quest.rewards;
  }

  /**
   * Abbandona una quest attiva
   */
  abandonQuest(questId: string, activeQuestComponent: ActiveQuest): boolean {
    const quest = activeQuestComponent.getQuest(questId);
    if (!quest) return false;

    // Rimuovi dalla lista attiva
    activeQuestComponent.removeQuest(questId);

    // Resetta il progresso della quest per poterla riaccettare in futuro
    quest.resetProgress();

    // Rimetti tra le quest disponibili
    this.availableQuests.push(quest);

    return true;
  }

  /**
   * Aggiorna il progresso di una quest (per obiettivi di tipo kill)
   */
  updateQuestProgress(questId: string, objectiveId: string, activeQuestComponent: ActiveQuest): boolean {
    console.log(`📈 Updating quest progress: ${questId}, objective: ${objectiveId}`);

    const quest = activeQuestComponent.getQuest(questId);
    if (!quest) {
      console.log(`❌ Quest ${questId} not found in active quests`);
      return false;
    }

    console.log(`✅ Found quest ${questId}, updating objective ${objectiveId}`);
    const questCompleted = quest.updateObjective(objectiveId);
    console.log(`📊 Quest completed: ${questCompleted}`);

    return questCompleted;
  }

  /**
   * Ottiene i dati per l'UI del pannello quest
   */
  getQuestData(activeQuestComponent: ActiveQuest): QuestData {
    // Converte le istanze della classe Quest nel formato interfaccia per l'UI
    const convertQuestToInterface = (quest: Quest) => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      type: quest.type,
      objectives: quest.objectives,
      rewards: quest.rewards,
      progress: quest.getProgress(),
      isCompleted: quest.isCompleted,
      isActive: quest.isActive
    });

    return {
      activeQuests: activeQuestComponent.getActiveQuests().map(convertQuestToInterface),
      completedQuests: this.completedQuests.map(convertQuestToInterface),
      availableQuests: this.availableQuests.map(convertQuestToInterface)
    };
  }

  /**
   * Verifica se una quest è disponibile per essere accettata
   */
  isQuestAvailable(questId: string): boolean {
    return this.availableQuests.some(q => q.id === questId);
  }

  /**
   * Ottiene una quest disponibile per ID
   */
  getAvailableQuest(questId: string): Quest | undefined {
    return this.availableQuests.find(q => q.id === questId);
  }
}
