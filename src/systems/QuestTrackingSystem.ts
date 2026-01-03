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
    console.log(`🎯 QuestTrackingSystem: NPC killed: ${npcType}`);
    console.log(`📊 QuestTrackingSystem: Active quests: ${activeQuestComponent.quests.length}`);

    // Per ora gestiamo solo gli scouter - controlliamo sia minuscolo che maiuscolo
    if (npcType.toLowerCase() === 'scouter') {
      console.log(`✅ QuestTrackingSystem: Scouter killed, updating kill quests`);
      this.updateKillQuests('scouter', activeQuestComponent);
    } else {
      console.log(`❌ QuestTrackingSystem: NPC type ${npcType} not handled (only 'scouter' supported)`);
    }
  }

  /**
   * Aggiorna le quest che richiedono uccisioni di un certo tipo
   */
  private updateKillQuests(npcType: string, activeQuestComponent: ActiveQuest): void {
    console.log(`🔍 QuestTrackingSystem: Looking for kill quests that match ${npcType}`);

    // Trova tutte le quest attive che richiedono uccisioni di questo tipo
    activeQuestComponent.quests.forEach(quest => {
      console.log(`📋 QuestTrackingSystem: Checking quest "${quest.title}" (type: ${quest.type})`);
      if (quest.type === 'kill') {
        console.log(`🎯 QuestTrackingSystem: Found kill quest "${quest.title}"`);

        // Cerca obiettivi che richiedono uccisioni di questo tipo
        quest.objectives.forEach(objective => {
          console.log(`🎯 QuestTrackingSystem: Checking objective "${objective.description}" (type: ${objective.type})`);
          if (objective.type === 'kill' && objective.description.toLowerCase().includes(npcType.toLowerCase())) {
            console.log(`✅ QuestTrackingSystem: Objective matches! Updating progress for "${objective.description}"`);

            const questCompleted = this.questManager.updateQuestProgress(quest.id, objective.id, activeQuestComponent);
            console.log(`📊 QuestTrackingSystem: Quest completed: ${questCompleted}`);

            if (questCompleted) {
              console.log(`🎉 Quest "${quest.title}" completata!`);

              // Completa la quest e ottieni le ricompense
              const rewards = this.questManager.completeQuest(quest.id, activeQuestComponent);
              if (rewards) {
                console.log(`🎁 Quest rewards:`, rewards);
                this.applyQuestRewards(rewards);
              }
            } else {
              console.log(`⏳ Quest "${quest.title}" progress updated but not completed yet`);
            }
          } else {
            console.log(`❌ QuestTrackingSystem: Objective "${objective.description}" doesn't match`);
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
