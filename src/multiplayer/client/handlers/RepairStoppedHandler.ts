import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { RepairEffect } from '../../../entities/combat/RepairEffect';

/**
 * Handler per repair_stopped (quando la riparazione viene interrotta, non completata)
 */
export class RepairStoppedHandler extends BaseMessageHandler {
  constructor() {
    super('repair_stopped');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    // 🚀 FIX: Trova l'entità corretta (locale o remota)
    const targetEntity = message.clientId
      ? networkSystem.findAnyPlayerEntity(message.clientId)
      : networkSystem.getPlayerSystem()?.getPlayerEntity();

    if (targetEntity) {
      // Rimuovi effetto visivo di riparazione per questa entità
      removeRepairEffect(networkSystem, targetEntity);
    }
  }
}

// Helper condiviso per rimuovere effetto
function removeRepairEffect(networkSystem: ClientNetworkSystem, targetEntity: any): void {
  const ecs = networkSystem.getECS();

  if (!ecs || !targetEntity) {
    return;
  }

  // Trova e rimuovi tutti gli effetti di riparazione per questa entità specifica
  const repairEffectEntities = ecs.getEntitiesWithComponents(RepairEffect);
  for (const entity of repairEffectEntities) {
    const repairEffect = ecs.getComponent(entity, RepairEffect);
    if (repairEffect && repairEffect.targetEntityId === targetEntity.id) {
      ecs.removeEntity(entity);
    }
  }
}