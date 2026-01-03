import { World } from '../infrastructure/engine/World';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { QuestManager } from './QuestManager';

/**
 * QuestTrackingSystem - Sistema che traccia gli eventi di gioco per aggiornare le quest
 * Monitora uccisioni, raccolte e altri eventi che influenzano il progresso delle quest
 */
export class QuestTrackingSystem {
  private economySystem: any = null;

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
   * Chiamato quando un NPC viene ucciso
   * Aggiorna le quest che richiedono uccisioni
   */
  onNpcKilled(npcType: string, activeQuestComponent: ActiveQuest): void {
    // Per ora gestiamo solo gli scouter - controlliamo sia minuscolo che maiuscolo
    if (npcType.toLowerCase() === 'scouter') {
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
              console.log(`🎉 Quest "${quest.title}" completata!`);

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
    if (!this.economySystem) {
      console.warn('EconomySystem not set in QuestTrackingSystem');
      return;
    }

    rewards.forEach(reward => {
      switch (reward.type) {
        case 'credits':
          if (reward.amount) {
            console.log(`Ricompensa quest ricevuta: ${reward.amount} cosmos`);
            this.economySystem.addCosmos(reward.amount, 'quest reward');
          }
          break;

        case 'experience':
          if (reward.amount) {
            console.log(`Ricompensa quest ricevuta: ${reward.amount} XP`);
            // TODO: Integrare con il sistema esperienza quando disponibile
          }
          break;

        default:
          console.log(`Ricompensa quest sconosciuta: ${reward.type}`);
      }
    });
  }
}
