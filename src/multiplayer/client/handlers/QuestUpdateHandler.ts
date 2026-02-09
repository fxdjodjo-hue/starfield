import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type QuestProgressUpdateMessage } from '../../../config/NetworkConfig';
import { ActiveQuest } from '../../../entities/quest/ActiveQuest';
import { QuestRegistry, RewardType } from '../../../config/QuestConfig';
import { NumberFormatter } from '../../../core/utils/ui/NumberFormatter';

/**
 * Gestisce gli aggiornamenti del progresso delle quest inviati dal server.
 * Sostituisce la logica client-side di QuestTrackingSystem.
 */
export class QuestUpdateHandler extends BaseMessageHandler {
    constructor() {
        super(MESSAGE_TYPES.QUEST_PROGRESS_UPDATE);
    }

    private logQuestCompletion(message: QuestProgressUpdateMessage, networkSystem: ClientNetworkSystem, questTitleFallback?: string): void {
        const logSystem = networkSystem.getLogSystem?.();
        if (!logSystem || typeof logSystem.logMissionCompletion !== 'function') return;

        const questConfig = QuestRegistry.get(message.questId);
        const title = questConfig?.title || questTitleFallback || message.questId;

        let rewardText = '';
        if (questConfig?.rewards && questConfig.rewards.length > 0) {
            let totalCredits = 0;
            let totalCosmos = 0;
            let totalExperience = 0;
            let totalHonor = 0;

            questConfig.rewards.forEach(reward => {
                const amount = Number(reward.amount) || 0;
                switch (reward.type) {
                    case RewardType.CREDITS:
                        totalCredits += amount;
                        break;
                    case RewardType.COSMOS:
                        totalCosmos += amount;
                        break;
                    case RewardType.EXPERIENCE:
                        totalExperience += amount;
                        break;
                    case RewardType.HONOR:
                        totalHonor += amount;
                        break;
                    default:
                        break;
                }
            });

            const f = (n: number) => NumberFormatter.format(n);
            const rewardLines: string[] = [];
            if (totalCredits > 0) rewardLines.push(`${f(totalCredits)} Credits`);
            if (totalCosmos > 0) rewardLines.push(`${f(totalCosmos)} Cosmos`);
            if (totalExperience > 0) rewardLines.push(`${f(totalExperience)} Experience`);
            if (totalHonor > 0) rewardLines.push(`${f(totalHonor)} Honor`);

            if (rewardLines.length > 0) {
                rewardText = `Rewards: ${rewardLines.join(', ')}`;
            }
        }

        logSystem.logMissionCompletion(title, rewardText);
    }

    handle(message: QuestProgressUpdateMessage, networkSystem: ClientNetworkSystem): void {
        const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
        const ecs = networkSystem.getECS();

        if (!playerEntity || !ecs) return;

        const activeQuestComponent = ecs.getComponent(playerEntity, ActiveQuest);
        if (!activeQuestComponent) return;

        const quest = activeQuestComponent.getQuest(message.questId);

        // Se la quest non c'è, forse dovremmo accettarla/ricaricarla? 
        // Per ora assumiamo che debba esistere se riceviamo update.
        if (!quest) {
            console.warn(`[QuestUpdateHandler] Received update for unknown active quest: ${message.questId}`);
            if (message.isCompleted) {
                const questManager = networkSystem.getQuestManager();
                if (questManager) {
                    const completedNow = questManager.forceCompleteQuest(message.questId, activeQuestComponent);
                    if (completedNow) {
                        this.logQuestCompletion(message, networkSystem);
                    }
                }
                document.dispatchEvent(new CustomEvent('requestQuestDataUpdate'));
            }
            return;
        }

        // Aggiorna gli obiettivi
        if (message.objectives) {
            message.objectives.forEach(serverObj => {
                const localObj = quest.objectives.find(o => o.id === serverObj.id);
                if (localObj) {
                    localObj.current = serverObj.current;
                    if (typeof serverObj.target === 'number') {
                        localObj.target = serverObj.target;
                    }
                    // localObj.completed = serverObj.completed; // Property doesn't exist on local QuestObjective
                }
            });
        }

        // Aggiorna stato completamento (non bloccare se giÃ  completata: forza sync)
        const completionFromMessage = message.isCompleted === true;
        const completionByObjectives = (typeof quest.checkCompletion === 'function' && quest.checkCompletion());
        const shouldComplete = completionFromMessage || completionByObjectives;
        if (shouldComplete) {
            const questManager = networkSystem.getQuestManager();
            let completedNow = false;

            if (questManager) {
                completedNow = questManager.forceCompleteQuest(quest.id, activeQuestComponent);
            } else {
                // Fallback: evita quest bloccate in attivo
                quest.isCompleted = true;
            }

            if (completedNow || completionFromMessage) {
                this.logQuestCompletion(message, networkSystem, quest.title);
            }
            console.log(`[QuestUpdateHandler] Quest ${quest.id} completed and moved to history.`);

            // Notifica UI
            document.dispatchEvent(new CustomEvent('questDataUpdate', {
                detail: questManager?.getQuestData(activeQuestComponent)
            }));
        }

        // Forza aggiornamento UI
        document.dispatchEvent(new CustomEvent('requestQuestDataUpdate'));
    }
}
