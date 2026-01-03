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

    // Carica tutte le quest dal registry e creane istanze solo per quelle disponibili
    const allQuestConfigs = QuestRegistry.getAll();

    for (const config of allQuestConfigs) {
      // Solo quest senza prerequisiti sono disponibili inizialmente
      if (!config.prerequisites || config.prerequisites.length === 0) {
        const quest = this.createQuestFromConfig(config);
        this.availableQuests.push(quest);
      }
    }

    console.log(`📋 Initialized ${this.availableQuests.length} quests from registry (only those without prerequisites)`);
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

    // Verifica i prerequisiti prima di accettare
    if (!this.canAcceptQuest(questId)) {
      console.warn(`⚠️ Cannot accept quest "${questId}" - prerequisites not met`);
      return false;
    }

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

    // Aggiorna la disponibilità delle quest (potrebbero essere diventate disponibili nuovi quest)
    this.updateQuestAvailability();

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
    const quest = activeQuestComponent.getQuest(questId);
    if (!quest) return false;

    const questCompleted = quest.updateObjective(objectiveId);
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
   * Verifica se una quest può essere accettata (controlla prerequisiti)
   */
  canAcceptQuest(questId: string): boolean {
    const config = QuestRegistry.get(questId);
    if (!config) return false;

    // Controlla se tutti i prerequisiti sono stati completati
    if (config.prerequisites && config.prerequisites.length > 0) {
      const completedIds = this.completedQuests.map(q => q.id);
      return config.prerequisites.every(prereqId => completedIds.includes(prereqId));
    }

    return true;
  }

  /**
   * Aggiorna la disponibilità delle quest dopo il completamento di una quest
   */
  updateQuestAvailability(): void {
    const allQuestConfigs = QuestRegistry.getAll();
    const completedIds = this.completedQuests.map(q => q.id);

    for (const config of allQuestConfigs) {
      // Salta quest già disponibili o completate
      if (this.availableQuests.some(q => q.id === config.id) ||
          this.completedQuests.some(q => q.id === config.id)) {
        continue;
      }

      // Verifica se tutti i prerequisiti sono soddisfatti
      const hasPrerequisites = config.prerequisites &&
                              config.prerequisites.length > 0 &&
                              config.prerequisites.every(prereqId => completedIds.includes(prereqId));

      if (hasPrerequisites) {
        const quest = this.createQuestFromConfig(config);
        this.availableQuests.push(quest);
        console.log(`🔓 Quest "${quest.title}" ora disponibile!`);
      }
    }
  }

  /**
   * Ottiene una quest disponibile per ID
   */
  getAvailableQuest(questId: string): Quest | undefined {
    return this.availableQuests.find(q => q.id === questId);
  }
}
