import { Quest } from '../../../entities/quest/Quest';
import { ActiveQuest } from '../../../entities/quest/ActiveQuest';
import type { QuestObjective, QuestReward, QuestData } from '../../../presentation/ui/QuestPanel';
import {
  QuestRegistry,
  QuestObjectiveFactory,
  QuestRewardFactory,
  type QuestConfig
} from '../../../config/QuestConfig';
import { initializeDefaultQuests } from '../../../config/quests';
import { gameAPI } from '../../../lib/SupabaseClient';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * QuestManager - Sistema di gestione delle quest
 * Gestisce il ciclo di vita delle quest, tracking obiettivi e assegnazione ricompense
 */
export class QuestManager {
  private availableQuests: Quest[] = [];
  private completedQuests: Quest[] = [];
  private playerId: number | null = null;

  constructor() {
    this.initializeQuests();
  }

  /**
   * Imposta il player ID per il salvataggio nel database
   */
  setPlayerId(playerId: number): void {
    this.playerId = playerId;
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

    // Limit max active quests to 3
    if (activeQuestComponent.getActiveQuests().length >= 3) {
      console.warn(`[QuestManager] Cannot accept quest ${questId}: Max active quests limit reached (3).`);
      // Notify player via UI
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('ui:system-message', {
          detail: { content: "⚠️ Max allowed active missions (3) reached!" }
        }));
      }
      return false;
    }

    // Verifica i prerequisiti prima di accettare
    if (!this.canAcceptQuest(questId)) {
      return false;
    }

    // Rimuovi dalla lista disponibile e aggiungi alle attive
    this.availableQuests = this.availableQuests.filter(q => q.id !== questId);
    activeQuestComponent.addQuest(quest);

    // SERVER-AUTHORITATIVE: Send accept request to server
    if (this.clientNetworkSystem) {
      this.clientNetworkSystem.sendMessage({
        type: MESSAGE_TYPES.QUEST_ACCEPT,
        questId: questId
      });
    }

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

    // SERVER-AUTHORITATIVE: Send abandon request to server
    if (this.clientNetworkSystem) {
      this.clientNetworkSystem.sendMessage({
        type: MESSAGE_TYPES.QUEST_ABANDON,
        questId: questId
      });
    }

    return true;
  }

  /**
   * Aggiorna il progresso di una quest (per obiettivi di tipo kill, collect, ecc.)
   * Restituisce se la quest è stata completata e quanto della quantità fornita è stata consumata.
   */
  updateQuestProgress(questId: string, objectiveId: string, activeQuestComponent: ActiveQuest, amount: number = 1): { completed: boolean, consumed: number } {
    const quest = activeQuestComponent.getQuest(questId);
    if (!quest) return { completed: false, consumed: 0 };

    const result = quest.updateObjective(objectiveId, amount);

    // Salva il progresso nel database
    if (result.consumed > 0) {
      this.saveQuestProgressToDatabase(quest);
    }

    return result;
  }

  private clientNetworkSystem: any = null;

  setClientNetworkSystem(networkSystem: any): void {
    this.clientNetworkSystem = networkSystem;
  }

  /**
   * Salva il progresso della quest nel database
   */
  /**
   * Salva il progresso della quest nel database
   * DEPRECATED: Client no longer saves to DB. Server is authoritative.
   */
  private async saveQuestProgressToDatabase(quest: Quest): Promise<void> {
    // SERVER-AUTHORITATIVE: Disabled client-side save.
    return;
  }

  /**
   * Rimuove il progresso della quest dal database (abbandono)
   */
  private async deleteQuestProgressFromDatabase(questId: string): Promise<void> {
    if (!this.playerId) return;

    try {
      const result = await gameAPI.deleteQuestProgress(this.playerId, questId);
      if (result.error) {
        console.error('[QUEST_MANAGER] Failed to delete quest progress:', result.error);
      }
    } catch (error) {
      console.error('[QUEST_MANAGER] Error deleting quest progress:', error);
    }
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

    // Ordina le quest disponibili in base all'ordine del Registro
    const registryOrder = QuestRegistry.getAll().map(q => q.id);
    const sortedAvailable = [...this.availableQuests].sort((a, b) => {
      const indexA = registryOrder.indexOf(a.id);
      const indexB = registryOrder.indexOf(b.id);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return {
      activeQuests: activeQuestComponent.getActiveQuests().map(convertQuestToInterface),
      completedQuests: this.completedQuests.map(convertQuestToInterface),
      availableQuests: sortedAvailable.map(convertQuestToInterface)
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
      }
    }
  }

  /**
   * Carica lo stato delle quest da un oggetto salvato (es. dal database)
   */
  loadState(savedQuests: any): void {
    if (!savedQuests) return;

    let questsToProcess: any[] = [];
    if (Array.isArray(savedQuests)) {
      questsToProcess = savedQuests;
    } else if (typeof savedQuests === 'object') {
      // Handle legacy/object format (Map<QuestId, QuestData>)
      questsToProcess = Object.entries(savedQuests).map(([id, data]: [string, any]) => ({
        id: id,
        ...data
      }));
    } else {
      return;
    }

    // Reset state
    this.availableQuests = [];
    this.completedQuests = [];

    // Re-initialize default availability first
    this.initializeQuests();

    // Process saved quests
    questsToProcess.forEach(savedQuest => {
      if (savedQuest.is_completed) {
        // Move to completed
        const config = QuestRegistry.get(savedQuest.id || savedQuest.quest_id);
        if (config) {
          const quest = this.createQuestFromConfig(config);
          // Restore objectives state if needed, but for completed quests it matters less
          // unless we want to show history. For now mark as completed.
          quest.isCompleted = true;
          this.completedQuests.push(quest);

          // Remove from available if it was there
          this.availableQuests = this.availableQuests.filter(q => q.id !== quest.id);
        }
      } else {
        // It's an active quest (or should be)
        // Active quests are handled by ActiveQuest component, but QuestManager 
        // needs to know they are not available anymore.
        // However, QuestManager manages 'available' and 'completed'. 
        // Active quests are usually passed in via ActiveQuest component.

        // If we want QuestManager to fully restore state, we might need to know about active quests too.
        // But typically ActiveQuest component is populated by the ECS/PlayerSystem loading logic.
        // QuestManager just needs to know "don't offer this quest as available".

        this.availableQuests = this.availableQuests.filter(q => q.id !== (savedQuest.id || savedQuest.quest_id));
      }
    });

    // Re-evaluate availability based on completed quests
    this.updateQuestAvailability();
  }

  /**
   * Ripristina le quest attive salvate
   */
  restoreActiveQuests(savedQuests: any, activeQuestComponent: ActiveQuest): void {
    if (!savedQuests) return;

    let questsToProcess: any[] = [];
    if (Array.isArray(savedQuests)) {
      questsToProcess = savedQuests;
    } else if (typeof savedQuests === 'object') {
      // Handle legacy/object format (Map<QuestId, QuestData>)
      questsToProcess = Object.entries(savedQuests).map(([id, data]: [string, any]) => ({
        id: id,
        ...data
      }));
    } else {
      return;
    }


    questsToProcess.forEach(savedQuest => {
      // Ignora quest completate (già gestite da loadState)
      if (savedQuest.is_completed) return;

      const questId = savedQuest.id || savedQuest.quest_id;


      // Controlla se la quest è già attiva
      if (activeQuestComponent.getQuest(questId)) return;

      const config = QuestRegistry.get(questId);
      if (config) {
        // Crea una nuova istanza della quest
        const quest = this.createQuestFromConfig(config);
        quest.isActive = true;

        // Ripristina il progresso degli obiettivi
        if (savedQuest.objectives && Array.isArray(savedQuest.objectives)) {
          savedQuest.objectives.forEach((savedObj: any) => {
            const objective = quest.objectives.find(o => o.id === savedObj.id);
            if (objective) {
              objective.current = savedObj.current || 0;
            }
          });
        }

        // Aggiungi al componente ActiveQuest
        activeQuestComponent.addQuest(quest);
        // Assicurati che non sia tra le disponibili
        const beforeCount = this.availableQuests.length;
        this.availableQuests = this.availableQuests.filter(q => q.id !== questId);
      } else {
        console.warn(`[QuestManager] Failed to find config for quest: ${questId}`);
      }
    });

    // Check for stuck completed quests (e.g. 40/40 but still active) and fix them
    activeQuestComponent.getActiveQuests().forEach(quest => {
      if (quest.checkCompletion()) {
        console.log(`[QuestManager] Auto-completing stuck quest: ${quest.id}`);
        quest.isCompleted = true;

        // Fix database state
        this.saveQuestProgressToDatabase(quest);

        // Auto-complete (move to completed list)
        // Note: This won't trigger UI reward notification since QuestTrackingSystem isn't involved here,
        // but it ensures the quest doesn't get stuck in active state.
        this.completeQuest(quest.id, activeQuestComponent);
      }
    });
  }

  /**
   * Ottiene una quest disponibile per ID
   */
  getAvailableQuest(questId: string): Quest | undefined {
    return this.availableQuests.find(q => q.id === questId);
  }
}
