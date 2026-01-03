import { World } from '../infrastructure/engine/World';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { QuestManager } from './QuestManager';
import { LogSystem } from './rendering/LogSystem';
import { LogType } from '../entities/ui/LogMessage';

/**
 * QuestTrackingSystem - Sistema che traccia gli eventi di gioco per aggiornare le quest
 * Monitora uccisioni, raccolte e altri eventi che influenzano il progresso delle quest
 */
export class QuestTrackingSystem {
  private economySystem: any = null;
  private logSystem: LogSystem | null = null;

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
              console.log(`🎯 Quest completed: ${quest.title}`);

              // Mostra messaggio di completamento quest nel log
              if (this.logSystem) {
                console.log(`📝 Creating quest completion message for log system`);
                this.logSystem.addLogMessage(`🎉 Quest "${quest.title}" completata!`, LogType.REWARD);
              } else {
                console.log(`❌ LogSystem not available for quest message`);
              }

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

    let totalCredits = 0;
    let totalCosmos = 0;
    let totalExperience = 0;
    let totalHonor = 0;

    rewards.forEach(reward => {
      switch (reward.type) {
        case 'credits':
          if (reward.amount) {
            totalCredits += reward.amount;
            this.economySystem.addCredits(reward.amount, 'quest reward');
          }
          break;

        case 'cosmos':
          if (reward.amount) {
            totalCosmos += reward.amount;
            this.economySystem.addCosmos(reward.amount, 'quest reward');
          }
          break;

        case 'experience':
          if (reward.amount) {
            totalExperience += reward.amount;
            // TODO: Integrare con il sistema esperienza quando disponibile
          }
          break;

        case 'honor':
          if (reward.amount) {
            totalHonor += reward.amount;
            // TODO: Integrare con il sistema onore quando disponibile
          }
          break;
      }
    });

    // Mostra le ricompense nel log del sistema
    if (this.logSystem && (totalCredits > 0 || totalCosmos > 0 || totalExperience > 0 || totalHonor > 0)) {
      console.log(`🎁 Creating reward message: ${totalCredits}c, ${totalCosmos}cos, ${totalExperience}xp, ${totalHonor}h`);
      this.logSystem.logReward(totalCredits, totalCosmos, totalExperience, totalHonor);
    } else {
      console.log(`❌ Cannot create reward message - LogSystem: ${!!this.logSystem}, Rewards: ${totalCredits + totalCosmos + totalExperience + totalHonor > 0}`);
    }
  }
}
