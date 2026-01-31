import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { RepairEffect } from '../../../entities/combat/RepairEffect';

/**
 * Gestisce il messaggio npc_left quando un NPC viene rimosso dal mondo
 */
export class NpcLeftHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.NPC_LEFT);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    const ecs = networkSystem.getECS();

    // 🚀 PULIZIA EFFETTI RIPARAZIONE: prima di rimuovere l'NPC, puliamo i suoi effetti visivi
    if (ecs && remoteNpcSystem && message.npcId) {
      const npcEntityId = remoteNpcSystem.getRemoteNpcEntity(message.npcId);

      if (npcEntityId !== undefined) {
        const repairEffectEntities = ecs.getEntitiesWithComponents(RepairEffect);
        for (const entity of repairEffectEntities) {
          const repairEffect = ecs.getComponent(entity, RepairEffect);
          if (repairEffect && repairEffect.targetEntityId === npcEntityId) {
            ecs.removeEntity(entity);
          }
        }
      }
    }

    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC left');
      return;
    }

    // Rimuovi l'NPC remoto
    remoteNpcSystem.removeRemoteNpc(message.npcId);
  }
}
