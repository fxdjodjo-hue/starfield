import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { RepairEffect } from '../../../entities/combat/RepairEffect';
import { Transform } from '../../../entities/spatial/Transform';
import { AtlasParser } from '../../../utils/AtlasParser';

/**
 * Handles repair_started messages from the server
 * These messages are sent when the repair system starts repairing the player
 */
export class RepairStartedHandler extends BaseMessageHandler {
  private repairFramesCache: HTMLImageElement[] | null = null;

  constructor() {
    super('repair_started');
  }

  async handle(message: any, networkSystem: ClientNetworkSystem): Promise<void> {
    if (import.meta.env.DEV) {
      console.log('[RepairStartedHandler] Repair started for player', message.playerId);
    }

    // Crea effetto visivo di riparazione
    const ecs = networkSystem.getECS();
    const playerSystem = networkSystem.getPlayerSystem();
    
    if (!ecs || !playerSystem) {
      console.warn('[RepairStartedHandler] ECS or PlayerSystem not available');
      return;
    }

    const playerEntity = playerSystem.getPlayerEntity();
    if (!playerEntity) {
      console.warn('[RepairStartedHandler] Player entity not found');
      return;
    }

    // Verifica se esiste già un effetto di riparazione (evita duplicati)
    const existingRepairEffects = ecs.getEntitiesWithComponents(RepairEffect);
    for (const entity of existingRepairEffects) {
      const repairEffect = ecs.getComponent(entity, RepairEffect);
      if (repairEffect && repairEffect.targetEntityId === playerEntity.id) {
        // Effetto già esistente, non crearne un altro
        return;
      }
    }

    // Carica i frame di riparazione
    let repairFrames = this.repairFramesCache;
    if (!repairFrames) {
      try {
        const atlasPath = '/assets/repair/hprestore/hprestore.atlas';
        const atlasData = await AtlasParser.parseAtlas(atlasPath);
        repairFrames = await AtlasParser.extractFrames(atlasData);
        this.repairFramesCache = repairFrames;
      } catch (error) {
        console.error('[RepairStartedHandler] Failed to load repair frames:', error);
        return;
      }
    }

    if (repairFrames.length === 0) {
      console.warn('[RepairStartedHandler] No repair frames loaded');
      return;
    }

    // Crea entità effetto riparazione
    const repairEffectEntity = ecs.createEntity();
    const playerTransform = ecs.getComponent(playerEntity, Transform);
    
    if (!playerTransform) {
      console.warn('[RepairStartedHandler] Player transform not found');
      ecs.removeEntity(repairEffectEntity);
      return;
    }

    // Crea Transform per l'effetto (stessa posizione del player)
    const effectTransform = new Transform(playerTransform.x, playerTransform.y, 0);
    
    // Crea RepairEffect con loop infinito (50ms per frame)
    const repairEffect = new RepairEffect(repairFrames, 50, playerEntity.id);

    // Aggiungi componenti
    ecs.addComponent(repairEffectEntity, Transform, effectTransform);
    ecs.addComponent(repairEffectEntity, RepairEffect, repairEffect);
  }
}

/**
 * Handler per repair_stopped (quando la riparazione viene interrotta, non completata)
 */
export class RepairStoppedHandler extends BaseMessageHandler {
  constructor() {
    super('repair_stopped');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (import.meta.env.DEV) {
      console.log('[RepairStoppedHandler] Repair stopped for player', message.playerId);
    }

    // Rimuovi effetto visivo di riparazione
    removeRepairEffect(networkSystem);
  }
}

/**
 * Handler per repair_complete (quando la riparazione è completata, tutto riparato)
 */
export class RepairCompleteHandler extends BaseMessageHandler {
  constructor() {
    super('repair_complete');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (import.meta.env.DEV) {
      console.log('[RepairCompleteHandler] Repair completed for player', message.playerId);
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
