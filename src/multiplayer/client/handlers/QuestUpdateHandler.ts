import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type QuestProgressUpdateMessage } from '../../../config/NetworkConfig';
import { ActiveQuest } from '../../../entities/quest/ActiveQuest';
import { QuestRegistry } from '../../../config/QuestConfig';

/**
 * Gestisce gli aggiornamenti del progresso delle quest inviati dal server.
 * Sostituisce la logica client-side di QuestTrackingSystem.
 */
export class QuestUpdateHandler extends BaseMessageHandler {
    constructor() {
        super(MESSAGE_TYPES.QUEST_PROGRESS_UPDATE);
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
            return;
        }

        // Aggiorna gli obiettivi
        if (message.objectives) {
            message.objectives.forEach(serverObj => {
                const localObj = quest.objectives.find(o => o.id === serverObj.id);
                if (localObj) {
                    localObj.current = serverObj.current;
                    // localObj.completed = serverObj.completed; // Property doesn't exist on local QuestObjective
                }
            });
        }

        // Aggiorna stato completamento
        if (message.isCompleted && !quest.isCompleted) {
            quest.isCompleted = true;

            // Move to completed list using QuestManager
            const questManager = networkSystem.getQuestManager();
            if (questManager) {
                // This moves it from active to completed list and triggers availability update
                questManager.completeQuest(quest.id, activeQuestComponent);
                console.log(`[QuestUpdateHandler] Quest ${quest.id} completed and moved to history.`);
            }

            // Notifica UI
            document.dispatchEvent(new CustomEvent('questDataUpdate', {
                detail: networkSystem.getQuestManager()?.getQuestData(activeQuestComponent)
            }));
        }

        // Forza aggiornamento UI
        document.dispatchEvent(new CustomEvent('requestQuestDataUpdate'));
    }
}
