import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { RepairEffect } from '../../../entities/combat/RepairEffect';

/**
 * Handler per repair_complete (quando la riparazione è completata, tutto riparato)
 */
export class RepairCompleteHandler extends BaseMessageHandler {
  constructor() {
    super('repair_complete');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (import.meta.env.DEV) {
    }

    // Rimuovi effetto visivo di riparazione
    removeRepairEffect(networkSystem);
  }
}

// Helper condiviso per rimuovere effetto
function removeRepairEffect(networkSystem: ClientNetworkSystem): void {
  const ecs = networkSystem.getECS();
  const playerSystem = networkSystem.getPlayerSystem();

  if (!ecs || !playerSystem) {
    return;
  }

  const playerEntity = playerSystem.getPlayerEntity();
  if (!playerEntity) {
    return;
  }

  // Trova e rimuovi tutti gli effetti di riparazione per questo player
  const repairEffectEntities = ecs.getEntitiesWithComponents(RepairEffect);
  for (const entity of repairEffectEntities) {
    const repairEffect = ecs.getComponent(entity, RepairEffect);
    if (repairEffect && repairEffect.targetEntityId === playerEntity.id) {
      ecs.removeEntity(entity);
    }
  }
}