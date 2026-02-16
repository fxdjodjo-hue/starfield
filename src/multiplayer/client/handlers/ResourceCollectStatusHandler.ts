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
}
