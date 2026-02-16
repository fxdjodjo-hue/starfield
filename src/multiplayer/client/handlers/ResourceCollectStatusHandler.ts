import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type ResourceCollectStatusMessage } from '../../../config/NetworkConfig';
import { LogType } from '../../../presentation/ui/LogMessage';

export class ResourceCollectStatusHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.RESOURCE_COLLECT_STATUS);
  }

  handle(message: ResourceCollectStatusMessage, networkSystem: ClientNetworkSystem): void {
    const status = String(message?.status || '').toLowerCase();
    const resourceId = typeof message?.resourceId === 'string' ? message.resourceId : '';
    const resourceName = this.resolveResourceName(message);

    const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
    if (resourceInteractionSystem && typeof resourceInteractionSystem.handleCollectionStatus === 'function') {
      resourceInteractionSystem.handleCollectionStatus(message);
    }

    const resourceInventory = this.normalizeResourceInventory(message?.resourceInventory);
    if (resourceInventory) {
      networkSystem.gameContext.playerResourceInventory = resourceInventory;
      this.notifyResourceInventoryUpdated(resourceInventory);
      this.updateCraftingPanel(networkSystem, resourceInventory);
    }

    const logSystem = networkSystem.getLogSystem();
    if (!logSystem || typeof logSystem.addLogMessage !== 'function') return;

    if (status === 'started') {
      logSystem.addLogMessage(`Raccolta ${resourceName} iniziata`, LogType.MISSION, 2600);
      return;
    }

    if (status === 'interrupted') {
      const reason = this.resolveInterruptReason(message?.reason);
      logSystem.addLogMessage(`Raccolta ${resourceName} interrotta${reason}`, LogType.ATTACK_FAILED, 2800);
      return;
    }

    if (status === 'completed') {
      logSystem.addLogMessage(`${resourceName} raccolta`, LogType.REWARD, 2600);
    }
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

    return 'risorsa';
  }

  private resolveInterruptReason(reason: unknown): string {
    const normalized = String(reason || '').toLowerCase();
    if (normalized === 'player_moved') return ' (ti sei mosso)';
    if (normalized === 'out_of_range') return ' (fuori raggio)';
    if (normalized === 'resource_unavailable') return ' (non disponibile)';
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

  private updateCraftingPanel(networkSystem: ClientNetworkSystem, resourceInventory: Record<string, number>): void {
    const uiSystem = networkSystem.getUiSystem();
    if (!uiSystem || typeof uiSystem.getUIManager !== 'function') return;

    const uiManager = uiSystem.getUIManager();
    const craftingPanel = uiManager?.getPanel?.('crafting-panel');
    if (craftingPanel && typeof (craftingPanel as any).update === 'function') {
      (craftingPanel as any).update({ resourceInventory });
    }
  }

  private notifyResourceInventoryUpdated(resourceInventory: Record<string, number>): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('playerResourceInventoryUpdated', {
      detail: { resourceInventory }
    }));
  }
}
