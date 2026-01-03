import { Quest } from '../entities/quest/Quest';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { QuestObjective, QuestReward, QuestData } from '../ui/QuestPanel';

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
    // Quest: Uccidi 1 Scouter
    const killScouterQuest = new Quest(
      'kill_scouter_1',
      'Caccia allo Scouter',
      'Elimina 1 scouter nemico per proteggere il territorio.',
      'kill',
      [
        {
          id: 'kill_scouter',
          description: 'Uccidi 1 Scouter',
          current: 0,
          target: 1,
          type: 'kill'
        }
      ],
      [
        {
          type: 'credits',
          amount: 100
        }
      ]
    );

    this.availableQuests.push(killScouterQuest);
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
    return {
      activeQuests: activeQuestComponent.getActiveQuests(),
      completedQuests: this.completedQuests,
      availableQuests: this.availableQuests
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
