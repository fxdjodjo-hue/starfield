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
              // Completa la quest e ottieni le ricompense
              const rewards = this.questManager.completeQuest(quest.id, activeQuestComponent);

              // Crea un singolo messaggio che combina completamento e ricompense
              if (this.logSystem) {
                let questMessage = `🎉 Quest "${quest.title}" completata!`;

                if (rewards) {
                  const totalCredits = rewards.reduce((sum, r) => r.type === 'credits' ? sum + r.amount : sum, 0);
                  const totalCosmos = rewards.reduce((sum, r) => r.type === 'cosmos' ? sum + r.amount : sum, 0);
                  const totalExperience = rewards.reduce((sum, r) => r.type === 'experience' ? sum + r.amount : sum, 0);
                  const totalHonor = rewards.reduce((sum, r) => r.type === 'honor' ? sum + r.amount : sum, 0);

                  const rewardParts: string[] = [];
                  if (totalCredits > 0) rewardParts.push(`${totalCredits} crediti`);
                  if (totalCosmos > 0) rewardParts.push(`${totalCosmos} cosmos`);
                  if (totalExperience > 0) rewardParts.push(`${totalExperience} XP`);
                  if (totalHonor > 0) rewardParts.push(`${totalHonor} onore`);

                  if (rewardParts.length > 0) {
                    questMessage += `\n🎁 Ricompense: ${rewardParts.join(', ')}`;
                  }
                }

                this.logSystem.addLogMessage(questMessage, LogType.REWARD, 6000); // Messaggio singolo più duraturo
              }

              // Applica comunque le ricompense al sistema economico (senza creare messaggio separato)
              if (rewards) {
                this.applyQuestRewards(rewards, false); // Passa false per non creare messaggio duplicato
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
  private applyQuestRewards(rewards: any[], createMessage: boolean = true): void {
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

    // Mostra le ricompense nel log del sistema (solo se richiesto)
    if (createMessage && this.logSystem && (totalCredits > 0 || totalCosmos > 0 || totalExperience > 0 || totalHonor > 0)) {
      this.logSystem.logReward(totalCredits, totalCosmos, totalExperience, totalHonor, 4000);
    }
  }
}
