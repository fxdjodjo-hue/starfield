import { World } from '../infrastructure/engine/World';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { QuestManager } from './QuestManager';

/**
 * QuestTrackingSystem - Sistema che traccia gli eventi di gioco per aggiornare le quest
 * Monitora uccisioni, raccolte e altri eventi che influenzano il progresso delle quest
 */
export class QuestTrackingSystem {
  constructor(
    private world: World,
    private questManager: QuestManager
  ) {}

  /**
   * Chiamato quando un NPC viene ucciso
   * Aggiorna le quest che richiedono uccisioni
   */
  onNpcKilled(npcType: string, activeQuestComponent: ActiveQuest): void {
    // Per ora gestiamo solo gli scouter
    if (npcType === 'scouter') {
      this.updateKillQuests('scouter', activeQuestComponent);
    }
  }

  /**
   * Aggiorna le quest che richiedono uccisioni di un certo tipo
   */
  private updateKillQuests(npcType: string, activeQuestComponent: ActiveQuest): void {
    // Trova tutte le quest attive che richiedono uccisioni di questo tipo
    activeQuestComponent.quests.forEach(quest => {
      if (quest.type === 'kill') {
        // Cerca obiettivi che richiedono uccisioni di questo tipo
        quest.objectives.forEach(objective => {
          if (objective.type === 'kill' && objective.description.toLowerCase().includes(npcType.toLowerCase())) {
            const questCompleted = this.questManager.updateQuestProgress(quest.id, objective.id, activeQuestComponent);

            if (questCompleted) {
              console.log(`Quest "${quest.title}" completata!`);

              // Completa la quest e ottieni le ricompense
              const rewards = this.questManager.completeQuest(quest.id, activeQuestComponent);
              if (rewards) {
                this.applyQuestRewards(rewards);
              }
            }
          }
        });
      }
    });
  }

  /**
   * Applica le ricompense della quest completata
   */
  private applyQuestRewards(rewards: any[]): void {
    rewards.forEach(reward => {
      switch (reward.type) {
        case 'credits':
          if (reward.amount) {
            console.log(`Ricompensa ricevuta: ${reward.amount} cosmos`);
            // TODO: Integrare con il sistema economico per aggiungere i credits
            this.addCreditsToPlayer(reward.amount);
          }
          break;

        case 'experience':
          if (reward.amount) {
            console.log(`Ricompensa ricevuta: ${reward.amount} XP`);
            // TODO: Integrare con il sistema esperienza
          }
          break;

        default:
          console.log(`Ricompensa sconosciuta: ${reward.type}`);
      }
    });
  }

  /**
   * Aggiunge credits al giocatore (placeholder - da integrare con EconomySystem)
   */
  private addCreditsToPlayer(amount: number): void {
    // TODO: Integrare con il vero sistema economico
    console.log(`Aggiunti ${amount} cosmos al giocatore`);

    // Per ora, possiamo cercare l'entità player e aggiornare i suoi credits
    // Questo sarà da implementare quando avremo il sistema economico integrato
  }
}
