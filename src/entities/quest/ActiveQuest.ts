import { Quest } from './Quest';

/**
 * Componente ActiveQuest - Gestisce le quest attive del giocatore
 */
export class ActiveQuest {
  public quests: Quest[];

  constructor(
    quests: Quest[] = []
  ) {
    this.quests = quests;
  }

  /**
   * Aggiunge una nuova quest attiva
   */
  addQuest(quest: Quest): void {
    quest.isActive = true;
    this.quests.push(quest);
  }

  /**
   * Rimuove una quest completata
   */
  removeQuest(questId: string): Quest | null {
    const index = this.quests.findIndex(q => q.id === questId);
    if (index !== -1) {
      const quest = this.quests[index];
      this.quests.splice(index, 1);
      return quest;
    }
    return null;
  }

  /**
   * Trova una quest per ID
   */
  getQuest(questId: string): Quest | undefined {
    return this.quests.find(q => q.id === questId);
  }

  /**
   * Ottiene tutte le quest completate
   */
  getCompletedQuests(): Quest[] {
    return this.quests.filter(q => q.isCompleted);
  }

  /**
   * Ottiene tutte le quest attive non completate
   */
  getActiveQuests(): Quest[] {
    return this.quests.filter(q => !q.isCompleted);
  }
}
