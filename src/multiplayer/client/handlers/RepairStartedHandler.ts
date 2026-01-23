import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { RepairEffect } from '../../../entities/combat/RepairEffect';
import { Transform } from '../../../entities/spatial/Transform';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { AtlasParser } from '../../../core/utils/AtlasParser';

/**
 * Handles repair_started messages from the server
 * These messages are sent when the repair system starts repairing the player
 */
export class RepairStartedHandler extends BaseMessageHandler {
  private repairFramesCache: { [key: string]: HTMLImageElement[] } | null = null;

  constructor() {
    super('repair_started');
  }

  async handle(message: any, networkSystem: ClientNetworkSystem): Promise<void> {
    if (import.meta.env.DEV) {
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

    // Determina quali tipi di riparazione mostrare controllando i danni del player
    const healthComponent = ecs.getComponent(playerEntity, Health);
    const shieldComponent = ecs.getComponent(playerEntity, Shield);

    const needsHPRepair = healthComponent && healthComponent.current < healthComponent.max;
    const needsShieldRepair = shieldComponent && shieldComponent.current < shieldComponent.max;

    // Crea effetto HP se necessario
    if (needsHPRepair) {
      await this.createRepairEffect(ecs, playerEntity, 'hp');
    }

    // Crea effetto Shield se necessario
    if (needsShieldRepair) {
      await this.createRepairEffect(ecs, playerEntity, 'shield');
    }
  }

  /**
   * Crea un effetto di riparazione per un tipo specifico (HP o shield)
   */
  private async createRepairEffect(ecs: any, playerEntity: any, repairType: 'hp' | 'shield'): Promise<void> {
    // Carica i frame appropriati
    const cacheKey = repairType;
    if (!this.repairFramesCache) {
      this.repairFramesCache = {};
    }

    let repairFrames = this.repairFramesCache[cacheKey];
    if (!repairFrames) {
      try {
        const atlasPath = repairType === 'hp'
          ? 'assets/repair/hprestore/hprestore.atlas'
          : 'assets/repair/shieldrestore/shieldrestore.atlas';

        const atlasData = await AtlasParser.parseAtlas(atlasPath);
        repairFrames = await AtlasParser.extractFrames(atlasData);
        this.repairFramesCache[cacheKey] = repairFrames;
      } catch (error) {
        console.error(`[RepairStartedHandler] Failed to load ${repairType} repair frames:`, error);
        return;
      }
    }

    if (!repairFrames || repairFrames.length === 0) {
      console.warn(`[RepairStartedHandler] No ${repairType} repair frames loaded`);
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