import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { RepairEffect } from '../../../entities/combat/RepairEffect';

/**
 * Handles player_left messages from the server
 * Removes disconnected players from the game
 */
export class PlayerLeftHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_LEFT);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const currentMapId = networkSystem.gameContext?.currentMapId;
    const messageMapId = message?.mapId;
    // Map-strict filter: once currentMapId is known, accept only packets for that map.
    // This also drops stale packets that do not carry mapId.
    if (currentMapId && messageMapId !== currentMapId) {
      return;
    }

    const { clientId } = message;
    const ecs = networkSystem.getECS();

    // 🚀 PULIZIA EFFETTI RIPARAZIONE: prima di rimuovere il player, puliamo i suoi effetti visivi
    if (ecs && clientId) {
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      const playerEntityId = remotePlayerSystem?.getRemotePlayerEntity(clientId);

      if (playerEntityId !== undefined) {
        const repairEffectEntities = ecs.getEntitiesWithComponents(RepairEffect);
        for (const entity of repairEffectEntities) {
          const repairEffect = ecs.getComponent(entity, RepairEffect);
          if (repairEffect && repairEffect.targetEntityId === playerEntityId) {
            ecs.removeEntity(entity);
          }
        }
      }
    }

    // Remove the disconnected player
    if (networkSystem.remotePlayerManager) {
      networkSystem.remotePlayerManager.removePlayer(clientId);
    }
  }
}
