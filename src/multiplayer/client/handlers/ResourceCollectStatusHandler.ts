import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type ResourceCollectStatusMessage } from '../../../config/NetworkConfig';
import { LogType } from '../../../presentation/ui/LogMessage';

export class ResourceCollectStatusHandler extends BaseMessageHandler {
  private readonly COLLECT_AUDIO_START_DELAY_MS = 220;
  private collectAudioStartTimer: number | null = null;
  private collectAudioShouldBeActive = false;

  constructor() {
    super(MESSAGE_TYPES.RESOURCE_COLLECT_STATUS);
  }

  handle(message: ResourceCollectStatusMessage, networkSystem: ClientNetworkSystem): void {
    const status = String(message?.status || '').toLowerCase();
    const resourceId = typeof message?.resourceId === 'string' ? message.resourceId : '';
    const resourceName = this.resolveResourceName(message);
    const audioSystem = networkSystem.getAudioSystem?.();

    const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
    if (resourceInteractionSystem && typeof resourceInteractionSystem.handleCollectionStatus === 'function') {
      resourceInteractionSystem.handleCollectionStatus(message);
    }

    const resourceInventory = this.normalizeResourceInventory(message?.resourceInventory);
    if (resourceInventory) {
      networkSystem.gameContext.playerResourceInventory = resourceInventory;
      this.notifyResourceInventoryUpdated(resourceInventory);
      this.updateCraftingPanel(
        networkSystem,
        resourceInventory,
        networkSystem.gameContext?.playerPetState ?? null
      );
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
      logSystem.addLogMessage(`Collection of ${resourceName} started`, LogType.MISSION, 2600);
      return;
    }

    if (status === 'interrupted') {
      const reason = this.resolveInterruptReason(message?.reason);
      logSystem.addLogMessage(`Collection of ${resourceName} interrupted${reason}`, LogType.ATTACK_FAILED, 2800);
      return;
    }

    if (status === 'completed') {
      logSystem.addLogMessage(`${resourceName} collected`, LogType.REWARD, 2600);
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

  private resolveResourceName(message: ResourceCollectStatusMessage): string {
    const name = typeof message?.resourceName === 'string'
      ? message.resourceName.trim()
      : '';
    if (name.length > 0) return name;

    const typeName = typeof message?.resourceType === 'string'
      ? message.resourceType.trim()
      : '';
    if (typeName.length > 0) return typeName;

    return 'resource';
  }

  private resolveInterruptReason(reason: unknown): string {
    const normalized = String(reason || '').toLowerCase();
    if (normalized === 'player_moved') return ' (you moved)';
    if (normalized === 'out_of_range') return ' (out of range)';
    if (normalized === 'resource_unavailable') return ' (unavailable)';
    return '';
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

  private updateCraftingPanel(
    networkSystem: ClientNetworkSystem,
    resourceInventory: Record<string, number>,
    petState?: unknown
  ): void {
    const uiSystem = networkSystem.getUiSystem();
    if (!uiSystem || typeof uiSystem.getUIManager !== 'function') return;

    const uiManager = uiSystem.getUIManager();
    const craftingPanel = uiManager?.getPanel?.('crafting-panel');
    if (craftingPanel && typeof (craftingPanel as any).update === 'function') {
      (craftingPanel as any).update({
        resourceInventory,
        petState: petState ?? networkSystem.gameContext?.playerPetState ?? undefined
      });
    }
  }

  private notifyResourceInventoryUpdated(resourceInventory: Record<string, number>): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('playerResourceInventoryUpdated', {
      detail: { resourceInventory }
    }));
  }

}
