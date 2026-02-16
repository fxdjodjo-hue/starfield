import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

export class ResourceNodeRemovedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.RESOURCE_NODE_REMOVED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const resourceId = typeof message?.resourceId === 'string' ? message.resourceId : '';
    if (!resourceId) return;
    const worldX = Number(message?.x);
    const worldY = Number(message?.y);

    const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
    if (!resourceInteractionSystem) return;

    resourceInteractionSystem.removeResource(
      resourceId,
      Number.isFinite(worldX) ? worldX : undefined,
      Number.isFinite(worldY) ? worldY : undefined
    );
  }
}
