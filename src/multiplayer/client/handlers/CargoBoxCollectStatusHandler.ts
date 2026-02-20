import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type CargoBoxCollectStatusMessage } from '../../../config/NetworkConfig';
import { LogType } from '../../../presentation/ui/LogMessage';

export class CargoBoxCollectStatusHandler extends BaseMessageHandler {
    private readonly COLLECT_AUDIO_START_DELAY_MS = 220;
    private collectAudioStartTimer: number | null = null;
    private collectAudioShouldBeActive = false;

    constructor() {
        super(MESSAGE_TYPES.CARGO_BOX_COLLECT_STATUS);
    }

    handle(message: CargoBoxCollectStatusMessage, networkSystem: ClientNetworkSystem): void {
        const status = String(message?.status || '').toLowerCase();
        const cargoBoxId = typeof message?.cargoBoxId === 'string' ? message.cargoBoxId : '';
        const audioSystem = networkSystem.getAudioSystem?.();

        const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
        if (resourceInteractionSystem && typeof resourceInteractionSystem.handleCargoBoxCollectionStatus === 'function') {
            resourceInteractionSystem.handleCargoBoxCollectionStatus(message);
        }

        // Update resource inventory if included in the message
        const resourceInventory = this.normalizeResourceInventory(message?.resourceInventory);
        if (resourceInventory) {
            networkSystem.gameContext.playerResourceInventory = resourceInventory;
            this.notifyResourceInventoryUpdated(resourceInventory);
        }

        if (status === 'started' || status === 'in_progress') {
            this.collectAudioShouldBeActive = true;
            if (audioSystem) {
                this.scheduleCollectAudioStart(audioSystem);
            }
        }

        if (status === 'interrupted' || status === 'completed') {
            this.collectAudioShouldBeActive = false;
            this.clearCollectAudioStartTimer();
            if (audioSystem && typeof audioSystem.stopSound === 'function') {
                audioSystem.stopSound('collect');
            }
        }

        const logSystem = networkSystem.getLogSystem();
        if (!logSystem || typeof logSystem.addLogMessage !== 'function') return;

        if (status === 'started') {
            logSystem.addLogMessage('Cargo box collection started', LogType.RESOURCES, 2600);
            return;
        }

        if (status === 'interrupted') {
            logSystem.addLogMessage('Cargo box collection interrupted', LogType.ATTACK_FAILED, 2800);
            return;
        }

        if (status === 'completed') {
            // Show rewards in log
            const rewards = message?.rewards;
            if (rewards && typeof rewards === 'object') {
                const rewardEntries = Object.entries(rewards)
                    .filter(([, amount]) => Number(amount) > 0)
                    .map(([type, amount]) => `+${amount} ${type}`)
                    .join(', ');
                if (rewardEntries.length > 0) {
                    logSystem.addLogMessage(`Cargo box collected: ${rewardEntries}`, LogType.RESOURCES, 3500);
                } else {
                    logSystem.addLogMessage('Cargo box collected', LogType.RESOURCES, 2600);
                }
            } else if (message.resourceType && message.quantity) {
                // Use explicit resource type and quantity
                const resourceName = message.resourceType.charAt(0).toUpperCase() + message.resourceType.slice(1);
                logSystem.addLogMessage(`Cargo box collected: ${message.quantity}x ${resourceName}`, LogType.RESOURCES, 3500);
            } else {
                logSystem.addLogMessage('Cargo box collected', LogType.RESOURCES, 2600);
            }
        }
    }

    private scheduleCollectAudioStart(audioSystem: any): void {
        const isAlreadyPlaying = typeof audioSystem.isSoundPlaying === 'function'
            ? audioSystem.isSoundPlaying('collect')
            : false;

        if (isAlreadyPlaying || this.collectAudioStartTimer !== null) return;
        if (typeof audioSystem.playSound !== 'function') return;

        this.collectAudioStartTimer = window.setTimeout(() => {
            this.collectAudioStartTimer = null;
            if (!this.collectAudioShouldBeActive) return;

            const stillNotPlaying = typeof audioSystem.isSoundPlaying === 'function'
                ? !audioSystem.isSoundPlaying('collect')
                : true;

            if (stillNotPlaying) {
                audioSystem.playSound('collect', 0.35, true, false, 'effects');
            }
        }, this.COLLECT_AUDIO_START_DELAY_MS);
    }

    private clearCollectAudioStartTimer(): void {
        if (this.collectAudioStartTimer === null) return;
        window.clearTimeout(this.collectAudioStartTimer);
        this.collectAudioStartTimer = null;
    }

    private normalizeResourceInventory(rawInventory: unknown): Record<string, number> | null {
        if (!rawInventory || typeof rawInventory !== 'object') return null;

        const normalizedInventory: Record<string, number> = {};
        for (const [rawType, rawQuantity] of Object.entries(rawInventory as Record<string, unknown>)) {
            const resourceType = String(rawType || '').trim();
            if (!resourceType) continue;

            const parsedQuantity = Number(rawQuantity);
            normalizedInventory[resourceType] = Number.isFinite(parsedQuantity)
                ? Math.max(0, Math.floor(parsedQuantity))
                : 0;
        }

        return normalizedInventory;
    }

    private notifyResourceInventoryUpdated(resourceInventory: Record<string, number>): void {
        if (typeof document === 'undefined') return;
        document.dispatchEvent(new CustomEvent('playerResourceInventoryUpdated', {
            detail: { resourceInventory }
        }));
    }
}
