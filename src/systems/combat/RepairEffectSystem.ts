import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { RepairEffect } from '../../entities/combat/RepairEffect';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';

/**
 * Sistema di gestione degli effetti di riparazione
 * Gestisce l'animazione continua degli effetti di riparazione e aggiorna la posizione per seguire il target
 */
export class RepairEffectSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    // Trova tutte le entità con componente RepairEffect
    const repairEffectEntities = this.ecs.getEntitiesWithComponents(RepairEffect);

    for (const entity of repairEffectEntities) {
      const repairEffect = this.ecs.getComponent(entity, RepairEffect);

      if (repairEffect) {
        // Aggiorna l'animazione dell'effetto (loop infinito)
        repairEffect.update(deltaTime);

        // Aggiorna la posizione dell'effetto per seguire il target (player)
        const effectTransform = this.ecs.getComponent(entity, Transform);
        const targetEntityId = repairEffect.targetEntityId;
        const targetEntity = this.ecs.getEntity(targetEntityId);

        // 🚀 SICUREZZA: Rimuovi l'effetto se il target non esiste più o è invisibile (morto/esploso)
        let shouldCleanup = !targetEntity;

        if (targetEntity) {
          const sprite = this.ecs.getComponent(targetEntity, Sprite) as any;
          const animSprite = this.ecs.getComponent(targetEntity, AnimatedSprite) as any;
          if ((sprite && sprite.visible === false) || (animSprite && animSprite.visible === false)) {
            shouldCleanup = true;
          }
        }

        if (shouldCleanup) {
          this.ecs.removeEntity(entity);
          continue;
        }

        if (effectTransform && targetEntity) {
          const targetTransform = this.ecs.getComponent(targetEntity, Transform);
          if (targetTransform) {
            // Sincronizza la posizione dell'effetto con quella del target
            effectTransform.x = targetTransform.x;
            effectTransform.y = targetTransform.y;
          }
        }
      }
    }
  }
}
